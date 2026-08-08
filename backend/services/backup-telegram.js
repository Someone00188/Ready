// backend/services/backup-telegram.js
//
// Telegram orqali backup: SQLite'ni compress qilip, admin channel'ga yuborish.
// Render'da ephemeral disk'da saqlab turilmasa — Telegram'da doimiy qolib turadi.

import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { createBackup } from '../db/backup.js';

// Eslatma: compress/decompress endi Node'ning ichki zlib moduli orqali
// bajariladi (tashqi `tar`/`gzip` buyruqlariga bog'liqlik yo'q) — shu sabab
// child_process/exec importi endi kerak emas.

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
 * Backup'ni .json.gz'ga compress qiladi.
 *
 * MUHIM TUZATISH: bu funksiya avval ".tar.gz" nomlanган fayl chiqarardi, lekin
 * aslida haqiqiy tar arxiv YARATMAS edi — faqat xom .json faylni to'g'ridan-to'g'ri
 * gzip qilardi (`gzip -c file > file.tar.gz`). Natijada Telegram kanaliga yuborilgan
 * fayl HAQIQATDA oddiy gzip (.json.gz) edi, lekin nomi ".tar.gz" bo'lgani uchun
 * restore tarafida `tar -xzf` chaqirilardi — bu esa haqiqiy tar strukturasini
 * kutadi va mos kelmagani uchun xato/noto'g'ri natija berardi. Aynan shu sabab
 * kanaldagi fayl "boshqa formatda" ko'rinar edi.
 *
 * Yechim: haqiqiy tar arxivlashni olib tashladik (u umuman kerak emas edi —
 * bitta faylni compress qilish uchun tar ortiqcha qatlam). Endi to'g'ridan-to'g'ri
 * .json.gz formatida (Node'ning o'zining zlib moduli orqali, tashqi `gzip`
 * buyrug'iga ham bog'liq emas — Render kabi muhitlarda ishonchliroq) siqiladi,
 * fayl nomi ham haqiqiy formatga mos: backup_....json.gz
 */
async function compressBackup(backupFilePath) {
  const zlib = await import('zlib');
  const { pipeline } = await import('stream/promises');

  const dir = path.dirname(backupFilePath);
  const filename = path.basename(backupFilePath);
  const gzPath = path.join(dir, `${filename}.gz`);

  try {
    await pipeline(
      fs.createReadStream(backupFilePath),
      zlib.createGzip({ level: 9 }),
      fs.createWriteStream(gzPath)
    );
    return gzPath;
  } catch (err) {
    console.error('❌ Compression xatosi:', err.message);
    throw err;
  }
}

/**
 * .json.gz faylni asl .json'ga qaytaradi (Node zlib orqali, tashqi `tar`/`gzip`
 * buyruqlariga bog'liq emas — Render'da bu buyruqlar mavjudligi kafolatlanmagan).
 */
async function decompressGz(gzFilePath, outputJsonPath) {
  const zlib = await import('zlib');
  const { pipeline } = await import('stream/promises');

  await pipeline(
    fs.createReadStream(gzFilePath),
    zlib.createGunzip(),
    fs.createWriteStream(outputJsonPath)
  );
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
      .filter(f => f.startsWith('backup_') && f.endsWith('.json.gz'))
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

    // Oxirgi .json.gz document'ni topish
    let latestDoc = null;
    for (const update of msgs.result.reverse()) {
      if (update.message?.document?.file_name?.endsWith('.json.gz')) {
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
 * Telegram'dan yuklab olingan .json.gz'ni uncompress qiladi.
 *
 * Eski versiya `tar -xzf` chaqirar edi — bu haqiqiy tar arxiv strukturasini
 * kutadi, lekin fayl (yuqoridagi tuzatishdan keyin ham, avvalgidan ham) tar
 * emas, oddiy gzip edi — shu nomuvofiqlik "boshqa format" xatosining sababi
 * bo'lgan. Endi to'g'ridan-to'g'ri zlib orqali gunzip qilinadi — tashqi `tar`
 * buyrug'iga umuman ehtiyoj yo'q.
 */
export async function decompressBackup(gzBuffer, outputDir) {
  try {
    const tmpGzPath = path.join(outputDir, 'temp_restore.json.gz');
    const jsonPath = path.join(outputDir, 'temp_restore.json');
    fs.writeFileSync(tmpGzPath, gzBuffer);

    await decompressGz(tmpGzPath, jsonPath);
    fs.unlinkSync(tmpGzPath);

    if (!fs.existsSync(jsonPath)) throw new Error('Decompressed backup .json topilmadi');

    return jsonPath;
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
    // Eskidan: agar DB fayli mavjud bo'lsa, restore umuman chaqirilmasdi.
    // MUAMMO: Render restart bo'lganda chess.db fayli ba'zan hali diskda qoladi
    // (yoki bo'sh/eskirgan holatda), shu payt "DB bor" deb restore SKIP qilinardi.
    // Natijada: bot o'z ichki keshidan/faylidan foydalanib davom etardi (botda
    // ma'lumot bor ko'rinardi), lekin saytning ishlatadigan asosiy DB fayli
    // yangilanmagan holda qolib, saytda hamma narsa 0 bo'lib ko'rinardi.
    //
    // YECHIM: DB mavjudligidan qat'iy nazar, agar u BO'SH yoki foydalanuvchi
    // ma'lumoti yo'q bo'lsa, baribir Telegram'dan restore qilinadi — shu bilan
    // bot va sayt HAR DOIM bir xil, birgalikda yangilangan DB'dan foydalanadi.
    const dbPath = process.env.DB_PATH || './chess.db';
    const dbExists = fs.existsSync(dbPath);

    let needsRestore = !dbExists;

    if (dbExists) {
      try {
        const stat = fs.statSync(dbPath);
        // SQLite bo'sh/yangi baza header'i ham necha bayt bo'ladi — 8KB'dan
        // kichik fayl deyarli har doim "jadvallar yaratilgan, lekin ma'lumot
        // yo'q" degani (chunki users/games jadvallari ozgina qator bilan ham
        // bir necha KB bo'ladi). Shu bilan bir qatorda users jadvalidagi
        // haqiqiy qatorlar sonini ham tekshiramiz — eng ishonchli signal shu.
        if (stat.size < 8192) {
          needsRestore = true;
        } else {
          const { all } = await import('./database.js');
          const rows = await all('SELECT COUNT(*) AS c FROM users').catch(() => null);
          if (!rows || !rows.length || rows[0].c === 0) {
            needsRestore = true;
          }
        }
      } catch (checkErr) {
        console.warn('⚠️  DB holatini tekshirishda xato, ehtiyot uchun restore qilinadi:', checkErr.message);
        needsRestore = true;
      }
    }

    if (!needsRestore) {
      console.log('✅ DB mavjud va foydalanuvchi ma\'lumoti bor, restore kerak emas');
      return null;
    }

    console.log(dbExists
      ? "🔍 DB mavjud lekin bo'sh ko'rinadi, Telegram'dan restore qidirilmoqda..."
      : "🔍 DB topilmadi, Telegram'dan restore qidirilmoqda...");

    const backup = await downloadLatestBackupFromTelegram();
    if (!backup) {
      console.warn("⚠️  Telegram'dan backup olib bo'lmadi, yangi DB dan boshlanadi");
      return null;
    }

    const backupDir = path.dirname(dbPath);
    const jsonPath = await decompressBackup(backup.buffer, backupDir);

    // Restore qilish — bu SHU YAGONA chess.db faylga yoziladi, ya'ni bot va
    // backend/server.js (sayt) BIR XIL faylni ochadi. Restore tugagach ikkalasi
    // ham avtomatik yangilangan ma'lumotni ko'radi — alohida "saytni ham
    // yangilash" degan qadam shart emas, chunki ular hech qachon ikkita
    // alohida DB emas edi.
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
