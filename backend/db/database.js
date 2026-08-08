import sqlite3 from 'sqlite3';
import { config } from '../config.js';

let db;

export function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(config.DB_PATH, (err) => {
      if (err) return reject(err);
      console.log('✅ SQLite ulandi:', config.DB_PATH);
    });

    db.serialize(() => {
      db.run('PRAGMA foreign_keys = ON');
      db.run('PRAGMA journal_mode = WAL');

      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          telegram_id    TEXT UNIQUE NOT NULL,
          username       TEXT,
          nickname       TEXT UNIQUE,
          nickname_lower TEXT UNIQUE,
          start_level    INTEGER,
          avatar_emoji   TEXT DEFAULT '♟',
          registered     INTEGER DEFAULT 0,
          rating_bullet  INTEGER DEFAULT 1200,
          rating_normal  INTEGER DEFAULT 1200,
          rating_long    INTEGER DEFAULT 1200,
          total_games    INTEGER DEFAULT 0,
          wins           INTEGER DEFAULT 0,
          losses         INTEGER DEFAULT 0,
          draws          INTEGER DEFAULT 0,
          streak         INTEGER DEFAULT 0,
          created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS friendships (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id     TEXT NOT NULL,
          friend_id   TEXT NOT NULL,
          created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, friend_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS games (
          id                   TEXT PRIMARY KEY,
          white_id             TEXT NOT NULL,
          black_id             TEXT,
          white_name           TEXT,
          black_name           TEXT,
          time_mode            TEXT NOT NULL,
          difficulty           INTEGER,
          status               TEXT DEFAULT 'waiting',
          pgn                  TEXT,
          fen                  TEXT,
          result               TEXT,
          reason               TEXT,
          white_rating_change  INTEGER DEFAULT 0,
          black_rating_change  INTEGER DEFAULT 0,
          created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
          finished_at          DATETIME
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS moves (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          game_id     TEXT NOT NULL,
          move_number INTEGER,
          move_san    TEXT,
          fen         TEXT,
          created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run('CREATE INDEX IF NOT EXISTS idx_games_white ON games(white_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_games_black ON games(black_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_moves_game  ON moves(game_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_friend_user ON friendships(user_id)');

      // Bot menyu + admin (2-bosqich) uchun jadvallar
      db.run(`
        CREATE TABLE IF NOT EXISTS broadcasts (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          type        TEXT NOT NULL,
          caption     TEXT,
          sent_count  INTEGER DEFAULT 0,
          source      TEXT,
          created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS contact_threads (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          admin_msg_id      INTEGER NOT NULL,
          user_telegram_id  TEXT NOT NULL,
          created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.run('CREATE INDEX IF NOT EXISTS idx_contact_admin_msg ON contact_threads(admin_msg_id)');

      db.run(`
        CREATE TABLE IF NOT EXISTS backup_logs (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          action        TEXT NOT NULL,
          status        TEXT NOT NULL,
          file_name     TEXT,
          size_bytes    INTEGER,
          counts_json   TEXT,
          duration_ms   INTEGER,
          triggered_by  TEXT,
          error_message TEXT,
          created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Eski bazada yo'q ustunlarni qo'shish (xatoni e'tiborsiz qoldiramiz — ustun bor bo'lsa xato beradi)
      const migrations = [
        "ALTER TABLE users ADD COLUMN nickname TEXT",
        "ALTER TABLE users ADD COLUMN nickname_lower TEXT",
        "ALTER TABLE users ADD COLUMN start_level INTEGER",
        "ALTER TABLE users ADD COLUMN avatar_emoji TEXT DEFAULT '♟'",
        "ALTER TABLE users ADD COLUMN registered INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN streak INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN profile_sticker TEXT",
        "ALTER TABLE users ADD COLUMN first_name TEXT",
        "ALTER TABLE users ADD COLUMN last_name TEXT",
        "ALTER TABLE users ADD COLUMN bot_lang TEXT DEFAULT 'uz'",
        "ALTER TABLE games ADD COLUMN increment INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN placement_bullet INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN placement_normal INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN placement_long INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN rating_estimate INTEGER",
        // Placement (joylashtirish) tizimi — global, barcha vaqt toifalari uchun bitta oqim
        "ALTER TABLE users ADD COLUMN placement_status TEXT DEFAULT 'complete'",
        "ALTER TABLE users ADD COLUMN placement_selected_estimate INTEGER",
        "ALTER TABLE users ADD COLUMN placement_games_played INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN placement_streak INTEGER DEFAULT 0",
        // Matchmaking: reyting mos kelmagan holatda yaratilgan "keng" match belgisi
        "ALTER TABLE games ADD COLUMN wide_match INTEGER DEFAULT 0"
      ];
      migrations.forEach(sql => db.run(sql, () => {}));

      // Placement o'yinlari tarixi — har bir placement o'yinining natijasi va reyting o'zgarishi
      // (performance-tahlil: streak/consistency shu yozuvlardan hisoblanadi)
      db.run(`
        CREATE TABLE IF NOT EXISTS placement_games (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          telegram_id     TEXT NOT NULL,
          category        TEXT NOT NULL,
          game_number     INTEGER NOT NULL,
          opponent_rating INTEGER,
          outcome         TEXT NOT NULL,
          rating_before   INTEGER NOT NULL,
          delta           INTEGER NOT NULL,
          rating_after    INTEGER NOT NULL,
          created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_nickname_lower ON users(nickname_lower)', () => {
        console.log('✅ Jadvallar tayyor');
        resolve(db);
      });
    });
  });
}

export function getDb() {
  if (!db) throw new Error('Database initsializatsiya qilinmagan');
  return db;
}

// Promise wrapperlar
export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

export function closeDb() {
  if (db) db.close();
}
