// backend/db/backup.js
//
// Backup/Restore xizmati.
//
// Dizayn qarorlari (muhim):
// - Format faqat JSON. .sql import qo'llab-quvvatlanmaydi — chunki tayyor SQL faylni
//   to'g'ridan-to'g'ri bajarish SQL-injection / ixtiyoriy kod bajarish xavfini tug'diradi.
//   JSON esa faqat parametrlashtirilgan INSERT orqali, whitelist qilingan jadval/ustun
//   nomlari bilan qayta tiklanadi — xavfsiz.
// - Jadvallar ro'yxati DINAMIK ravishda sqlite_master'dan olinadi. Demak, kelajakda
//   Checkers (shashka) jadvallari qo'shilsa, backup/restore ularni AVTOMATIK qamrab oladi —
//   bu faylni qayta o'zgartirish shart emas.
// - Katta bazalar uchun: yozishda db.each() orqali qator-qator stream qilinadi (hammasi
//   xotiraga yuklanmaydi). O'qishda esa JSON.parse (Node uchun bu amalda yetarli darajada
//   samarali; juda ulkan fayllar uchun kelajakda chunked JSON parser qo'shish mumkin).
// - Restore doim BEGIN/COMMIT/ROLLBACK bilan yagona tranzaksiyada bajariladi. Xato bo'lsa —
//   avtomatik ROLLBACK. Har restore’dan oldin joriy baza avtomatik zaxiralanadi (safety backup).

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getDb, run, all } from './database.js';
import { insertBackupLog } from './queries.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BACKUP_DIR = path.join(__dirname, '../backups');
export const INCOMING_DIR = path.join(BACKUP_DIR, 'incoming');
const BACKUP_FORMAT_VERSION = 1;

// backup_logs o'zining tarixi — qayta backup qilinganda cheksiz o'sib ketmasligi uchun
// (va o'z-o'zini backup qilishning ma'nosi yo'q) shu jadval chiqarib tashlanadi.
const EXCLUDED_TABLES = new Set(['backup_logs']);

function ensureDirs() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.mkdirSync(INCOMING_DIR, { recursive: true });
}

function pad(n) {
  return String(n).padStart(2, '0');
}

export function timestampName(prefix = 'backup') {
  const d = new Date();
  const rand = crypto.randomBytes(2).toString('hex');
  return `${prefix}_${d.getFullYear()}_${pad(d.getMonth() + 1)}_${pad(d.getDate())}_${pad(d.getHours())}_${pad(d.getMinutes())}_${pad(d.getSeconds())}_${rand}`;
}

/** Joriy bazadagi barcha foydalanuvchi jadvallari (sqlite ichki jadvallarsiz, backup_logs'siz) */
export async function listBackupTables() {
  const rows = await all(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
  );
  return rows.map(r => r.name).filter(name => !EXCLUDED_TABLES.has(name));
}

/** Bitta jadvalni fayl oqimiga (writeStream) qator-qator, xotirani band qilmasdan yozadi */
function streamTable(db, tableName, ws) {
  return new Promise((resolve, reject) => {
    let count = 0;
    let started = false;
    ws.write(`"${tableName}":[`);

    db.each(
      `SELECT * FROM "${tableName}"`,
      [],
      (err, row) => {
        if (err) return; // yakuniy callback'da qayta ishlanadi
        ws.write((started ? ',' : '') + JSON.stringify(row));
        started = true;
        count++;
      },
      (err) => {
        if (err) return reject(err);
        ws.write(']');
        resolve(count);
      }
    );
  });
}

/**
 * To'liq backup yaratadi (barcha jadvallar, stream tarzida).
 * @param {{triggeredBy?: string, source?: string}} opts
 * @returns {Promise<{filePath, fileName, sizeBytes, counts, durationMs}>}
 */
export async function createBackup({ triggeredBy, source = 'panel' } = {}) {
  const start = Date.now();
  ensureDirs();

  const fileName = `${timestampName(source === 'pre_restore_safety' ? 'safety_backup' : 'backup')}.json`;
  const filePath = path.join(BACKUP_DIR, fileName);
  const tables = await listBackupTables();
  const db = getDb();

  const ws = fs.createWriteStream(filePath, { encoding: 'utf8' });
  const counts = {};

  try {
    ws.write('{');
    ws.write(`"meta":${JSON.stringify({
      version: BACKUP_FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      source
    })},`);
    ws.write('"tables":{');

    for (let i = 0; i < tables.length; i++) {
      const t = tables[i];
      if (i > 0) ws.write(',');
      counts[t] = await streamTable(db, t, ws);
    }

    ws.write('}}');
    await new Promise((resolve, reject) => {
      ws.end(err => (err ? reject(err) : resolve()));
    });

    const { size } = fs.statSync(filePath);
    const durationMs = Date.now() - start;

    await insertBackupLog({
      action: 'backup', status: 'success', fileName, sizeBytes: size,
      counts, durationMs, triggeredBy
    });

    return { filePath, fileName, sizeBytes: size, counts, durationMs };
  } catch (err) {
    try { ws.destroy(); } catch {}
    try { fs.unlinkSync(filePath); } catch {}
    await insertBackupLog({
      action: 'backup', status: 'error', fileName, triggeredBy,
      durationMs: Date.now() - start, errorMessage: err.message
    }).catch(() => {});
    throw err;
  }
}

/**
 * Yuklangan faylni tekshiradi: JSON formatmi, versiya mosmi, jadval/ustun nomlari
 * joriy sxemaga (whitelist) mos keladimi. SQL ijro etilmaydi — faqat JSON.parse.
 */
export async function validateBackupFile(filePath) {
  const errors = [];
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return { valid: false, errors: [`Fayl o'qilmadi: ${err.message}`] };
  }

  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (err) {
    return { valid: false, errors: [`Fayl buzilgan (JSON emas): ${err.message}`] };
  }

  if (!obj || typeof obj !== 'object') errors.push("Fayl tuzilishi noto'g'ri");
  if (!obj.meta || typeof obj.meta.version !== 'number') errors.push("meta.version topilmadi");
  else if (obj.meta.version > BACKUP_FORMAT_VERSION) errors.push(`Versiya mos emas (fayl: v${obj.meta.version}, bot: v${BACKUP_FORMAT_VERSION})`);
  if (!obj.tables || typeof obj.tables !== 'object') errors.push('tables bo\'limi topilmadi');

  const currentTables = new Set(await listBackupTables());
  const counts = {};
  let knownTableFound = false;

  if (obj.tables) {
    for (const [name, rows] of Object.entries(obj.tables)) {
      if (!Array.isArray(rows)) { errors.push(`"${name}" jadvali massiv emas`); continue; }
      if (!currentTables.has(name)) continue; // eski/notanish jadval — e'tiborsiz qoldiriladi, xato emas
      knownTableFound = true;
      counts[name] = rows.length;
    }
  }

  if (!knownTableFound) errors.push("Faylda joriy bazaga mos hech qanday jadval topilmadi");

  return { valid: errors.length === 0, errors, meta: obj.meta, counts, tableCount: Object.keys(counts).length };
}

/**
 * Tasdiqlangan faylni tikaydi. Har doim avval xavfsizlik backup'i oladi,
 * yagona tranzaksiyada bajaradi, xato bo'lsa ROLLBACK qiladi.
 */
export async function restoreBackup(filePath, { triggeredBy } = {}) {
  const start = Date.now();
  const check = await validateBackupFile(filePath);
  if (!check.valid) {
    const err = new Error(check.errors.join('; '));
    await insertBackupLog({
      action: 'restore', status: 'error', triggeredBy,
      durationMs: Date.now() - start, errorMessage: err.message
    }).catch(() => {});
    throw err;
  }

  // Har restore'dan oldin avtomatik xavfsizlik nusxasi
  const safety = await createBackup({ triggeredBy, source: 'pre_restore_safety' });

  const raw = fs.readFileSync(filePath, 'utf8');
  const obj = JSON.parse(raw);
  const currentTables = new Set(await listBackupTables());
  const tableNames = Object.keys(obj.tables).filter(t => currentTables.has(t));
  const restoredCounts = {};

  try {
    await run('BEGIN IMMEDIATE TRANSACTION');

    for (const tableName of tableNames) {
      const rows = obj.tables[tableName];

      // Ustun nomlarini joriy sxema (PRAGMA) bilan tekshiramiz — faqat whitelist ustunlar yoziladi
      const colInfo = await all(`PRAGMA table_info("${tableName}")`);
      const validCols = new Set(colInfo.map(c => c.name));

      await run(`DELETE FROM "${tableName}"`);

      let inserted = 0;
      const BATCH = 300;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        for (const row of batch) {
          const cols = Object.keys(row).filter(c => validCols.has(c));
          if (!cols.length) continue;
          const placeholders = cols.map(() => '?').join(',');
          const values = cols.map(c => row[c]);
          await run(
            `INSERT INTO "${tableName}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${placeholders})`,
            values
          );
          inserted++;
        }
      }
      restoredCounts[tableName] = inserted;
    }

    await run('COMMIT');

    const durationMs = Date.now() - start;
    await insertBackupLog({
      action: 'restore', status: 'success', fileName: path.basename(filePath),
      counts: restoredCounts, durationMs, triggeredBy
    });

    return { restoredCounts, durationMs, safetyBackup: safety };
  } catch (err) {
    try { await run('ROLLBACK'); } catch {}
    await insertBackupLog({
      action: 'restore', status: 'error', fileName: path.basename(filePath),
      durationMs: Date.now() - start, triggeredBy, errorMessage: err.message
    }).catch(() => {});
    err.safetyBackup = safety;
    throw err;
  }
}
