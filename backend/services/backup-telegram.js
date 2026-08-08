// backend/services/backup-telegram.js
//
// Telegram orqali backup: SQLite'ni compress qilip, admin channel'ga yuborish.
// Render'da ephemeral disk'da saqlab turilmasa — Telegram'da doimiy qolib turadi.

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from '../config.js';
import { createBackup } from '../db/backup.js';

const execAsync = promisify(exec);

const BACKUP_CHANNEL_ID = process.env.BACKUP_CHANNEL_ID || config.BACKUP_CHANNEL_ID;
if (!BACKUP_CHANNEL_ID) {
  console.warn('⚠️  BACKUP_CHANNEL_ID muhim emas — Telegram backup o\'chirildi');
}

const TELEGRAM_API = 'https://api.telegram.org/bot';
// Render Free 15 daqiqadan keyin uxlaydi — UptimeRobot ping bilan xizmat
// deyarli doim uyg'oq tursa ham, oldingi "har soat" interval yo'qotish
// oynasini keraksiz kattalashtirar edi. 15 daqiqaga tushirildi.
const BACKUP_SCHEDULE_INTERVAL = 15 * 60 * 1000;
const MAX_LOCAL_BACKUPS = 5; // Ko'pi bilan 5 ta lokal backup saqlash (disk o'chib ketganda)

/**
 * Backup'ni tar.gz'ga compress qiladi
 */
async function compressBackup(backupFilePath) {
  const dir = path.dirname(backupFilePath);
  const filename = path.basename(backupFilePath);
  const gzPath = path.join(dir, `${filename}.tar.gz`);

  try {
    // gzip -9: eng kuchli compression (lokal backup uchun)
    await execAsync(`cd "${dir}" && gzip -9 -c "${filename}" > "${path.basename(gzPath)}"`, {
      timeout: 30000,
      maxBuffer: 50 * 1024 * 1024
    });
    return gzPath;
  } catch (err) {
    console.error('❌ Compression xatosi:', err.message);
    throw err;
  }
}

/**
 * Compressed backup'ni Telegram admin channel'ga yuboradi
 */
async function sendBackupToTelegram(compressedPath, fileName) {
  if (!config.TELEGRAM_TOKEN || !BACKUP_CHANNEL_ID) {
    console.warn('⚠️  TELEGRAM_TOKEN yoki BACKUP_CHANNEL_ID topilmadi, Telegram backup skip');
    return null;
  }

  try {
    const fileSize = fs.statSync(compressedPath).size;
    const sizeMb = (fileSize / (1024 * 1024)).toFixed(2);

    if (fileSize > 50 * 1024 * 1024) {
      console.warn(`⚠️  Backup juda katta (${sizeMb} MB), Telegram'ga yuborilmadi (50 MB limit)`);
      return null;
    }

    const formData = new FormData();
    formData.append('chat_id', BACKUP_CHANNEL_ID);
    formData.append('document', new File([fs.readFileSync(compressedPath)], path.basename(compressedPath)));
    formData.append('caption', `🔒 Backup: ${fileName}\n📦 Hajm: ${sizeMb} MB\n⏰ Vaqt: ${new Date().toISOString()}`);

    const response = await fetch(`${TELEGRAM_API}${config.TELEGRAM_TOKEN}/sendDocument`, {
      method: 'POST',
      body: formData,
      timeout: 60000
    });

    const result = await response.json();

    if (!result.ok) {
      throw new Error(result.description || 'Telegram API xatosi');
    }

    console.log(`✅ Backup Telegram'ga yuborildi: ${fileName}`);
    return result.result.file_id;
  } catch (err) {
    console.error('❌ Telegram backup yuborish xatosi:', err.message);
    throw err;
  }
}

/**
 * Lokal backup'larni tozalaydi (ko'pi bilan MAX_LOCAL_BACKUPS qoladi)
 */
function cleanupOldBackups(backupDir) {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json.tar.gz'))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    // Eski backup'larni o'chirish
    for (let i = MAX_LOCAL_BACKUPS; i < files.length; i++) {
      fs.unlinkSync(files[i].path);
      console.log(`🗑️  Eski backup o'chirildi: ${files[i].name}`);
    }
  } catch (err) {
    console.error('⚠️  Lokal backup cleanup xatosi:', err.message);
  }
}

/**
 * To'liq backup jarayoni: SQLite → compress → Telegram
 */
export async function performTelegramBackup() {
  try {
    console.log('📦 Backup jarayoni boshlanmoqda...');

    // 1. SQLite backup yaratish
    const { filePath: backupPath, fileName } = await createBackup({
      triggeredBy: 'auto_telegram_scheduler',
      source: 'telegram'
    });

    // 2. Compress qilish
    const compressedPath = await compressBackup(backupPath);

    // 3. Telegram'ga yuborish
    const fileId = await sendBackupToTelegram(compressedPath, fileName);

    // 4. Eski backup'larni tozalash (lokal disk'ni samarali ishlatish)
    const backupDir = path.dirname(backupPath);
    cleanupOldBackups(backupDir);

    // 5. Compressed fayl o'chirish (Telegram'da saqlangan, local'da kerak emas)
    fs.unlinkSync(compressedPath);

    console.log("✅ Backup to'liq bo'ldi");
    return { success: true, fileName, fileId, timestamp: new Date().toISOString() };
  } catch (err) {
    console.error('❌ Backup xatosi:', err.message);
    return { success: false, error: err.message, timestamp: new Date().toISOString() };
  }
}

/**
 * Telegram'dan eng yangi backup'ni download qiladi
 */
export async function downloadLatestBackupFromTelegram() {
  if (!config.TELEGRAM_TOKEN || !BACKUP_CHANNEL_ID) {
    console.warn('⚠️  TELEGRAM_TOKEN yoki BACKUP_CHANNEL_ID topilmadi, restore skip');
    return null;
  }

  try {
    console.log("📥 Telegram'dan eng yangi backup qidirilmoqda...");

    // Channel messages'ini olish (eng yangi backup fayli)
    const msgResponse = await fetch(
      `${TELEGRAM_API}${config.TELEGRAM_TOKEN}/getUpdates?limit=100&allowed_updates=["message"]`,
      { timeout: 10000 }
    );
    const msgs = await msgResponse.json();

    if (!msgs.ok || !msgs.result.length) {
      console.warn('⚠️  Backup xabarlari topilmadi');
      return null;
    }

    // Oxirgi .tar.gz document'ni topish
    let latestDoc = null;
    for (const update of msgs.result.reverse()) {
      if (update.message?.document?.file_name?.endsWith('.tar.gz')) {
        latestDoc = update.message.document;
        break;
      }
    }

    if (!latestDoc) {
      console.warn('⚠️  Backup faylı topilmadi');
      return null;
    }

    console.log(`📥 Backup yuklanmoqda: ${latestDoc.file_name}`);

    // File info olish
    const fileInfoRes = await fetch(
      `${TELEGRAM_API}${config.TELEGRAM_TOKEN}/getFile?file_id=${latestDoc.file_id}`,
      { timeout: 10000 }
    );
    const fileInfo = await fileInfoRes.json();

    if (!fileInfo.ok || !fileInfo.result.file_path) {
      throw new Error('Telegram file_path olina olmadi');
    }

    // Faylni yuklab olish
    const downloadUrl = `https://api.telegram.org/file/bot${config.TELEGRAM_TOKEN}/${fileInfo.result.file_path}`;
    const downloadRes = await fetch(downloadUrl, { timeout: 60000 });

    if (!downloadRes.ok) {
      throw new Error(`Download xatosi: ${downloadRes.statusText}`);
    }

    const buffer = Buffer.from(await downloadRes.arrayBuffer());
    return { buffer, fileName: latestDoc.file_name };
  } catch (err) {
    console.error('❌ Telegram restore xatosi:', err.message);
    return null;
  }
}

/**
 * Telegram'dan yuklab olingan .tar.gz'ni uncompress qiladi
 */
export async function decompressBackup(gzBuffer, outputDir) {
  try {
    const tmpGzPath = path.join(outputDir, 'temp_restore.tar.gz');
    fs.writeFileSync(tmpGzPath, gzBuffer);

    await execAsync(`cd "${outputDir}" && tar -xzf "${tmpGzPath}" && rm "${tmpGzPath}"`, {
      timeout: 30000
    });

    // .json faylni topish va qaytarish
    const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.json'));
    if (!files.length) throw new Error('Decompressed backup .json topilmadi');

    return path.join(outputDir, files[0]);
  } catch (err) {
    console.error('❌ Decompression xatosi:', err.message);
    throw err;
  }
}

/**
 * Agar startup'da DB bo'sh bo'lsa, Telegram'dan qayta tiklanadi
 */
export async function restoreFromTelegramIfNeeded() {
  try {
    // DB'da hech qanday ma'lumot yo'qligini tekshirish
    const dbPath = process.env.DB_PATH || './chess.db';
    if (fs.existsSync(dbPath)) {
      console.log('✅ DB allaqachon bor, restore kerak emas');
      return null;
    }

    console.log("🔍 DB topilmadi, Telegram'dan restore qidirilmoqda...");

    const backup = await downloadLatestBackupFromTelegram();
    if (!backup) {
      console.warn("⚠️  Telegram'dan backup olib bo'lmadi, yangi DB dan boshlanadi");
      return null;
    }

    const backupDir = path.dirname(dbPath);
    const jsonPath = await decompressBackup(backup.buffer, backupDir);

    // Restore qilish
    const { restoreBackup } = await import('../db/backup.js');
    const result = await restoreBackup(jsonPath, { triggeredBy: 'auto_startup' });

    console.log('✅ Startup restore tugadi:', result);
    fs.unlinkSync(jsonPath); // Temporary .json o'chirish

    return result;
  } catch (err) {
    console.error("❌ Startup restore xatosi (uning o'zi kerak emas):", err.message);
    return null;
  }
}

/**
 * Avtomatik backup scheduler'ini boshlash (har soat)
 */
export function startBackupScheduler() {
  if (!config.TELEGRAM_TOKEN || !BACKUP_CHANNEL_ID) {
    console.warn("⚠️  Backup scheduler o'chirildi (token yoki channel ID yo'q)");
    return;
  }

  console.log('⏰ Backup scheduler boshlanmoqda (har soat)');

  // Har soatda
  setInterval(() => {
    performTelegramBackup().catch(err => {
      console.error('Scheduler backup xatosi:', err.message);
    });
  }, BACKUP_SCHEDULE_INTERVAL);

  // Startup'da ham bir bor backup qil (agarda server'ni o'chirsa, unda oxirgi snapshot bo'lsin)
  console.log('🔄 Startup backup...');
  performTelegramBackup().catch(err => {
    console.error('Startup backup xatosi:', err.message);
  });
}
