#!/usr/bin/env bash
# Qolib ketgan jarayonlarni to'xtatish
#   ./stop.sh
# start.sh dagi Ctrl+C ishlamay qolsa shuni ishlating.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-3000}"

echo "To'xtatilmoqda…"

pkill -f "$ROOT/backend/server.js"      2>/dev/null && echo "  backend to'xtadi"
pkill -f "$ROOT/telegram-bot/bot.js"    2>/dev/null && echo "  bot to'xtadi"
pkill -f "cloudflared tunnel"            2>/dev/null && echo "  tunnel to'xtadi"
pkill -f "ngrok http"                    2>/dev/null && echo "  ngrok to'xtadi"

sleep 1

if command -v lsof >/dev/null; then
  LEFT=$(lsof -ti:"$PORT" 2>/dev/null)
  if [ -n "$LEFT" ]; then
    echo "$LEFT" | xargs -r kill -9 2>/dev/null
    echo "  $PORT porti bo'shatildi"
  fi
fi

echo "Tayyor."
