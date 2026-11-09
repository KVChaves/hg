#!/usr/bin/env python3
"""Servidor do Half Grip: entrega os arquivos do jogo e cuida das salas do multiplayer.

Só usa a biblioteca padrão do Python. O servidor conhece salas e jogadores; a corrida em si é simulada
nos navegadores, e ele apenas repassa as mensagens entre quem está na mesma sala.

Uso: python3 server/server.py [porta] [--host ENDERECO]
"""
import asyncio
import base64
import hashlib
import json
import mimetypes
import re
import secrets
import socket
import struct
import sys
import time
import unicodedata
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
RANKING_FILE = Path(__file__).resolve().parent / "ranking.json"
RANKING_LIMIT = 50
PUBLIC_ENTRIES = {"index.html", "css", "src", "vendor", "assets"}   # o resto do projeto não é servido

WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
MAX_HEADER_BYTES = 8192
MAX_FRAME_BYTES = 64 * 1024
MAX_MESSAGES_PER_SECOND = 200
SEND_QUEUE_SIZE = 512

MIN_RACERS, MAX_RACERS = 2, 8
MIN_RACES, MAX_RACES = 1, 10
MAX_ROOMS = 64
MAX_RESULT_COUNT = 999
NAME_LENGTH = 12
ROOM_NAME_LENGTH = 20
DEFAULT_NAME = "Piloto"


def clean_text(value, length):
    """Só letras sem acento, números e espaços, que é o que a fonte do jogo desenha."""
    text = unicodedata.normalize("NFKD", value if isinstance(value, str) else "")
    text = re.sub(r"[^A-Za-z0-9 ]", "", text).strip()
    return re.sub(r" +", " ", text)[:length].strip()


def clean_name(value):
    return clean_text(value, NAME_LENGTH) or DEFAULT_NAME


class Ranking:
    """Histórico de quem jogou de verdade: só jogadores da sala entram, bots não."""

    def __init__(self, path):
        self.path = path
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            data = {}
        self.players = data if isinstance(data, dict) else {}

    def record(self, name, result):
        entry = self.players.setdefault(name, {"trophies": 0, "gold": 0, "silver": 0, "bronze": 0, "kills": 0, "matches": 0, "positionSum": 0})
        entry["trophies"] += 1 if result["position"] == 1 else 0
        for key in ("gold", "silver", "bronze", "kills"):
            entry[key] += result[key]
        entry["matches"] += 1
        entry["positionSum"] += result["position"]

    def save(self):
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(json.dumps(self.players, ensure_ascii=False), encoding="utf-8")
        temporary.replace(self.path)

    def table(self):
        rows = [{"name": name, **{key: value for key, value in entry.items() if key != "positionSum"}, "average": round(entry["positionSum"] / entry["matches"], 2)}
                for name, entry in self.players.items() if entry["matches"] > 0]
        rows.sort(key=lambda row: (-row["trophies"], -row["gold"], -row["silver"], -row["bronze"], row["average"]))
        return rows[:RANKING_LIMIT]


class Client:
    def __init__(self, writer):
        self.id = secrets.token_hex(4)
        self.name = DEFAULT_NAME
        self.writer = writer
        self.queue = asyncio.Queue(SEND_QUEUE_SIZE)
        self.room = None
        self.window_start = 0.0
        self.window_count = 0

    def send(self, message):
        try:
            self.queue.put_nowait(json.dumps(message, separators=(",", ":")))
        except asyncio.QueueFull:
            self.writer.close()                  # conexão travada não pode segurar os outros

    def allows_message(self):
        now = time.monotonic()
        if now - self.window_start >= 1:
            self.window_start, self.window_count = now, 0
        self.window_count += 1
        return self.window_count <= MAX_MESSAGES_PER_SECOND


class Room:
    def __init__(self, host, name):
        self.id = secrets.token_hex(3)
        self.name = clean_text(name, ROOM_NAME_LENGTH) or f"Sala de {host.name}"
        self.host = host
        self.members = []
        self.cars = MAX_RACERS
        self.races = 3
        self.phase = "lobby"
        self.banned = set()

    def public_info(self):
        return {"id": self.id, "name": self.name, "players": len(self.members), "cars": self.cars, "phase": self.phase}

    def state(self):
        return {
            "id": self.id, "name": self.name, "hostId": self.host.id, "phase": self.phase,
            "config": {"cars": self.cars, "races": self.races},
            "players": [{"id": member.id, "name": member.name} for member in self.members],
        }

    def unique_name(self, wanted, client):
        taken = {member.name for member in self.members if member is not client}
        if wanted not in taken:
            return wanted
        number = 2
        while True:
            suffix = f" {number}"
            candidate = wanted[:NAME_LENGTH - len(suffix)].rstrip() + suffix
            if candidate not in taken:
                return candidate
            number += 1


class Lobby:
    """Estado de todas as salas. Roda em uma só tarefa de cada vez, então não precisa de travas."""

    def __init__(self):
        self.clients = set()
        self.rooms = {}
        self.ranking = Ranking(RANKING_FILE)

    def room_list(self):
        return [room.public_info() for room in self.rooms.values() if room.phase == "lobby"]

    def publish_rooms(self):
        rooms = self.room_list()
        for client in self.clients:
            if client.room is None:
                client.send({"t": "rooms", "rooms": rooms})

    def publish_room(self, room):
        state = room.state()
        for member in room.members:
            member.send({"t": "room", "room": state})

    def remove_from_room(self, client, reason=None):
        room = client.room
        if room is None:
            return
        room.members.remove(client)
        client.room = None
        if reason:
            client.send({"t": "left", "reason": reason})
        if client is room.host:
            self.close_room(room)
        elif room.members:
            self.publish_room(room)

    def close_room(self, room):
        for member in list(room.members):
            member.room = None
            member.send({"t": "left", "reason": "closed"})
        room.members.clear()
        self.rooms.pop(room.id, None)

    def join(self, client, room):
        client.name = room.unique_name(client.name, client)
        room.members.append(client)
        client.room = room

    def on_create(self, client, message):
        if client.room or len(self.rooms) >= MAX_ROOMS:
            return client.send({"t": "error", "code": "cannot_create"})
        room = Room(client, message.get("name"))
        self.rooms[room.id] = room
        self.join(client, room)
        self.publish_room(room)

    def on_join(self, client, message):
        room = self.rooms.get(message.get("room"))
        if client.room:
            return
        if room is None:
            return client.send({"t": "error", "code": "no_room"})
        if client.id in room.banned:
            return client.send({"t": "error", "code": "banned"})
        if room.phase != "lobby":
            return client.send({"t": "error", "code": "in_progress"})
        if len(room.members) >= room.cars:
            return client.send({"t": "error", "code": "full"})
        self.join(client, room)
        self.publish_room(room)

    def on_name(self, client, message):
        room, name = client.room, clean_name(message.get("name"))
        if room is None:
            client.name = name
            return
        name = room.unique_name(name, client)            # dentro da sala os nomes continuam únicos
        if name != client.name:
            client.name = name
            self.publish_room(room)

    def on_leave(self, client, _message):
        self.remove_from_room(client)

    def admin_room(self, client):
        room = client.room
        return room if room is not None and room.host is client else None

    def on_kick(self, client, message):
        room = self.admin_room(client)
        target = next((member for member in room.members if member.id == message.get("id")), None) if room else None
        if target is None or target is client:
            return
        room.banned.add(target.id)
        self.remove_from_room(target, "kicked")

    def on_config(self, client, message):
        room = self.admin_room(client)
        if room is None or room.phase != "lobby":
            return
        cars, races = message.get("cars"), message.get("races")
        if isinstance(cars, int):
            room.cars = max(MIN_RACERS, len(room.members), min(MAX_RACERS, cars))
        if isinstance(races, int):
            room.races = max(MIN_RACES, min(MAX_RACES, races))
        self.publish_room(room)

    def on_start(self, client, _message):
        room = self.admin_room(client)
        if room is None or room.phase != "lobby":
            return
        room.phase = "playing"
        state = room.state()
        for member in room.members:
            member.send({"t": "started", "room": state})

    @staticmethod
    def valid_result(result, racers):
        if not isinstance(result, dict) or not isinstance(result.get("position"), int) or not 1 <= result["position"] <= racers:
            return False
        return all(isinstance(result.get(key), int) and 0 <= result[key] <= MAX_RESULT_COUNT for key in ("gold", "silver", "bronze", "kills"))

    def record_results(self, room, results):
        if not isinstance(results, list):
            return
        members = {member.id: member for member in room.members}
        recorded = False
        for result in results:
            member = members.get(result.get("id")) if isinstance(result, dict) else None
            if member is not None and self.valid_result(result, room.cars):
                self.ranking.record(member.name, result)
                recorded = True
        if recorded:
            self.ranking.save()

    def on_ranking(self, client, _message):
        client.send({"t": "ranking", "players": self.ranking.table()})

    def on_end_match(self, client, message):
        room = self.admin_room(client)
        if room is None or room.phase != "playing":
            return
        self.record_results(room, message.get("results"))
        room.phase = "lobby"
        room.cars = max(room.cars, len(room.members))
        state = room.state()
        for member in room.members:
            member.send({"t": "ended", "room": state})

    def on_game(self, client, message):
        room = client.room
        if room is None or room.phase != "playing" or "d" not in message:
            return
        outgoing = {"t": "g", "from": client.id, "d": message["d"]}
        target = message.get("to")
        for member in room.members:
            if member is not client and (target is None or member.id == target):
                member.send(outgoing)

    HANDLERS = {"create": on_create, "join": on_join, "name": on_name, "leave": on_leave,
                "kick": on_kick, "config": on_config, "start": on_start, "end": on_end_match, "ranking": on_ranking, "g": on_game}

    def handle(self, client, text):
        try:
            message = json.loads(text)
        except ValueError:
            return
        if not isinstance(message, dict):
            return
        handler = self.HANDLERS.get(message.get("t"))
        if handler is None:
            return
        rooms_before = self.room_list()
        handler(self, client, message)
        if self.room_list() != rooms_before:
            self.publish_rooms()

    def connect(self, client):
        self.clients.add(client)
        client.send({"t": "welcome", "id": client.id})
        client.send({"t": "rooms", "rooms": self.room_list()})

    def disconnect(self, client):
        self.clients.discard(client)
        self.remove_from_room(client)
        self.publish_rooms()


lobby = Lobby()


def encode_frame(text):
    payload = text.encode()
    size = len(payload)
    if size < 126:
        return bytes([0x81, size]) + payload
    if size < 65536:
        return bytes([0x81, 126]) + struct.pack(">H", size) + payload
    return bytes([0x81, 127]) + struct.pack(">Q", size) + payload


async def read_frame(reader):
    """Devolve (opcode, dados). Quadros fragmentados ou grandes demais encerram a conexão."""
    first, second = await reader.readexactly(2)
    finished, opcode, masked, size = first & 0x80, first & 0x0F, second & 0x80, second & 0x7F
    if not finished or not masked:
        raise ConnectionError("quadro inválido")
    if size == 126:
        size = struct.unpack(">H", await reader.readexactly(2))[0]
    elif size == 127:
        size = struct.unpack(">Q", await reader.readexactly(8))[0]
    if size > MAX_FRAME_BYTES:
        raise ConnectionError("quadro grande demais")
    mask = await reader.readexactly(4)
    data = bytearray(await reader.readexactly(size))
    for i in range(size):
        data[i] ^= mask[i % 4]
    return opcode, bytes(data)


async def pump_outgoing(client):
    while True:
        text = await client.queue.get()
        client.writer.write(encode_frame(text))
        await client.writer.drain()


async def serve_websocket(reader, writer, key):
    accept = base64.b64encode(hashlib.sha1((key + WEBSOCKET_GUID).encode()).digest()).decode()
    writer.write((
        "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
        f"Sec-WebSocket-Accept: {accept}\r\n\r\n"
    ).encode())
    await writer.drain()

    client = Client(writer)
    lobby.connect(client)
    sender = asyncio.create_task(pump_outgoing(client))
    try:
        while True:
            opcode, data = await read_frame(reader)
            if opcode == 8:
                break
            if opcode == 9:
                writer.write(bytes([0x8A, len(data)]) + data if len(data) < 126 else b"")
            elif opcode == 1 and client.allows_message():
                lobby.handle(client, data.decode(errors="ignore"))
    except (asyncio.IncompleteReadError, ConnectionError, OSError):
        pass
    finally:
        sender.cancel()
        lobby.disconnect(client)


def public_file(url_path):
    """Caminho do arquivo pedido, ou None se estiver fora do que o jogo publica."""
    relative = unquote(urlsplit(url_path).path).lstrip("/") or "index.html"
    parts = Path(relative).parts
    if not parts or parts[0] not in PUBLIC_ENTRIES or ".." in parts:
        return None
    # Symlinks de teste continuam dentro da entrada publicada; fora dela, não servem.
    path = (ROOT / relative)
    return path if path.is_file() and path.resolve().is_relative_to((ROOT / parts[0]).resolve()) else None


async def respond(writer, status, body, content_type="text/plain; charset=utf-8", send_body=True):
    head = (
        f"HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {len(body)}\r\n"
        "Cache-Control: no-store\r\nConnection: close\r\n\r\n"
    )
    writer.write(head.encode() + (body if send_body else b""))
    await writer.drain()


async def handle_connection(reader, writer):
    try:
        raw = await reader.readuntil(b"\r\n\r\n")
        if len(raw) > MAX_HEADER_BYTES:
            return await respond(writer, "431 Request Header Fields Too Large", b"")
        lines = raw.decode("latin-1").split("\r\n")
        method, target, _ = lines[0].split(" ", 2)
        headers = {}
        for line in lines[1:]:
            if ":" in line:
                name, value = line.split(":", 1)
                headers[name.strip().lower()] = value.strip()

        if urlsplit(target).path == "/ws" and headers.get("upgrade", "").lower() == "websocket" and "sec-websocket-key" in headers:
            return await serve_websocket(reader, writer, headers["sec-websocket-key"])
        if method not in ("GET", "HEAD"):
            return await respond(writer, "405 Method Not Allowed", b"")

        path = public_file(target)
        if path is None:
            return await respond(writer, "404 Not Found", b"nao encontrado")
        body = await asyncio.to_thread(path.read_bytes)
        content_type = {".js": "text/javascript; charset=utf-8", ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8"}.get(
            path.suffix, mimetypes.guess_type(path.name)[0] or "application/octet-stream")
        await respond(writer, "200 OK", body, content_type, method == "GET")
    except (asyncio.IncompleteReadError, asyncio.LimitOverrunError, ConnectionError, OSError, ValueError):
        pass
    finally:
        writer.close()


def local_address():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("10.255.255.255", 1))     # não envia nada, só descobre a interface
            return probe.getsockname()[0]
    except OSError:
        return "127.0.0.1"


async def main():
    arguments = sys.argv[1:]
    host = "0.0.0.0"
    if "--host" in arguments:
        index = arguments.index("--host")
        host = arguments[index + 1]
        del arguments[index:index + 2]
    port = int(arguments[0]) if arguments else 8000
    server = await asyncio.start_server(handle_connection, host, port, limit=MAX_HEADER_BYTES)
    print(f"Half Grip em http://localhost:{port}")
    if host == "0.0.0.0":
        print(f"Na mesma rede, os outros jogadores abrem http://{local_address()}:{port}")
    sys.stdout.flush()
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
