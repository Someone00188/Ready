import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { config } from './config.js';
import { initDatabase, closeDb } from './db/database.js';
import { startBackupScheduler, restoreFromTelegramIfNeeded } from './services/backup-telegram.js';
import gamesRouter from './api/games.js';
import usersRouter from './api/users.js';
import adminRouter from './api/admin.js';
import { registerSocketHandlers } from './websocket/handlers.js';
import * as gm from './game/gameManager.js';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'], credentials: false },
  // Tunnel orqali ulanish uchun bardoshli sozlamalar
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 25000,
  pingInterval: 20000,
  connectTimeout: 25000,
  maxHttpBufferSize: 1e6
});

app.use(cors());
app.use(express.json());

// Sog'liq tekshiruvi
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    uptime: Math.round(process.uptime()),
    activeGames: gm.games.size,
    env: config.NODE_ENV
  });
});

app.use('/api/games', gamesRouter);
app.use('/api/users', usersRouter);
app.use('/api/admin', adminRouter);

// ===== Frontend'ni shu serverdan tarqatish =====
// frontend/dist mavjud bo'lsa, taxta ham shu portdan ochiladi.
// Shunda bitta tunnel yetarli — telefon uchun ham.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '../frontend/dist');

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
  console.log('📦 Frontend tarqatilmoqda: ../frontend/dist');
}

// 404
app.use((req, res) => res.status(404).json({ error: 'Topilmadi' }));

// Xatolar
app.use((err, req, res, next) => {
  console.error('Server xatosi:', err);
  res.status(500).json({ error: config.NODE_ENV === 'production' ? 'Server xatosi' : err.message });
});

// start-combined.js webhook o'rnatilgach shu yerga qo'l tegizadi (bot.js ni
// import qilib, app'ga webhookCallback qo'shadi). server.js yolg'iz ishga
// tushganda (masalan faqat backend kerak bo'lganda) buni chaqirmaydi — bu holda
// webhookSetup null bo'lib qoladi va hech narsa buzilmaydi.
let webhookSetup = null;
export function onReadyForWebhook(fn) {
  webhookSetup = fn;
}

export async function start() {
  await initDatabase();
  console.log('✅ Database ready');

  // 🆕 Telegram backup: restore from channel if needed + start scheduler
  if (config.NODE_ENV === 'production') {
    console.log('🔍 Telegram backup xizmatini tekshirilmoqda...');
    await restoreFromTelegramIfNeeded().catch(err => {
      console.warn('⚠️  Startup restore xatosi (server davom etadi):', err.message);
    });
    startBackupScheduler();
  } else {
    console.log('ℹ️  Dev mode — Telegram backup disabled');
  }

  registerSocketHandlers(io);

  // Bot webhook'i POST bo'lgani uchun yuqoridagi GET catch-all bilan
  // to'qnashmaydi — Express metod bo'yicha ham moslashtiradi.
  if (webhookSetup) {
    try {
      await webhookSetup(app);
    } catch (err) {
      console.error('⚠️  Bot webhook o\'rnatilmadi:', err.message);
    }
  }

  await new Promise((resolve) => {
    server.listen(config.PORT, () => {
      console.log(`\n🚀 Backend: http://localhost:${config.PORT}`);
      console.log(`   Health:  http://localhost:${config.PORT}/health`);
      console.log(`   Rejim:   ${config.NODE_ENV}`);
      console.log(`   Telegram: ${config.TELEGRAM_TOKEN ? 'yoqilgan' : "o'chirilgan (TOKEN yo'q)"}`);
      console.log(`   Backup:   ${config.BACKUP_CHANNEL_ID ? 'yoqilgan' : "o'chirilgan (CHANNEL_ID yo'q)\n"}`);
      resolve();
    });
  });
}

// server.js yagona/mustaqil ishga tushirilganda (masalan faqat backend kerak
// bo'lganda, start-combined.js ishlatilmasdan) o'zi avtomatik boshlanadi.
// start-combined.js esa buni chaqirmaydi — o'rniga start() ni o'zi, to'g'ri
// tartibda (avval onReadyForWebhook ro'yxatga olingach) chaqiradi. Shu bilan
// "webhook hook hali ro'yxatga olinmagan paytda start() allaqachon ishga
// tushib ketishi" degan poyga holati (race condition) butunlay yo'qoladi.
const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  start().catch(err => {
    console.error('❌ Server ishga tushmadi:', err);
    process.exit(1);
  });
}

function shutdown() {
  console.log('\nO\'chirilmoqda...');
  io.close();
  server.close(() => { closeDb(); process.exit(0); });
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app, io, server };
