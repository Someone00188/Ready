# Botni o'z kompyuteringizda ishga tushirish

Kerak bo'ladi: **Node.js 18+**, **3 ta terminal oynasi**, **Telegram**.

Tekshirish:
```bash
node -v
```
`v18` yoki undan yuqori bo'lsa yaxshi. Bo'lmasa: https://nodejs.org

---

## 1. Bot tokenini oling

1. Telegramda **@BotFather** ni oching
2. `/newbot` yuboring
3. Botga nom bering: `Shaxmat`
4. Username bering: `sizning_shaxmat_bot` (`_bot` bilan tugashi shart)
5. **Tokenni nusxalang** — `8123456789:AAH...` ko'rinishida

---

## 2. Backend (1-terminal)

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Ko'rinishi kerak:
```
✅ SQLite ulandi: ./chess.db
🚀 Backend: http://localhost:3000
```

**Bu terminalni yopmang.**

---

## 3. Frontend (2-terminal)

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Ko'rinishi kerak:
```
➜  Local:   http://localhost:5173/
```

Brauzerda oching — taxta ko'rinishi kerak. **Bu terminalni ham yopmang.**

---

## 4. HTTPS tunnel (3-terminal)

Telegram `localhost` ni qabul qilmaydi — WebApp tugmasi ochilmaydi.
Shuning uchun tunnel kerak.

```bash
npx ngrok http 5173
```

Birinchi marta ngrok akkaunt so'rashi mumkin — https://ngrok.com da bepul ro'yxatdan
o'tib, `ngrok config add-authtoken <token>` qiling.

Chiqadi:
```
Forwarding  https://a1b2-93-184-16-2.ngrok-free.app -> http://localhost:5173
```

**Shu `https://...` manzilni nusxalang.** Bu terminalni ham yopmang.

> ngrok manzili har safar qayta ishga tushirilganda o'zgaradi.
> O'zgargach botning `.env` ini yangilab, botni qayta ishga tushiring.

---

## 5. Bot (4-terminal)

```bash
cd telegram-bot
npm install
cp .env.example .env
```

Endi `.env` ni tahrirlang:

```env
TELEGRAM_TOKEN=8123456789:AAH...              # 1-bosqichdagi token
TELEGRAM_BOT_USERNAME=sizning_shaxmat_bot     # @ belgisisiz
BACKEND_URL=http://localhost:3000
FRONTEND_URL=https://a1b2-93-184-16-2.ngrok-free.app   # 4-bosqichdagi manzil
```

```bash
npm start
```

Ko'rinishi kerak:
```
✅ Backend ulandi (http://localhost:3000)
✅ Bot ishga tushdi: @sizning_shaxmat_bot
```

---

## 6. Sinab ko'ring

Telegramda botingizni oching → `/start` → `/play`

**AI bilan:** darajani tanlang → "O'yinni boshlash" → taxta ochiladi.

**Do'st bilan:** vaqtni tanlang → havola chiqadi → do'stingizga yuboring.
O'zingiz sinash uchun havolani boshqa Telegram akkauntingizga yuboring.

---

## Xatolar va yechimlar

**`⚠️ Backend javob bermayapti`**
Backend terminali ishlayaptimi? `curl localhost:3000/health` bilan tekshiring.

**`⚠️ FRONTEND_URL HTTPS emas`**
`.env` da `http://localhost:5173` qolib ketgan. ngrok manzilini qo'ying.

**Tugma bosilganda hech narsa ochilmaydi**
ngrok o'chgan yoki manzil o'zgargan. ngrok'ni qayta ishga tushiring,
yangi manzilni `.env` ga yozing, botni qayta ishga tushiring.

**`409 Conflict` xatosi**
Bot ikki marta ishga tushgan. Barcha `node bot.js` jarayonlarini yoping.

**ngrok sahifasida "Visit Site" tugmasi chiqadi**
Bepul ngrok'da normal holat. Bir marta bosiladi.
Buni yo'qotish uchun Cloudflare Tunnel ishlating:
```bash
npx cloudflared tunnel --url http://localhost:5173
```

**Taxta ochiladi, lekin "Serverga ulanilmoqda" da qotib qoladi**
Frontend backend'ga ulana olmayapti. `frontend/.env` da
`VITE_BACKEND_URL` to'g'rimi tekshiring va frontend'ni qayta ishga tushiring.

> Diqqat: telefon ngrok orqali frontendga kiradi, lekin frontend
> `localhost:3000` ga ulanmoqchi bo'ladi — telefonda bunday manzil yo'q.
> Shuning uchun **backend uchun ham tunnel kerak**. Quyiga qarang.

---

## Telefondan o'ynash uchun (muhim)

Frontend brauzerda ochilganda backend'ga ulanadi. Telefon uchun
`localhost:3000` mavjud emas, shuning uchun backendga ham tunnel kerak.

**5-terminal:**
```bash
npx ngrok http 3000
```

Chiqqan manzilni `frontend/.env` ga yozing:
```env
VITE_BACKEND_URL=https://c3d4-93-184-16-2.ngrok-free.app
```

Frontend'ni qayta ishga tushiring (`Ctrl+C`, keyin `npm run dev`).

**Yoki bitta tunnel bilan:** frontendni backend orqali tarqating —
`backend/server.js` ga qo'shing:

```js
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// API marshrutlaridan KEYIN, 404 handler'dan OLDIN:
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});
```

Keyin:
```bash
cd frontend && npm run build
cd ../backend && npm run dev
npx ngrok http 3000        # bitta tunnel yetarli
```

`FRONTEND_URL` va `VITE_BACKEND_URL` — ikkalasi ham shu bitta ngrok manzili bo'ladi.

---

## Kompyuter o'chsa

Hammasi to'xtaydi — bu normal, lokal server shunday ishlaydi.
Doimiy ishlashi uchun Fly.io yoki Railway'ga joylashtirish kerak.
Buni keyinroq qilamiz.
