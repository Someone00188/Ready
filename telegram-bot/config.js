import dotenv from 'dotenv';
dotenv.config();

export const config = {
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN || 'YOUR_BOT_TOKEN_HERE',
  TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME || 'shaxmat_bot',
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3000',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3001,
  DB_PATH: process.env.DB_PATH || './chess.db',
  ADMIN_TELEGRAM_IDS: (process.env.ADMIN_TELEGRAM_IDS || '8752045573').split(',').map(s => s.trim()).filter(Boolean),
  INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET || '',
  CHANNEL_USERNAME: process.env.CHANNEL_USERNAME || 'chess_uz_channel',
  BROADCAST_MARKER: process.env.BROADCAST_MARKER || '🎲'
};

export function isAdmin(telegramId) {
  return config.ADMIN_TELEGRAM_IDS.includes(String(telegramId));
}
