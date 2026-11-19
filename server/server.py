#!/usr/bin/env python3
"""Servidor do CTI Racers: entrega os arquivos do jogo e cuida das salas do multiplayer.

Só usa a biblioteca padrão do Python. O servidor conhece salas e jogadores; a corrida em si é simulada
nos navegadores, e ele apenas repassa as mensagens entre quem está na mesma sala.

Uso: python3 server/server.py [porta] [--host ENDERECO]
"""
import asyncio
import collections
import math
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
RANKING_FILE = Path(__file__).resolve().parent / "ranking_v2.json"        # ranking atual: desempenho por corrida
LEGACY_RANKING_FILE = Path(__file__).resolve().parent / "ranking.json"    # ranking antigo (medalhas): congelado, só leitura
HISTORY_FILE = Path(__file__).resolve().parent / "history.jsonl"   # uma linha por corrida disputada, só acrescenta
RANKING_LIMIT = 50
HISTORY_LIMIT = 40                                  # corridas mais recentes que o ranking mostra
MIN_RANKED_RACES = 5                                # corridas rankeadas para ganhar posição; antes disso o jogador aparece sem posição
MEDAL_POINTS = {"gold": 3, "silver": 1.5, "bronze": 1}   # só o ranking antigo usa; mesmo peso do campeonato
PUBLIC_ENTRIES = {"index.html", "css", "src", "vendor", "assets"}   # o resto do projeto não é servido

WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
MAX_HEADER_BYTES = 8192
MAX_FRAME_BYTES = 64 * 1024
MAX_MESSAGES_PER_SECOND = 200
SEND_QUEUE_SIZE = 512

MIN_RACERS, MAX_RACERS = 2, 8                      # MAX_RACERS é o número de vagas da sala
MIN_RACES, MAX_RACES = 1, 10
MAX_ROOMS = 64
RESUME_GRACE = 20                                   # segundos que a vaga fica guardada depois de a conexão cair
CHAT_LENGTH = 60
CHAT_INTERVAL = 0.6                                 # segundos mínimos entre mensagens de chat de um jogador
CHAT_LOG = 30                                       # mensagens do chat global guardadas para quem entra depois
BACK_SHOT_COS = -0.15                               # tiro que aponta mais de ~99° do carro conta como tiro para trás
MIN_RANKED_PLAYERS = 3                             # com menos humanos que isso a partida não conta para ranking nem histórico
MAX_RESULT_COUNT = 999
NAME_LENGTH = 12
ROOM_NAME_LENGTH = 20
DEFAULT_NAME = "Piloto"


def clean_text(value, length):
    """Só letras sem acento, números e espaços, que é o que a fonte do jogo desenha."""
    text = unicodedata.normalize("NFKD", value if isinstance(value, str) else "")
    text = re.sub(r"[^A-Za-z0-9 ]", "", text).strip()
    return re.sub(r" +", " ", text)[:length].strip()


def clean_chat(value):
    """Texto de chat: o que a fonte do jogo desenha, com pontuação básica."""
    text = unicodedata.normalize("NFKD", value if isinstance(value, str) else "")
    text = re.sub(r"[^A-Za-z0-9 .,!?:()/+*%\-]", "", text).strip()
    return re.sub(r" +", " ", text)[:CHAT_LENGTH].strip()


def clean_name(value):
    return clean_text(value, NAME_LENGTH) or DEFAULT_NAME


def load_players(path):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        data = {}
    return data if isinstance(data, dict) else {}


def merged(players):
    """Nomes que só mudam em maiúsculas/minúsculas são o mesmo jogador: os registros são somados."""
    result, keys = {}, {}
    for name, entry in players.items():
        key = keys.setdefault(name.casefold(), name)
        if key not in result:
            result[key] = dict(entry)
            continue
        for field, value in entry.items():
            result[key][field] = result[key].get(field, 0) + value
    return result


def legacy_table(players):
    """Ranking antigo: soma de pontos de medalha. Só leitura, o arquivo não é mais gravado."""
    rows = [{"name": name, **{key: value for key, value in entry.items() if key not in ("positionSum", "races")}, "average": round(entry["positionSum"] / entry["matches"], 2)}
            for name, entry in merged(players).items() if entry.get("matches", 0) > 0]
    for row in rows:
        row["points"] = row["gold"] * MEDAL_POINTS["gold"] + row["silver"] * MEDAL_POINTS["silver"] + row["bronze"] * MEDAL_POINTS["bronze"]
    rows.sort(key=lambda row: (-row["points"], -row["gold"], -row["silver"], -row["bronze"], row["average"]))
    return rows[:RANKING_LIMIT]


class Ranking:
    """Desempenho por corrida de quem jogou de verdade. Cada corrida rende uma nota de 0 (último) a 1 (primeiro),
    igual para qualquer tamanho de grupo; o desempenho do jogador é a média das notas; sem as corridas mínimas ele fica sem classificação."""

    def __init__(self, path):
        self.path = path
        self.players = merged(load_players(path))

    def entry(self, name):
        known = next((key for key in self.players if key.casefold() == name.casefold()), name)
        return self.players.setdefault(known, {"races": 0, "score": 0.0, "wins": 0, "podiums": 0, "positionSum": 0, "kills": 0, "matches": 0})

    def record_race(self, name, position, racers):
        entry = self.entry(name)
        entry["races"] += 1
        entry["score"] += (racers - position) / (racers - 1)
        entry["wins"] += 1 if position == 1 else 0
        entry["podiums"] += 1 if position <= 3 else 0
        entry["positionSum"] += position

    def record_match(self, name, kills):
        entry = self.entry(name)
        entry["matches"] += 1
        entry["kills"] += kills

    def save(self):
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(json.dumps(self.players, ensure_ascii=False), encoding="utf-8")
        temporary.replace(self.path)

    def table(self):
        rows = [{
            "name": name, "rating": round(100 * entry["score"] / entry["races"], 1),
            "races": entry["races"], "wins": entry["wins"], "podiumRate": round(100 * entry["podiums"] / entry["races"]),
            "average": round(entry["positionSum"] / entry["races"], 2), "kills": entry["kills"], "matches": entry["matches"],
            "ranked": entry["races"] >= MIN_RANKED_RACES, "minRaces": MIN_RANKED_RACES,
        } for name, entry in self.players.items() if entry["races"] > 0]
        rows.sort(key=lambda row: (not row["ranked"], -row["rating"], -row["wins"], -row["races"]))      # sem posição por último
        return rows[:RANKING_LIMIT]


class Client:
    def __init__(self, writer):
        self.id = secrets.token_hex(4)
        self.token = secrets.token_hex(8)       # só quem tem o token retoma a vaga depois de uma queda
        self.yaw = None                         # último rumo informado nos snapshots, para validar tiros
        self.last_chat = 0.0
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
        self.bots = 0                       # a sala tem sempre MAX_RACERS vagas; bots só existem se o admin pedir
        self.races = 3
        self.match_id = ""
        self.race_no = 0
        self.back_shots = True              # liberar tiro com o olhar virado para trás (Q)
        self.phase = "lobby"
        self.ranked = True                  # partida com bots ou com poucos humanos não conta para ranking nem histórico; decidido na largada
        self.banned = set()

    def public_info(self):
        return {"id": self.id, "name": self.name, "players": len(self.members), "cars": MAX_RACERS, "phase": self.phase}

    def ranked_status(self):
        """Só conta para ranking e histórico quem joga sem bots e com humanos suficientes."""
        if self.bots > 0:
            return {"ok": False, "reason": "bots"}
        if len(self.members) < MIN_RANKED_PLAYERS:
            return {"ok": False, "reason": "players", "min": MIN_RANKED_PLAYERS}
        return {"ok": True, "reason": ""}

    def state(self):
        return {
            "id": self.id, "name": self.name, "hostId": self.host.id, "phase": self.phase, "matchId": self.match_id,
            "config": {"cars": MAX_RACERS, "bots": self.bots, "races": self.races, "backShots": self.back_shots},
            "ranked": self.ranked_status(),
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
        self.pending = {}                   # token -> cliente que caiu e ainda pode voltar
        self.ranking = Ranking(RANKING_FILE)
        self.legacy_rows = legacy_table(load_players(LEGACY_RANKING_FILE))
        self.chat = collections.deque(maxlen=CHAT_LOG)   # chat global: todos os conectados leem tudo, em sala ou fora dela

    def room_list(self):
        return [room.public_info() for room in self.rooms.values()]

    def publish_rooms(self):
        rooms = self.room_list()
        for client in self.clients:
            if client.room is None:
                client.send({"t": "rooms", "rooms": rooms})

    def publish_online(self):
        """Quantos jogadores estão conectados agora; o menu inicial mostra o número."""
        message = {"t": "online", "count": len(self.clients)}
        for client in self.clients:
            client.send(message)

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
        if not room.members:
            self.rooms.pop(room.id, None)
        else:
            if client is room.host:
                room.host = room.members[0]      # o admin saiu: o jogador mais antigo da sala assume
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
        if len(room.members) >= MAX_RACERS:               # em partida, o jogador entra e espera a próxima corrida
            return client.send({"t": "error", "code": "full"})
        self.join(client, room)
        room.bots = min(room.bots, MAX_RACERS - len(room.members))   # quem entra toma o lugar de um bot, se a sala estava cheia
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
        bots, races = message.get("bots"), message.get("races")
        if isinstance(bots, int):
            room.bots = max(0, min(MAX_RACERS - len(room.members), bots))
        if isinstance(races, int):
            room.races = max(MIN_RACES, min(MAX_RACES, races))
        if isinstance(message.get("backShots"), bool):
            room.back_shots = message["backShots"]
        self.publish_room(room)

    def on_start(self, client, _message):
        room = self.admin_room(client)
        if room is None or room.phase != "lobby":
            return
        if len(room.members) + room.bots < MIN_RACERS:    # sozinho na sala, precisa de ao menos um bot
            return client.send({"t": "error", "code": "need_racers"})
        room.phase = "playing"
        room.match_id, room.race_no = secrets.token_hex(3), 0
        room.ranked = room.bots == 0 and len(room.members) >= MIN_RANKED_PLAYERS
        state = room.state()
        for member in room.members:
            member.send({"t": "started", "room": state})

    @staticmethod
    def valid_result(result, racers):
        if not isinstance(result, dict) or not isinstance(result.get("position"), int) or not 1 <= result["position"] <= racers:
            return False
        return all(isinstance(result.get(key), int) and 0 <= result[key] <= MAX_RESULT_COUNT for key in ("gold", "silver", "bronze", "kills"))

    def record_results(self, room, results):
        if not room.ranked or not isinstance(results, list):
            return
        members = {member.id: member for member in room.members}
        recorded = False
        for result in results:
            member = members.get(result.get("id")) if isinstance(result, dict) else None
            if member is not None and self.valid_result(result, MAX_RACERS):
                self.ranking.record_match(member.name, result["kills"])
                recorded = True
        if recorded:
            self.ranking.save()

    @staticmethod
    def append_history(entry):
        try:
            with HISTORY_FILE.open("a", encoding="utf-8") as file:
                file.write(json.dumps(entry, ensure_ascii=False, separators=(",", ":")) + "\n")
        except OSError:
            pass                                  # histórico é extra: falhar ao gravar não derruba a sala

    def on_race(self, client, message):
        """O admin reporta cada corrida que termina: quem correu, em que posição e em que mapa."""
        room = self.admin_room(client)
        results = message.get("results")
        if room is None or room.phase != "playing" or not room.ranked or not isinstance(results, list) or not 0 < len(results) <= MAX_RACERS:
            return
        members = {member.id: member for member in room.members}
        racers, humans = [], []
        if len(results) < 2 or sorted(result.get("position") if isinstance(result, dict) else 0 for result in results) != list(range(1, len(results) + 1)):
            return                                # posições têm de ser 1..N sem repetir, senão a nota não faz sentido
        for result in results:
            if not isinstance(result, dict) or not isinstance(result.get("position"), int) or not 1 <= result["position"] <= MAX_RACERS:
                return
            member = members.get(result.get("id"))
            seconds = result.get("time")
            racers.append({
                "name": member.name if member else clean_text(result.get("name"), NAME_LENGTH) or "Bot",
                "human": member is not None, "position": result["position"],
                "time": round(seconds, 2) if isinstance(seconds, (int, float)) and not isinstance(seconds, bool) and 0 <= seconds < 36000 else None,
            })
            if member:
                humans.append((member.name, result["position"]))
        if not humans:
            return
        for name, position in humans:
            self.ranking.record_race(name, position, len(results))
        self.ranking.save()
        room.race_no += 1
        self.append_history({"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "room": room.name, "match": room.match_id, "n": room.race_no,
                             "biome": clean_text(message.get("biome"), 20), "racers": sorted(racers, key=lambda racer: racer["position"])})

    @staticmethod
    def recent_history(player=None, match=None):
        recent = collections.deque(maxlen=MAX_RACES if match else HISTORY_LIMIT)
        wanted = player.casefold() if player else None
        try:
            with HISTORY_FILE.open(encoding="utf-8") as file:
                for line in file:
                    try:
                        entry = json.loads(line)
                    except ValueError:
                        continue                  # linha cortada por uma queda: ignora e segue
                    if match and entry.get("match") != match:
                        continue
                    if wanted and not any(racer.get("name", "").casefold() == wanted for racer in entry.get("racers", [])):
                        continue
                    recent.append(entry)
        except OSError:
            pass
        return list(recent) if match else list(reversed(recent))   # a partida em ordem de corrida; o resto, a mais nova primeiro

    def on_history(self, client, message):
        player, match = clean_text(message.get("player"), NAME_LENGTH), clean_text(message.get("match"), 12)
        reply = {"t": "history", "races": self.recent_history(player or None, match or None)}
        if player:
            reply["player"] = player
        if match:
            reply["match"] = match
        client.send(reply)

    def on_chat(self, client, message):
        text = clean_chat(message.get("text"))
        now = time.monotonic()
        if not text or now - client.last_chat < CHAT_INTERVAL:
            return
        client.last_chat = now
        line = {"name": client.name, "text": text}
        self.chat.append(line)
        for member in self.clients:
            member.send({"t": "chat", **line})

    def on_legacy(self, client, _message):
        client.send({"t": "legacy", "players": self.legacy_rows})

    def on_ranking(self, client, _message):
        client.send({"t": "ranking", "players": self.ranking.table()})

    def on_end_match(self, client, message):
        room = self.admin_room(client)
        if room is None or room.phase != "playing":
            return
        self.record_results(room, message.get("results"))
        room.phase = "lobby"
        state = room.state()
        for member in room.members:
            member.send({"t": "ended", "room": state})

    @staticmethod
    def allow_game_message(client, room, data):
        """Guarda o rumo de cada carro (snapshots) e barra tiro para trás quando a sala proíbe."""
        if not isinstance(data, dict):
            return True
        if data.get("k") == "s":
            for entry in data.get("r") if isinstance(data.get("r"), list) else []:
                if isinstance(entry, list) and len(entry) > 6 and entry[0] == client.id and isinstance(entry[6], (int, float)):
                    client.yaw = entry[6]
            return True
        if data.get("k") != "shot" or room.back_shots or client.yaw is None:
            return True
        try:
            (fx, _, fz), (ex, _, ez) = data["f"], data["e"]
            dx, dz = ex - fx, ez - fz
            length = math.hypot(dx, dz)
            if length < 0.01:
                return True
            cosine = (dx * -math.sin(client.yaw) + dz * -math.cos(client.yaw)) / length
        except (KeyError, TypeError, ValueError):
            return True
        return cosine >= BACK_SHOT_COS

    def on_game(self, client, message):
        room = client.room
        if room is None or room.phase != "playing" or "d" not in message:
            return
        if not self.allow_game_message(client, room, message["d"]):
            return
        outgoing = {"t": "g", "from": client.id, "d": message["d"]}
        target = message.get("to")
        for member in room.members:
            if member is not client and (target is None or member.id == target):
                member.send(outgoing)

    def on_resume(self, client, message):
        old = self.pending.pop(message.get("token"), None) if client.room is None else None
        room = old.room if old is not None else None
        if room is None or old not in room.members:
            return client.send({"t": "resume_failed"})
        old.grace.cancel()
        client.id, client.token, client.name, client.yaw = old.id, old.token, old.name, old.yaw
        room.members[room.members.index(old)] = client
        if room.host is old:
            room.host = client
        client.room, old.room = room, None
        client.send({"t": "resumed", "id": client.id, "room": room.state(), "chat": list(self.chat)})
        self.publish_room(room)

    HANDLERS = {"create": on_create, "join": on_join, "name": on_name, "leave": on_leave,
                "kick": on_kick, "config": on_config, "start": on_start, "race": on_race, "end": on_end_match, "ranking": on_ranking, "history": on_history, "legacy": on_legacy, "chat": on_chat, "resume": on_resume, "g": on_game}

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
        client.send({"t": "welcome", "id": client.id, "token": client.token})
        client.send({"t": "chatlog", "lines": list(self.chat)})
        client.send({"t": "rooms", "rooms": self.room_list()})
        self.publish_online()

    def disconnect(self, client):
        self.clients.discard(client)
        self.publish_online()
        if client.room is not None and client.room.members:
            # Quem estava numa sala guarda a vaga por alguns segundos: se voltar com o token, retoma de onde parou.
            self.pending[client.token] = client
            client.grace = asyncio.get_running_loop().call_later(RESUME_GRACE, self.expire, client)
            return
        self.remove_from_room(client)
        self.publish_rooms()

    def expire(self, client):
        if self.pending.pop(client.token, None) is client:
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
    print(f"CTI Racers em http://localhost:{port}")
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
