#!/bin/sh
# Servidor do jogo e das salas do multiplayer: ./run.sh [porta]
cd "$(dirname "$0")" || exit 1
exec python3 server/server.py "${1:-8000}"
