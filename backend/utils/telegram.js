import fs from 'fs';
import { config } from '../config.js';

const API = (method) => `https://api.telegram.org/bot${config.TELEGRAM_TOKEN}/${method}`;

const REASON_UZ = {
  checkmate: 'Mat',
  timeout: 'Vaqt tugadi',
  resignation: 'Taslim',
  draw: 'Durrang kelishuvi',
  stalemate: 'Pat',
  insufficient_material: 'Material yetarli emas',
  threefold_repetition: 'Uch marta takrorlanish',
  fifty_move_rule: '50 yurish qoidasi',
  abandoned: 'Tark etilgan'
};

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

/** O'yin tugagach ikkala o'yinchiga xabar yuboradi */
export async function notifyGameOver(game, { whiteChange = 0, blackChange = 0 } = {}) {
  if (!config.TELEGRAM_TOKEN) return;

  const reason = REASON_UZ[game.reason] || game.reason;
  const viewUrl = `${config.FRONTEND_URL}/game/${game.id}?spectate=1`;
  const markup = {
    inline_keyboard: [[{ text: "👁 O'yinni ko'rish", url: viewUrl }]]
  };

  const build = (outcome, change, oppName) => {
    const head = outcome === 'win' ? '🎉 <b>Siz yutdingiz!</b>'
               : outcome === 'loss' ? '😔 <b>Siz yutqazdingiz.</b>'
               : '🤝 <b>Durrang.</b>';
    const ratingLine = change !== 0
      ? `\n• Reyting: <b>${change > 0 ? '+' : ''}${change}</b>`
      : '';
    return `${head}\n\n• Raqib: ${oppName}\n• Sabab: ${reason}${ratingLine}`;
  };

  const tasks = [];

  if (game.whiteId) {
    const outcome = game.result === '1-0' ? 'win' : game.result === '0-1' ? 'loss' : 'draw';
    tasks.push(send(game.whiteId, build(outcome, whiteChange, game.blackName), markup));
  }

  // AI o'yinida qora tomon uchun chat yo'q
  if (game.blackId && !game.isAI) {
    const outcome = game.result === '0-1' ? 'win' : game.result === '1-0' ? 'loss' : 'draw';
    tasks.push(send(game.blackId, build(outcome, blackChange, game.whiteName), markup));
  }

  await Promise.allSettled(tasks);
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
