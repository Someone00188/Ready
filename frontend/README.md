# ♟ Shaxmat Frontend

React + Vite + socket.io-client. Telegram WebApp ichida yoki oddiy brauzerda ishlaydi.

## Ishga tushirish

```bash
npm install
cp .env.example .env      # VITE_BACKEND_URL ni sozlang
npm run dev
```

Ochish: `http://localhost:5173`

Brauzerda test qilishda Telegram user bo'lmagani uchun avtomatik `dev*****` id beriladi.
Ikkinchi o'yinchini sinash uchun boshqa brauzer profili yoki `?uid=12345` bilan oching.

## Telegram WebApp uchun HTTPS kerak

`web_app` tugmasi `http://localhost` ni qabul qilmaydi. Lokal test:

```bash
npx ngrok http 5173
```

Chiqqan `https://xxxx.ngrok-free.app` manzilini botning `FRONTEND_URL` iga qo'ying.
`vite.config.js` da `allowedHosts: true` allaqachon yoqilgan.

## Struktura

```
src/
├── main.jsx                    Kirish nuqtasi
├── App.jsx                     Marshrutlar
├── pages/
│   ├── HomePage.jsx            Rejim, vaqt, AI darajasi, tema tanlash
│   └── GamePage.jsx            O'yin ekrani
├── components/
│   ├── ChessBoard.jsx          Taxta, click-to-move, piyoda almashtirish
│   ├── PlayerBar.jsx           Ism + soat
│   ├── MoveList.jsx            Yurishlar ro'yxati
│   └── GameOverModal.jsx       Natija oynasi
├── hooks/
│   ├── useTelegram.js          Telegram SDK (brauzerga ham moslashadi)
│   └── useGame.js              Socket.io ulanishi
└── styles/index.css            Temalar va layout
```

## Temalar

Bosh sahifada tanlanadi, `localStorage` da saqlanadi.

| Tema | Yorug' katak | Qorong'i katak |
|---|---|---|
| Yashil (standart) | `#eeeed2` | `#769656` |
| Klassik | `#f0d9b5` | `#b58863` |
| Kulrang | `#d8d8d8` | `#565352` |

Interfeys qorong'i (`#262421`) — Telegram tungi rejimi bilan mos.

## Qanday yuriladi

Katakni bosasiz → mumkin yurishlar nuqta bilan ko'rsatiladi → nishonni bosasiz.
Yeb olish mumkin bo'lgan katak halqa bilan belgilanadi.
Piyoda oxirgi qatorga yetganda qaysi donaga aylantirish so'raladi.

## Muhim

Qoidalar **serverda** tekshiriladi. Bu yerdagi `chess.js` faqat yurish nuqtalarini
chizish uchun — noqonuniy yurish yuborilsa ham server rad etadi.

Taxta doim o'yinchi tomonidan ko'rsatiladi: qora o'ynasangiz taxta aylantiriladi.

## Build

```bash
npm run build      # dist/ papkasi
npm run preview    # build ni sinash
```
