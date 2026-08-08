#!/usr/bin/env bash
# Shaxmat — hammasini bitta buyruq bilan ishga tushirish
#   ./start.sh
# To'xtatish: Ctrl+C

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$ROOT/.logs"
mkdir -p "$LOGS"

BACKEND_PORT="${PORT:-3000}"
TUNNEL_LOG="$LOGS/tunnel.log"
BACKEND_LOG="$LOGS/backend.log"
BOT_LOG="$LOGS/bot.log"

PIDS=()

c_red=$'\e[31m'; c_grn=$'\e[32m'; c_yel=$'\e[33m'; c_dim=$'\e[2m'; c_off=$'\e[0m'
say()  { printf "%s\n" "$*"; }
ok()   { printf "${c_grn}✓${c_off} %s\n" "$*"; }
warn() { printf "${c_yel}!${c_off} %s\n" "$*"; }
err()  { printf "${c_red}✗${c_off} %s\n" "$*"; }
dim()  { printf "${c_dim}%s${c_off}\n" "$*"; }

CLEANED=0
cleanup() {
  [ "$CLEANED" = 1 ] && return
  CLEANED=1
  echo
  say "To'xtatilmoqda…"

  for pid in "${PIDS[@]:-}"; do
    [ -n "${pid:-}" ] && kill "$pid" 2>/dev/null
  done
  sleep 1
  for pid in "${PIDS[@]:-}"; do
    [ -n "${pid:-}" ] && kill -9 "$pid" 2>/dev/null
  done

  # Qolib ketganini ham yopish
  if command -v lsof >/dev/null; then
    lsof -ti:"$BACKEND_PORT" 2>/dev/null | xargs -r kill -9 2>/dev/null
  fi

  ok "Hammasi to'xtadi."
  exit 0
}
trap cleanup INT TERM

# ─────────────────────────────────────────────
# 0. Tekshiruvlar
# ─────────────────────────────────────────────
command -v node >/dev/null || { err "Node.js topilmadi. https://nodejs.org"; exit 1; }

NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
[ "$NODE_MAJOR" -lt 18 ] && { err "Node.js 18+ kerak (hozir: $(node -v))"; exit 1; }

for d in backend frontend telegram-bot; do
  [ -d "$ROOT/$d" ] || { err "$d papkasi topilmadi"; exit 1; }
done

if [ ! -f "$ROOT/telegram-bot/.env" ]; then
  err "telegram-bot/.env yo'q."
  dim "   cp telegram-bot/.env.example telegram-bot/.env"
  dim "   keyin TELEGRAM_TOKEN va TELEGRAM_BOT_USERNAME ni to'ldiring"
  exit 1
fi

if grep -q "YOUR_BOT_TOKEN_HERE" "$ROOT/telegram-bot/.env"; then
  err "telegram-bot/.env da TELEGRAM_TOKEN to'ldirilmagan."
  exit 1
fi

# Port bandmi?
if command -v lsof >/dev/null && lsof -ti:"$BACKEND_PORT" >/dev/null 2>&1; then
  warn "$BACKEND_PORT porti band. Eski jarayon yopilmoqda…"
  lsof -ti:"$BACKEND_PORT" | xargs -r kill -9 2>/dev/null
  sleep 1
fi

# ─────────────────────────────────────────────
# 1. Bog'liqliklar
# ─────────────────────────────────────────────
for d in backend frontend telegram-bot; do
  if [ ! -d "$ROOT/$d/node_modules" ]; then
    say "📦 $d — bog'liqliklar o'rnatilmoqda (bir marta)…"
    (cd "$ROOT/$d" && npm install --silent) || { err "$d: npm install muvaffaqiyatsiz"; exit 1; }
  fi
done

# frontend/.env bo'sh bo'lishi kerak — manzil avtomatik aniqlanadi
if [ -f "$ROOT/frontend/.env" ] && grep -q "^VITE_BACKEND_URL=." "$ROOT/frontend/.env"; then
  warn "frontend/.env da VITE_BACKEND_URL to'ldirilgan — telefonda ishlamaydi. Tozalanmoqda."
  echo "# Bo'sh — manzil avtomatik aniqlanadi" > "$ROOT/frontend/.env"
  rm -rf "$ROOT/frontend/dist"
fi

# ─────────────────────────────────────────────
# 2. Frontend build (kerak bo'lsa)
# ─────────────────────────────────────────────
NEEDS_BUILD=0
if [ ! -f "$ROOT/frontend/dist/index.html" ]; then
  NEEDS_BUILD=1
elif [ -n "$(find "$ROOT/frontend/src" "$ROOT/frontend/index.html" -newer "$ROOT/frontend/dist/index.html" 2>/dev/null | head -1)" ]; then
  NEEDS_BUILD=1
fi

if [ "$NEEDS_BUILD" = 1 ]; then
  say "🔨 Frontend build qilinmoqda…"
  (cd "$ROOT/frontend" && npm run build > "$LOGS/build.log" 2>&1) \
    || { err "Build muvaffaqiyatsiz. Log: $LOGS/build.log"; tail -20 "$LOGS/build.log"; exit 1; }
  ok "Build tayyor"
else
  dim "Build o'zgarmagan — o'tkazib yuborildi"
fi

# ─────────────────────────────────────────────
# 3. Backend
# ─────────────────────────────────────────────
say "🚀 Backend yoqilmoqda…"
(cd "$ROOT/backend" && PORT="$BACKEND_PORT" exec node server.js > "$BACKEND_LOG" 2>&1) &
PIDS+=($!)

for i in $(seq 1 30); do
  if curl -sf "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
    ok "Backend: http://localhost:$BACKEND_PORT"
    break
  fi
  [ "$i" = 30 ] && { err "Backend ishga tushmadi. Log:"; tail -20 "$BACKEND_LOG"; cleanup; }
  sleep 0.5
done

# ─────────────────────────────────────────────
# 4. Tunnel
# ─────────────────────────────────────────────
say "🌐 Tunnel ochilmoqda (20-40 soniya)…"
: > "$TUNNEL_LOG"

TUNNEL_CMD=""
if command -v cloudflared >/dev/null; then
  TUNNEL_CMD="cloudflared"
else
  TUNNEL_CMD="npx --yes cloudflared"
fi

( exec $TUNNEL_CMD tunnel --url "http://localhost:$BACKEND_PORT" --protocol http2 \
  > "$TUNNEL_LOG" 2>&1 ) &
PIDS+=($!)

PUBLIC_URL=""
for i in $(seq 1 90); do
  PUBLIC_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1)
  [ -n "$PUBLIC_URL" ] && break
  sleep 1
done

if [ -z "$PUBLIC_URL" ]; then
  err "Tunnel manzili olinmadi. Log: $TUNNEL_LOG"
  tail -20 "$TUNNEL_LOG"
  cleanup
fi

ok "Tunnel: $PUBLIC_URL"

# Tunnel haqiqatan javob berayaptimi
for i in $(seq 1 20); do
  curl -sf -o /dev/null "$PUBLIC_URL/health" && break
  [ "$i" = 20 ] && warn "Tunnel hali javob bermayapti — baribir davom etamiz"
  sleep 1
done

# ─────────────────────────────────────────────
# 5. Bot .env ni yangilash
# ─────────────────────────────────────────────
ENV_FILE="$ROOT/telegram-bot/.env"
cp "$ENV_FILE" "$ENV_FILE.bak"

if grep -q '^FRONTEND_URL=' "$ENV_FILE"; then
  sed -i.tmp "s|^FRONTEND_URL=.*|FRONTEND_URL=$PUBLIC_URL|" "$ENV_FILE" && rm -f "$ENV_FILE.tmp"
else
  echo "FRONTEND_URL=$PUBLIC_URL" >> "$ENV_FILE"
fi

if grep -q '^BACKEND_URL=' "$ENV_FILE"; then
  sed -i.tmp "s|^BACKEND_URL=.*|BACKEND_URL=http://localhost:$BACKEND_PORT|" "$ENV_FILE" && rm -f "$ENV_FILE.tmp"
fi

ok "Bot .env yangilandi"

# ─────────────────────────────────────────────
# 6. Bot
# ─────────────────────────────────────────────
say "🤖 Bot yoqilmoqda…"
(cd "$ROOT/telegram-bot" && exec node bot.js > "$BOT_LOG" 2>&1) &
PIDS+=($!)

BOT_NAME=""
for i in $(seq 1 40); do
  if grep -q "Bot ishga tushdi" "$BOT_LOG" 2>/dev/null; then
    BOT_NAME=$(grep -o '@[A-Za-z0-9_]*' "$BOT_LOG" | tail -1)
    break
  fi
  if grep -qi "401\|Unauthorized\|ETELEGRAM\|invalid json\|ENOTFOUND" "$BOT_LOG" 2>/dev/null; then
    err "Bot tokeni noto'g'ri yoki internet yo'q."
    dim "   telegram-bot/.env dagi TELEGRAM_TOKEN ni tekshiring."
    cleanup
  fi
  if grep -q "Bot ishga tushmadi" "$BOT_LOG" 2>/dev/null; then
    err "Bot ishga tushmadi:"
    grep -A1 "Bot ishga tushmadi" "$BOT_LOG" | head -3
    cleanup
  fi
  [ "$i" = 40 ] && { err "Bot ishga tushmadi. Log:"; tail -20 "$BOT_LOG"; cleanup; }
  sleep 0.5
done

ok "Bot: $BOT_NAME"

# ─────────────────────────────────────────────
# Tayyor
# ─────────────────────────────────────────────
echo
say "─────────────────────────────────────────"
say "  ${c_grn}Hammasi ishlayapti${c_off}"
say "─────────────────────────────────────────"
say "  Telegram:  $BOT_NAME  →  /play"
say "  Brauzer:   $PUBLIC_URL"
say "  Lokal:     http://localhost:$BACKEND_PORT"
echo
dim "  Loglar: .logs/backend.log · .logs/bot.log · .logs/tunnel.log"
dim "  To'xtatish: Ctrl+C"
say "─────────────────────────────────────────"
echo

# Backend logini jonli ko'rsatish
tail -f "$BACKEND_LOG" &
PIDS+=($!)

wait
