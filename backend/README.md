# ♟ Shaxmat Backend

Express + Socket.io + chess.js + SQLite. AI engine — o'z minimax'imiz (tashqi bog'liqliksiz).

## Ishga tushirish

```bash
npm install
cp .env.example .env      # TELEGRAM_TOKEN qo'ying (ixtiyoriy)
npm run dev
```

Server: `http://localhost:3000` · Health: `/health`

## Struktura

```
backend/
├── server.js              Express + Socket.io ishga tushirish
├── config.js              Vaqt rejimlari, AI darajalari
├── game/
│   ├── Game.js            O'yin holati, soat, qoidalar, tugash shartlari
│   ├── engine.js          AI: minimax + alpha-beta + iterative deepening
│   └── gameManager.js     Faol o'yinlar, tugatish, reyting
├── db/
│   ├── database.js        SQLite + promise wrapperlar
│   └── queries.js         CRUD
├── api/
│   ├── games.js           /api/games/*
│   └── users.js           /api/users/*
├── websocket/handlers.js  Socket.io eventlari
└── utils/
    ├── ratings.js         ELO
    └── telegram.js        Bot orqali xabar yuborish
```

## REST API

| Metod | Yo'l | Tavsif |
|---|---|---|
| POST | `/api/games/create` | O'yin yaratish |
| POST | `/api/games/:id/join` | Qo'shilish (o'yinchi yoki kuzatuvchi) |
| GET | `/api/games/:id` | O'yin holati (faol yoki arxiv) |
| GET | `/api/games/:id/moves` | Yurishlar tarixi |
| GET | `/api/games/:id/legal?square=e2` | Mumkin yurishlar |
| GET | `/api/users/:id` | Profil |
| GET | `/api/users/:id/games` | O'yinlar tarixi |
| GET | `/api/users/:id/stats` | Statistika |
| GET | `/api/users/leaderboard/:mode` | Top o'yinchilar |

## Socket.io eventlari

**Client → Server:** `join_game`, `move`, `get_legal_moves`, `resign`, `draw_offer`, `accept_draw`, `decline_draw`, `sync`

**Server → Client:** `game_state`, `move_made`, `invalid_move`, `game_over`, `clock_update`, `draw_offered`, `draw_declined`, `player_joined`, `spectator_joined`, `ai_thinking`, `error_msg`

## Vaqt rejimlari

Increment yo'q. Vaqti tugagan yutqazadi.

`bullet_1` `bullet_3` `bullet_5` · `normal_10` `normal_20` `normal_30` · `long_1h` `long_1d` · `ai` (soatsiz)

## AI darajalari

| Daraja | Chuqurlik | Vaqt | Tasodifiylik |
|---|---|---|---|
| 1 Yangi | 1 | 0.3s | 45% |
| 2 O'rta | 2 | 0.6s | 25% |
| 3 Yaxshi | 3 | 1.2s | 10% |
| 4 Ekspert | 4 | 2.5s | 3% |
| 5 Usta | 6 | 5s | 0% |

Tasodifiylik — AI ba'zan ataylab eng yaxshi bo'lmagan yurishni tanlaydi, inson kabi.

## Reyting

ELO, har vaqt rejimi uchun alohida (`rating_bullet`, `rating_normal`, `rating_long`).
K faktor: <30 o'yin → 40, <100 → 25, aks holda 16. AI o'yinlari reytingga ta'sir qilmaydi.

## Bot bilan bog'lash

`TELEGRAM_TOKEN` berilsa, backend o'yin tugagach va raqib qo'shilganda o'yinchilarga to'g'ridan-to'g'ri xabar yuboradi.
Bot va backend bitta `chess.db` faylidan foydalanishi mumkin — `DB_PATH` ni ikkalasida bir xil qiling.
