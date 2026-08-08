import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { config } from '../config.js';
import * as q from '../db/queries.js';
import { createBackup, restoreBackup, validateBackupFile, INCOMING_DIR } from '../db/backup.js';
import { sendDocument } from '../utils/telegram.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ===== Himoya =====
// Bu endpointlar faqat bot jarayoni (telegram-bot) tomonidan chaqiriladi, tashqi
// foydalanuvchilar uchun emas. Shuning uchun ikki bosqichli tekshiruv:
// 1) X-Internal-Secret sarlavhasi ADMIN_INTERNAL_API_SECRET bilan mos kelishi kerak
// 2) X-Admin-Id sarlavhasidagi Telegram ID ADMIN_TELEGRAM_IDS ro'yxatida bo'lishi kerak
function requireInternalAdmin(req, res, next) {
  const secret = req.get('X-Internal-Secret');
  const adminId = req.get('X-Admin-Id');

  if (!config.INTERNAL_API_SECRET) {
    return res.status(503).json({ error: 'INTERNAL_API_SECRET sozlanmagan (.env)' });
  }
  if (!secret || secret !== config.INTERNAL_API_SECRET) {
    return res.status(401).json({ error: 'Ruxsat yo\'q' });
  }
  if (!adminId || !config.ADMIN_TELEGRAM_IDS.includes(String(adminId))) {
    return res.status(403).json({ error: 'Faqat administrator' });
  }
  req.adminId = String(adminId);
  next();
}

router.use(requireInternalAdmin);

// ===== Statistika =====
router.get('/stats', async (req, res) => {
  try {
    const [totalUsers, newToday, newWeek, totalBroadcasts] = await Promise.all([
      q.countUsers(),
      q.countUsersToday(),
      q.countUsersThisWeek(),
      q.countBroadcasts()
    ]);

    res.json({ totalUsers, newToday, newWeek, totalBroadcasts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    res.json(await q.listRecentUsers(limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/backups', async (req, res) => {
  try {
    res.json(await q.listRecentBackupLogs(20));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Broadcast (kanaldagi belgili post yoki panel orqali) =====
router.post('/broadcast', async (req, res) => {
  try {
    const { type, text, fileId, caption, source = 'panel' } = req.body;
    const ids = await q.getAllTelegramIds();

    let sent = 0;
    for (const chatId of ids) {
      try {
        if (type === 'text') {
          await fetch(`https://api.telegram.org/bot${config.TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text })
          });
        } else if (type === 'photo') {
          await fetch(`https://api.telegram.org/bot${config.TELEGRAM_TOKEN}/sendPhoto`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, photo: fileId, caption })
          });
        } else if (type === 'video') {
          await fetch(`https://api.telegram.org/bot${config.TELEGRAM_TOKEN}/sendVideo`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, video: fileId, caption })
          });
        }
        sent++;
      } catch { /* bitta userga yetmasa ham davom etamiz */ }
    }

    await q.insertBroadcast(type, text || caption || null, sent, source);
    res.json({ ok: true, sent, total: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Contact Admin (xabar yo'naltirish uchun mapping) =====
router.post('/contact-thread', express.json(), async (req, res) => {
  try {
    const { adminMsgId, userTelegramId } = req.body;
    if (!adminMsgId || !userTelegramId) return res.status(400).json({ error: 'majburiy maydonlar yetishmayapti' });
    await q.insertContactThread(adminMsgId, userTelegramId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/contact-thread/:adminMsgId', async (req, res) => {
  try {
    const row = await q.getContactThread(req.params.adminMsgId);
    if (!row) return res.status(404).json({ error: 'topilmadi' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Backup =====
router.post('/backup', async (req, res) => {
  try {
    const result = await createBackup({ triggeredBy: req.adminId, source: 'panel' });

    const caption =
      `✅ Backup muvaffaqiyatli yaratildi.\n` +
      `Fayl nomi: ${result.fileName}\n` +
      `Hajmi: ${(result.sizeBytes / (1024 * 1024)).toFixed(2)} MB\n` +
      `Foydalanuvchilar: ${result.counts.users ?? 0} ta\n` +
      `Backup vaqti: ${(result.durationMs / 1000).toFixed(1)} soniya`;

    let sendError = null;
    try {
      await sendDocument(req.adminId, result.filePath, caption);
    } catch (err) {
      sendError = err.message;
      console.error('Backup faylini yuborishda xato:', err.message);
    }

    res.json({ ok: true, sent: !sendError, sendError, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ===== Restore: 1) fayl yuklanadi va tekshiriladi =====
// Body: xom JSON bayt oqimi (Content-Type: application/octet-stream)
router.post('/restore/validate', express.raw({ type: 'application/octet-stream', limit: '150mb' }), async (req, res) => {
  try {
    fs.mkdirSync(INCOMING_DIR, { recursive: true });
    const token = crypto.randomBytes(12).toString('hex');
    const filePath = path.join(INCOMING_DIR, `${token}.json`);
    fs.writeFileSync(filePath, req.body);

    const check = await validateBackupFile(filePath);
    if (!check.valid) {
      fs.unlinkSync(filePath);
      return res.json({ valid: false, errors: check.errors });
    }

    res.json({ valid: true, token, meta: check.meta, counts: check.counts, tableCount: check.tableCount });
  } catch (err) {
    res.status(500).json({ valid: false, errors: [err.message] });
  }
});

// ===== Restore: 2) admin tasdiqlagach amalga oshiriladi =====
router.post('/restore/confirm', express.json(), async (req, res) => {
  const { token } = req.body;
  if (!token || !/^[a-f0-9]{24}$/.test(token)) {
    return res.status(400).json({ ok: false, error: "Noto'g'ri token" });
  }

  const filePath = path.join(INCOMING_DIR, `${token}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ ok: false, error: 'Fayl topilmadi yoki muddati o\'tgan' });
  }

  try {
    const result = await restoreBackup(filePath, { triggeredBy: req.adminId });
    fs.unlinkSync(filePath);

    // MUHIM: Restore DB faylini to'g'ridan-to'g'ri yangiladi (bot va sayt bir
    // xil chess.db'dan foydalanadi — alohida "saytga ham yozish" degan narsa
    // yo'q). Lekin brauzerdagi ochiq sahifalar, gameManager'dagi xotiradagi
    // holat va boshqa keshlar hali eski (restore'dan oldingi) ma'lumotni
    // ko'rsatib turishi mumkin edi — aynan shu narsa "botda restore bo'ldi,
    // saytda 0 ko'rinyapti" degan holatga o'xshab ko'rinishi mumkin edi.
    // Shu sabab restore tugagach barcha ulangan clientlarga signal beramiz —
    // frontend buni eshitib joriy sahifani (statistika/reyting/tarix)
    // avtomatik qayta so'raydi.
    const io = req.app.get('io');
    if (io) io.emit('data_restored', { source: 'admin_panel', ...result });

    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, safetyBackup: err.safetyBackup?.fileName });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

export default router;
