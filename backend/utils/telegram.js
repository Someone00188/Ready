import fs from 'fs';
import { config } from '../config.js';

const API = (method) => `https://api.telegram.org/bot${config.TELEGRAM_TOKEN}/${method}`;

async function send(chatId, text, replyMarkup) {
  if (!config.TELEGRAM_TOKEN) return;

  const res = await fetch(API('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup
    }),
    signal: AbortSignal.timeout(15_000)
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram ${res.status}: ${body}`);
  }
}

/** Faylni (masalan, backup JSON) Telegram orqali hujjat sifatida yuboradi.
 *  Vaqtinchalik tarmoq muammolarida avtomatik qayta urinadi (3 marta, orasida kutish bilan). */
async function sendDocument(chatId, filePath, caption) {
  if (!config.TELEGRAM_TOKEN) return;

  const MAX_ATTEMPTS = 3;
  let lastErr;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const form = new FormData();
      form.append('chat_id', String(chatId));
      if (caption) form.append('caption', caption);
      form.append('document', new Blob([fs.readFileSync(filePath)]), filePath.split('/').pop());

      const res = await fetch(API('sendDocument'), { method: 'POST', body: form, signal: AbortSignal.timeout(30_000) });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Telegram sendDocument ${res.status}: ${body}`);
      }
      return; // muvaffaqiyatli
    } catch (err) {
      lastErr = err.name === 'TimeoutError'
        ? new Error('Telegram serveriga 30 soniyada javob kelmadi (tarmoq/VPN muammosi)')
        : new Error(`Telegramga ulanib bo'lmadi: ${err.message}`);

      console.error(`sendDocument urinish ${attempt}/${MAX_ATTEMPTS} muvaffaqiyatsiz:`, lastErr.message);

      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, attempt * 5000)); // 5s, keyin 10s
      }
    }
  }

  throw lastErr; // barcha urinishlar tugadi — endi chinakam xato
}

/** Raqib qo'shilganda oq tomonga xabar */
export async function notifyOpponentJoined(game) {
  if (!config.TELEGRAM_TOKEN || !game.whiteId) return;

  await send(
    game.whiteId,
    `♟ <b>${game.blackName} o'yinga qo'shildi!</b>\n\nYurishingizni qiling.`,
    { inline_keyboard: [[{ text: '♟ Taxtaga kirish', url: `${config.FRONTEND_URL}/game/${game.id}` }]] }
  ).catch(err => console.error('notifyOpponentJoined:', err.message));
}

export { send, sendDocument };
