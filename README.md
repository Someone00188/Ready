# ♟ Shaxmat — Telegram bot + WebApp

Telegram orqali real-time shaxmat. Do'st bilan yoki AI bilan.

```
telegram-bot/   Bot: komandalar, tugmalar, havolalar
backend/        Express + Socket.io + chess.js + SQLite + AI engine
frontend/       React + Vite — Telegram WebApp ichidagi taxta
```

---

## Tez ishga tushirish

Uchta terminal kerak.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

→ `http://localhost:3000`

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

→ `http://localhost:5173`

Shu bosqichda brauzerda ochib **botsiz ham** o'ynab ko'rishingiz mumkin.

### 3. HTTPS tunnel (Telegram uchun majburiy)

Telegram `web_app` tugmasi `localhost` ni qabul qilmaydi.

```bash
npx ngrok http 5173
```

Chiqqan manzilni nusxalang: `https://xxxx.ngrok-free.app`

### 4. Bot

```bash
cd telegram-bot
npm install
cp .env.example .env
```

`.env` ni to'ldiring:

```env
TELEGRAM_TOKEN=@BotFather dan olingan token
TELEGRAM_BOT_USERNAME=bot_useringiz
BACKEND_URL=http://localhost:3000
FRONTEND_URL=https://xxxx.ngrok-free.app
```

```bash
npm start
```

Telegramda botga `/start` yozing.

---

## Bot tokenini olish

1. Telegramda [@BotFather](https://t.me/BotFather) ni oching
2. `/newbot` → nom → username
3. Tokenni nusxalab `.env` ga qo'ying
4. `/setcommands` bilan komandalarni qo'shing:

```
start - Bosh menyu
play - O'yin boshlash
my_games - O'yinlarim
profile - Profil va reytinglar
stats - Statistika
leaderboard - Top o'yinchilar
help - Yordam
```

---

## Bitta bazadan foydalanish

Bot va backend bir xil `chess.db` ni ko'rishi kerak — aks holda bot `/profile` da
reytinglarni topa olmaydi. Ikkalasining `.env` ida bir xil yo'lni ko'rsating:

```env
DB_PATH=/toliq/yol/shaxmat-bot/chess.db
```

---

## Qanday ishlaydi

```
/play → rejim → vaqt yoki AI darajasi
   ↓
Bot backend'ga POST /api/games/create
   ↓
Havola: t.me/bot?start=<gameId>
   ↓
Do'st havolani bosadi → bot uni o'yinga qo'shadi
   ↓
"Taxtaga kirish" → WebApp ochiladi → Socket.io orqali real-time
   ↓
O'yin tugadi → backend reytingni yangilaydi va ikkalasiga xabar yuboradi
```

Uchinchi odam havolani ochsa — **kuzatuvchi** bo'ladi, yura olmaydi.

---

## Vaqt rejimlari

Qo'shimcha vaqt (increment) yo'q. Vaqti tugagan yutqazadi.

| Guruh | Variantlar |
|---|---|
| Bullet | 1, 3, 5 daqiqa |
| Normal | 10, 20, 30 daqiqa |
| Uzoq | 1 soat, 1 kun |
| AI | vaqt cheklovsiz |

## AI

Stockfish emas — o'z engine'imiz: minimax + alpha-beta + piece-square jadvallar +
iterative deepening. Tashqi bog'liqlik yo'q, WASM muammosi yo'q.

| Daraja | Chuqurlik | Vaqt | Tasodifiy xato |
|---|---|---|---|
| Yangi | 1 | 0.3s | 45% |
| O'rta | 2 | 0.6s | 25% |
| Yaxshi | 3 | 1.2s | 10% |
| Ekspert | 4 | 2.5s | 3% |
| Usta | 6 | 5s | 0% |

## Reyting

ELO, har vaqt guruhi uchun alohida. K faktor: <30 o'yin → 40, <100 → 25, keyin 16.
AI o'yinlari statistikaga kiradi, lekin reytingga ta'sir qilmaydi.

---

## Ishlab chiqarishga chiqarish

Frontend statik — Vercel/Netlify/Cloudflare Pages ga mos.
Backend va bot — Fly.io yoki Railway.

SQLite Fly.io da volume talab qiladi:

```bash
fly volumes create chess_data --size 1
```

`fly.toml` da mount qiling va `DB_PATH=/data/chess.db` qo'ying.
Aks holda har deploy da baza yo'qoladi.

---

## Bitta buyruq bilan ishga tushirish

```bash
./start.sh
```

Skript o'zi qiladi:
1. Bog'liqliklarni o'rnatadi (birinchi marta)
2. Frontend o'zgargan bo'lsa build qiladi
3. Backend'ni yoqadi
4. Tunnel ochadi va **manzilni avtomatik `telegram-bot/.env` ga yozadi**
5. Botni yoqadi

To'xtatish: `Ctrl+C` — uchalasi ham to'xtaydi.

Biror narsa qolib ketsa:
```bash
./stop.sh
```

Birinchi marta ishlatishdan oldin faqat bir marta:
```bash
cp telegram-bot/.env.example telegram-bot/.env
nano telegram-bot/.env      # TELEGRAM_TOKEN va TELEGRAM_BOT_USERNAME
```

`FRONTEND_URL` ni qo'lda yozish shart emas — skript har safar o'zi yangilaydi.
