import dotenv from 'dotenv';
dotenv.config();

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  DB_PATH: process.env.DB_PATH || './chess.db',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN || '',
  ADMIN_TELEGRAM_IDS: (process.env.ADMIN_TELEGRAM_IDS || '8752045573').split(',').map(s => s.trim()).filter(Boolean),
  INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET || '',
  CHANNEL_USERNAME: process.env.CHANNEL_USERNAME || 'chess_uz_channel',
  BROADCAST_MARKER: process.env.BROADCAST_MARKER || '🎲',
  // 🆕 Telegram backup channel (yopiq admin channel)
  BACKUP_CHANNEL_ID: process.env.BACKUP_CHANNEL_ID || ''
};

// Vaqt rejimlari (millisekundda). Increment yo'q — eski (Quick Play/AI) rejimlar.
export const TIME_CONTROLS = {
  bullet_1: 60_000,
  bullet_3: 180_000,
  bullet_5: 300_000,
  normal_10: 600_000,
  normal_20: 1_200_000,
  normal_30: 1_800_000,
  long_1h: 3_600_000,
  long_1d: 86_400_000,
  ai: null            // AI o'yinida vaqt chegarasi yo'q
};

// Create Match uchun standart kategoriyalar — increment (soniya) bilan.
// Nomlash: <category>_<baseMinutes>_<incrementSeconds>
export const MATCH_TIME_CONTROLS = {
  bullet_1_0:    { category: 'bullet',    baseMs: 60_000,     incrementMs: 0,     label: 'Bullet · 1+0' },
  bullet_2_1:    { category: 'bullet',    baseMs: 120_000,    incrementMs: 1_000, label: 'Bullet · 2+1' },
  blitz_3_0:     { category: 'blitz',     baseMs: 180_000,    incrementMs: 0,     label: 'Blitz · 3+0' },
  blitz_3_2:     { category: 'blitz',     baseMs: 180_000,    incrementMs: 2_000, label: 'Blitz · 3+2' },
  blitz_5_0:     { category: 'blitz',     baseMs: 300_000,    incrementMs: 0,     label: 'Blitz · 5+0' },
  rapid_10_0:    { category: 'rapid',     baseMs: 600_000,    incrementMs: 0,     label: 'Rapid · 10+0' },
  rapid_15_10:   { category: 'rapid',     baseMs: 900_000,    incrementMs: 10_000, label: 'Rapid · 15+10' },
  rapid_30_0:    { category: 'rapid',     baseMs: 1_800_000,  incrementMs: 0,     label: 'Rapid · 30+0' },
  classical_60_0:  { category: 'classical', baseMs: 3_600_000,  incrementMs: 0,     label: 'Classical · 60+0' },
  classical_90_30: { category: 'classical', baseMs: 5_400_000,  incrementMs: 30_000, label: 'Classical · 90+30' }
};

const MAX_CUSTOM_MINUTES = 180;      // 3 soatgacha
const MAX_CUSTOM_INCREMENT_SEC = 60; // 60 soniyagacha increment

/**
 * timeMode'ni {baseMs, incrementMs, category} ko'rinishiga o'giradi.
 * Qo'llab-quvvatlaydi: eski TIME_CONTROLS kalitlari, MATCH_TIME_CONTROLS kalitlari,
 * va "custom_<daqiqa>_<incrementSoniya>" (masalan "custom_15_10").
 * Noto'g'ri/nomaqbul bo'lsa — null qaytaradi.
 */
export function resolveTimeControl(timeMode) {
  if (timeMode === 'ai') return { baseMs: null, incrementMs: 0, category: 'ai' };

  if (timeMode in MATCH_TIME_CONTROLS) {
    const t = MATCH_TIME_CONTROLS[timeMode];
    return { baseMs: t.baseMs, incrementMs: t.incrementMs, category: t.category };
  }

  if (timeMode in TIME_CONTROLS) {
    const ms = TIME_CONTROLS[timeMode];
    const category = String(timeMode).split('_')[0]; // bullet | normal | long
    return { baseMs: ms, incrementMs: 0, category };
  }

  const m = /^custom_(\d+)_(\d+)$/.exec(String(timeMode));
  if (m) {
    const minutes = parseInt(m[1], 10);
    const incSec = parseInt(m[2], 10);
    if (minutes < 1 || minutes > MAX_CUSTOM_MINUTES) return null;
    if (incSec < 0 || incSec > MAX_CUSTOM_INCREMENT_SEC) return null;

    // Reyting toifasini vaqtga qarab chess.com uslubida taqsimlaymiz
    let category = 'classical';
    if (minutes < 3) category = 'bullet';
    else if (minutes < 10) category = 'blitz';
    else if (minutes < 30) category = 'rapid';

    return { baseMs: minutes * 60_000, incrementMs: incSec * 1000, category };
  }

  return null;
}

// AI murakkablik darajalari
// depth — maksimal chuqurlik, timeMs — o'ylash uchun vaqt byudjeti
export const AI_LEVELS = {
  1: { depth: 1, timeMs: 300,  randomness: 0.45, label: 'Yangi' },
  2: { depth: 2, timeMs: 600,  randomness: 0.25, label: "O'rta" },
  3: { depth: 3, timeMs: 1200, randomness: 0.10, label: 'Yaxshi' },
  4: { depth: 4, timeMs: 2500, randomness: 0.03, label: 'Ekspert' },
  5: { depth: 6, timeMs: 5000, randomness: 0.00, label: 'Usta' }
};

export function ratingColumn(timeMode) {
  const resolved = resolveTimeControl(timeMode);
  const category = resolved?.category || String(timeMode).split('_')[0];

  if (category === 'bullet' || category === 'blitz') return 'rating_bullet';
  if (category === 'normal' || category === 'rapid') return 'rating_normal';
  if (category === 'long' || category === 'classical') return 'rating_long';
  return null;            // ai → reyting o'zgarmaydi
}
