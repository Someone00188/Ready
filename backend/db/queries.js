import { run, get, all } from './database.js';
import { ratingColumn } from '../config.js';
import { isValidEstimate, estimateToRating } from '../utils/placement.js';

// ===================== USERS =====================

export async function upsertUser(telegramId, username) {
  await run(
    `INSERT INTO users (telegram_id, username) VALUES (?, ?)
     ON CONFLICT(telegram_id) DO UPDATE SET username = excluded.username`,
    [String(telegramId), username || null]
  );
  return getUser(telegramId);
}

export function getUser(telegramId) {
  return get('SELECT * FROM users WHERE telegram_id = ?', [String(telegramId)]);
}

export function setProfileSticker(telegramId, stickerId) {
  return run('UPDATE users SET profile_sticker = ? WHERE telegram_id = ?', [stickerId, String(telegramId)]);
}

export async function getOrCreateUser(telegramId, username) {
  const existing = await getUser(telegramId);
  if (existing) return existing;
  return upsertUser(telegramId, username);
}

// ============== TELEGRAM BOT: /start da chaqiriladi ==============
// Har doim telegram_id, username, ism-familiyani yangilab turadi (dublikat yaratmaydi — UNIQUE telegram_id)
export async function upsertTelegramUser(telegramId, username, firstName, lastName) {
  await run(
    `INSERT INTO users (telegram_id, username, first_name, last_name)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(telegram_id) DO UPDATE SET
       username = excluded.username,
       first_name = excluded.first_name,
       last_name = excluded.last_name`,
    [String(telegramId), username || null, firstName || null, lastName || null]
  );
  return getUser(telegramId);
}

export function getUserBotLang(telegramId) {
  return get('SELECT bot_lang FROM users WHERE telegram_id = ?', [String(telegramId)])
    .then(row => row?.bot_lang || 'uz');
}

export function setUserBotLang(telegramId, lang) {
  return run('UPDATE users SET bot_lang = ? WHERE telegram_id = ?', [lang, String(telegramId)]);
}

// ===================== ADMIN =====================

export async function countUsers() {
  const row = await get('SELECT COUNT(*) AS c FROM users');
  return row?.c || 0;
}

// Eslatma: created_at SQLite CURRENT_TIMESTAMP (UTC, "YYYY-MM-DD HH:MM:SS") formatida
// saqlanadi. Solishtirishni ham SQLite'ning o'zidagi datetime() bilan qilamiz —
// shunda JS Date/ISO formatlari orasidagi nomuvofiqlikdan xato chiqmaydi.
export async function countUsersToday() {
  const row = await get(`SELECT COUNT(*) AS c FROM users WHERE date(created_at) = date('now')`);
  return row?.c || 0;
}

export async function countUsersThisWeek() {
  const row = await get(`SELECT COUNT(*) AS c FROM users WHERE created_at >= datetime('now', '-7 days')`);
  return row?.c || 0;
}

export async function countBroadcasts() {
  const row = await get('SELECT COUNT(*) AS c FROM broadcasts');
  return row?.c || 0;
}

export function getAllTelegramIds() {
  return all('SELECT telegram_id FROM users').then(rows => rows.map(r => r.telegram_id));
}

export function insertBroadcast(type, caption, sentCount, source) {
  return run(
    'INSERT INTO broadcasts (type, caption, sent_count, source) VALUES (?, ?, ?, ?)',
    [type, caption || null, sentCount, source]
  );
}

export function listRecentUsers(limit = 50) {
  return all(
    `SELECT telegram_id, username, first_name, last_name, nickname, created_at
     FROM users ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
}

export function listRecentBroadcasts(limit = 20) {
  return all('SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT ?', [limit]);
}

// ===================== CONTACT ADMIN =====================

export function insertContactThread(adminMsgId, userTelegramId) {
  return run(
    'INSERT INTO contact_threads (admin_msg_id, user_telegram_id) VALUES (?, ?)',
    [adminMsgId, String(userTelegramId)]
  );
}

export function getContactThread(adminMsgId) {
  return get(
    'SELECT * FROM contact_threads WHERE admin_msg_id = ? ORDER BY id DESC LIMIT 1',
    [adminMsgId]
  );
}

// ===================== BACKUP =====================

export function insertBackupLog({ action, status, fileName, sizeBytes, counts, durationMs, triggeredBy, errorMessage }) {
  return run(
    `INSERT INTO backup_logs (action, status, file_name, size_bytes, counts_json, duration_ms, triggered_by, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [action, status, fileName || null, sizeBytes || null, counts ? JSON.stringify(counts) : null,
     durationMs || null, triggeredBy ? String(triggeredBy) : null, errorMessage || null]
  );
}

export function listRecentBackupLogs(limit = 20) {
  return all('SELECT * FROM backup_logs ORDER BY created_at DESC LIMIT ?', [limit]);
}

export async function applyGameOutcome(telegramId, timeMode, outcome, newRating) {
  const col = ratingColumn(timeMode);
  const fields = ['total_games = total_games + 1'];

  if (outcome === 'win') fields.push('wins = wins + 1');
  else if (outcome === 'loss') fields.push('losses = losses + 1');
  else fields.push('draws = draws + 1');

  const params = [];
  if (col && newRating != null) {
    fields.push(`${col} = ?`);
    params.push(newRating);
  }
  params.push(String(telegramId));

  await run(`UPDATE users SET ${fields.join(', ')} WHERE telegram_id = ?`, params);
}

export function getTopPlayers(mode = 'bullet', limit = 10) {
  const col = ratingColumn(mode) || 'rating_bullet';
  return all(
    `SELECT telegram_id, username, nickname, avatar_emoji, ${col} AS rating, total_games, wins, losses, draws
     FROM users WHERE total_games >= 1 ORDER BY ${col} DESC LIMIT ?`,
    [limit]
  );
}

// ===================== RO'YXATDAN O'TISH =====================

const RESERVED = new Set(['admin', 'moderator', 'support', 'root', 'null', 'undefined', 'ai', 'bot']);

export function validateNickname(nickname) {
  if (!nickname || typeof nickname !== 'string') return "Nickname bo'sh bo'lishi mumkin emas";
  const trimmed = nickname.trim();
  if (trimmed.length < 3) return 'Nickname kamida 3 belgidan iborat bo\'lishi kerak';
  if (trimmed.length > 20) return 'Nickname 20 belgidan oshmasligi kerak';
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return 'Faqat lotin harflari, raqam va pastki chiziqdan foydalaning';
  if (RESERVED.has(trimmed.toLowerCase())) return 'Bu nickname band';
  return null;
}

export async function isNicknameTaken(nickname, excludeTelegramId = null) {
  const row = await get(
    'SELECT telegram_id FROM users WHERE nickname_lower = ?',
    [nickname.trim().toLowerCase()]
  );
  if (!row) return false;
  if (excludeTelegramId && String(row.telegram_id) === String(excludeTelegramId)) return false;
  return true;
}

export async function registerUser(telegramId, username, nickname, estimateKey) {
  const err = validateNickname(nickname);
  if (err) { const e = new Error(err); e.code = 'INVALID_NICKNAME'; throw e; }

  if (await isNicknameTaken(nickname, telegramId)) {
    const e = new Error('Bu nickname allaqachon band'); e.code = 'NICKNAME_TAKEN'; throw e;
  }

  if (!isValidEstimate(estimateKey)) {
    const e = new Error("Noto'g'ri daraja tanlandi"); e.code = 'INVALID_ESTIMATE'; throw e;
  }
  const rating = estimateToRating(estimateKey);
  const clean = nickname.trim();

  await run(
    `INSERT INTO users (
       telegram_id, username, nickname, nickname_lower, registered,
       rating_bullet, rating_normal, rating_long,
       placement_status, placement_selected_estimate, placement_games_played, placement_streak
     )
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, 'in_progress', ?, 0, 0)
     ON CONFLICT(telegram_id) DO UPDATE SET
       nickname = excluded.nickname, nickname_lower = excluded.nickname_lower, registered = 1,
       rating_bullet = excluded.rating_bullet, rating_normal = excluded.rating_normal, rating_long = excluded.rating_long,
       placement_status = 'in_progress', placement_selected_estimate = excluded.placement_selected_estimate,
       placement_games_played = 0, placement_streak = 0`,
    [String(telegramId), username || null, clean, clean.toLowerCase(), rating, rating, rating, rating]
  );

  return getUser(telegramId);
}

/** Placement o'yinidan keyingi natijani saqlaydi. 5-o'yindan keyin avtomatik 'complete'ga o'tadi. */
export async function applyPlacementGameOutcome(telegramId, newRating, newStreak, gamesPlayedAfter, outcome) {
  const fields = [
    'total_games = total_games + 1',
    'rating_bullet = ?', 'rating_normal = ?', 'rating_long = ?',
    'placement_games_played = ?',
    'placement_streak = ?'
  ];
  if (outcome === 'win') fields.push('wins = wins + 1');
  else if (outcome === 'loss') fields.push('losses = losses + 1');
  else fields.push('draws = draws + 1');

  if (gamesPlayedAfter >= 5) fields.push("placement_status = 'complete'");

  const params = [newRating, newRating, newRating, gamesPlayedAfter, newStreak, String(telegramId)];
  await run(`UPDATE users SET ${fields.join(', ')} WHERE telegram_id = ?`, params);
}

export function getPlacementState(telegramId) {
  return get(
    `SELECT placement_status, placement_selected_estimate, placement_games_played, placement_streak,
            rating_bullet, rating_normal, rating_long
     FROM users WHERE telegram_id = ?`,
    [String(telegramId)]
  );
}

/** Placementni qaytadan boshlashga imkon beradi (Settings > Reset Placement) */
export async function resetPlacement(telegramId, estimateKey) {
  if (!isValidEstimate(estimateKey)) {
    const e = new Error("Noto'g'ri daraja tanlandi"); e.code = 'INVALID_ESTIMATE'; throw e;
  }
  const rating = estimateToRating(estimateKey);
  await run(
    `UPDATE users SET
       rating_bullet = ?, rating_normal = ?, rating_long = ?,
       placement_status = 'in_progress', placement_selected_estimate = ?,
       placement_games_played = 0, placement_streak = 0
     WHERE telegram_id = ?`,
    [rating, rating, rating, rating, String(telegramId)]
  );
  return getUser(telegramId);
}

export function isRegistered(user) {
  return !!(user && user.registered);
}

export function searchByNickname(query, excludeTelegramId, limit = 8) {
  const like = `%${query.trim().toLowerCase()}%`;
  return all(
    `SELECT telegram_id, nickname, avatar_emoji, rating_bullet, rating_normal, rating_long, total_games
     FROM users
     WHERE registered = 1 AND nickname_lower LIKE ? AND telegram_id != ?
     ORDER BY LENGTH(nickname) ASC LIMIT ?`,
    [like, String(excludeTelegramId), limit]
  );
}

// ===================== DO'STLAR =====================

export async function addFriend(userId, friendId) {
  if (String(userId) === String(friendId)) {
    const e = new Error("O'zingizni qo'sha olmaysiz"); e.code = 'SELF_FRIEND'; throw e;
  }
  await run(
    'INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)',
    [String(userId), String(friendId)]
  );
  await run(
    'INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)',
    [String(friendId), String(userId)]
  );
}

export function removeFriend(userId, friendId) {
  return Promise.all([
    run('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?', [String(userId), String(friendId)]),
    run('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?', [String(friendId), String(userId)])
  ]);
}

export function areFriends(userId, friendId) {
  return get(
    'SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?',
    [String(userId), String(friendId)]
  ).then(r => !!r);
}

export function getFriends(userId) {
  return all(
    `SELECT u.telegram_id, u.nickname, u.avatar_emoji, u.rating_bullet, u.rating_normal, u.rating_long,
            u.total_games, u.wins,
            (SELECT MAX(created_at) FROM games
             WHERE (white_id = u.telegram_id AND black_id = ?) OR (black_id = u.telegram_id AND white_id = ?)
            ) AS last_played
     FROM friendships f
     JOIN users u ON u.telegram_id = f.friend_id
     WHERE f.user_id = ?
     ORDER BY u.nickname COLLATE NOCASE ASC`,
    [String(userId), String(userId), String(userId)]
  );
}

// ===================== GAMES =====================

export async function insertGame(g) {
  await run(
    `INSERT INTO games (id, white_id, black_id, white_name, black_name, time_mode, difficulty, status, fen, increment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [g.id, String(g.whiteId), g.blackId ? String(g.blackId) : null,
     g.whiteName || null, g.blackName || null, g.timeMode, g.difficulty || null,
     g.status || 'waiting', g.fen || null, g.increment || 0]
  );
  return getGame(g.id);
}

export function setWideMatch(gameId) {
  return run(`UPDATE games SET wide_match = 1 WHERE id = ?`, [gameId]);
}

export function cancelGame(gameId) {
  return run(
    `UPDATE games SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'waiting'`,
    [gameId]
  );
}

export function getGame(gameId) {
  return get('SELECT * FROM games WHERE id = ?', [gameId]);
}

export function setBlackPlayer(gameId, blackId, blackName) {
  return run(
    `UPDATE games SET black_id = ?, black_name = ?, status = 'active', updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND black_id IS NULL`,
    [String(blackId), blackName || null, gameId]
  );
}

export function finishGame(gameId, { result, reason, pgn, fen, whiteChange = 0, blackChange = 0 }) {
  return run(
    `UPDATE games SET status = 'finished', result = ?, reason = ?, pgn = ?, fen = ?,
       white_rating_change = ?, black_rating_change = ?,
       finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [result, reason, pgn || null, fen || null, whiteChange, blackChange, gameId]
  );
}

export function getUserGames(telegramId, limit = 10) {
  const id = String(telegramId);
  return all(
    `SELECT * FROM games WHERE white_id = ? OR black_id = ?
     ORDER BY created_at DESC LIMIT ?`,
    [id, id, limit]
  );
}

// ===================== MOVES =====================

export function insertMove(gameId, moveNumber, san, fen) {
  return run(
    'INSERT INTO moves (game_id, move_number, move_san, fen) VALUES (?, ?, ?, ?)',
    [gameId, moveNumber, san, fen]
  );
}

export function getMoves(gameId) {
  return all('SELECT * FROM moves WHERE game_id = ? ORDER BY move_number ASC', [gameId]);
}
