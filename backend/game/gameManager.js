import crypto from 'crypto';
import { Game } from './Game.js';
import * as q from '../db/queries.js';
import { calculateELO, calculateBoth } from '../utils/ratings.js';
import { calculatePlacementStep } from '../utils/placement.js';
import { ratingColumn } from '../config.js';
import { notifyGameOver } from '../utils/telegram.js';

// Faol o'yinlar xotirada
const games = new Map();

// Uzilish (disconnect) taymerlari: "gameId:userId" -> Timeout
const reconnectTimers = new Map();

export function registerReconnectTimer(gameId, userId, timer) {
  const key = `${gameId}:${userId}`;
  clearReconnectTimer(gameId, userId);
  reconnectTimers.set(key, timer);
}

export function clearReconnectTimer(gameId, userId) {
  const key = `${gameId}:${userId}`;
  const existing = reconnectTimers.get(key);
  if (existing) {
    clearTimeout(existing);
    reconnectTimers.delete(key);
  }
}

/** Foydalanuvchi ishtirok etayotgan faol (tugamagan) o'yinni topadi */
export function findActiveGameForUser(userId) {
  const uid = String(userId);
  for (const game of games.values()) {
    if (game.status === 'active' && (game.whiteId === uid || game.blackId === uid)) {
      return game;
    }
  }
  return null;
}

/** Kriptografik xavfsiz, taxmin qilib bo'lmaydigan Match ID (UUID v4) */
export function generateGameId() {
  return crypto.randomUUID();
}

export async function createGame({ whiteId, whiteName, timeMode, difficulty, gameMode, increment }) {
  const id = generateGameId();

  const game = new Game({
    id,
    whiteId,
    whiteName,
    blackId: null,
    timeMode,
    difficulty: gameMode === 'ai' ? (difficulty || 3) : null
  });

  games.set(id, game);

  await q.insertGame({
    id,
    whiteId,
    whiteName,
    blackId: null,
    blackName: game.blackName,
    timeMode,
    increment: increment ?? Math.round((game.incrementMs || 0) / 1000),
    difficulty: game.difficulty,
    status: game.status,
    fen: game.chess.fen()
  });

  return game;
}

export function getActiveGame(gameId) {
  return games.get(gameId) || null;
}

export async function getGameOrRecord(gameId) {
  const live = games.get(gameId);
  if (live) return { live, record: null };

  const record = await q.getGame(gameId);
  return { live: null, record };
}

export function removeGame(gameId) {
  games.delete(gameId);
}

/**
 * "Waiting for opponent" holatidagi o'yinni bekor qiladi va o'chiradi.
 * Faqat status === 'waiting' bo'lganda ishlaydi (o'yin boshlangandan keyin bekor
 * qilib bo'lmaydi — buning uchun resign bor).
 */
export async function cancelWaitingGame(gameId, requesterId) {
  const game = games.get(gameId);
  if (!game) return { error: "Match topilmadi" };
  if (game.status !== 'waiting') return { error: "Match allaqachon boshlangan, bekor qilib bo'lmaydi" };
  if (String(requesterId) !== game.whiteId) return { error: "Faqat yaratuvchi bekor qila oladi" };

  games.delete(gameId);
  await q.cancelGame(gameId).catch(() => {});
  return { ok: true };
}

export function listActiveGames() {
  return [...games.values()].map(g => g.getState());
}

/**
 * O'yin tugagach: DB ga yozish, reytinglarni yangilash, Telegramga xabar.
 * @returns {{whiteChange, blackChange}}
 */
export async function finalizeGame(game) {
  const { id, result, reason, timeMode } = game;
  let whiteChange = 0;
  let blackChange = 0;

  const isRated = ratingColumn(timeMode) !== null && !game.isAI && game.blackId;

  if (isRated) {
    try {
      const [w, b] = await Promise.all([
        q.getOrCreateUser(game.whiteId, game.whiteName),
        q.getOrCreateUser(game.blackId, game.blackName)
      ]);

      const col = ratingColumn(timeMode);
      const whiteOutcome = result === '1-0' ? 'win' : result === '0-1' ? 'loss' : 'draw';
      const blackOutcome = result === '0-1' ? 'win' : result === '1-0' ? 'loss' : 'draw';
      const wideMatch = !!game.wideMatch;

      // ===== OQ tomon =====
      if (w.placement_status === 'in_progress') {
        const step = calculatePlacementStep(
          w.rating_bullet, b.rating_bullet, whiteOutcome, w.placement_games_played, w.placement_streak
        );
        whiteChange = wideMatch ? Math.round(step.change / 2) : step.change;
        const appliedRating = wideMatch ? w.rating_bullet + whiteChange : step.newRating;
        await q.applyPlacementGameOutcome(
          game.whiteId, appliedRating, step.newStreak, w.placement_games_played + 1, whiteOutcome
        );
      } else {
        const calc = calculateELO(w[col], b[col], whiteOutcome, w.total_games);
        whiteChange = wideMatch ? Math.round(calc.change / 2) : calc.change;
        await q.applyGameOutcome(game.whiteId, timeMode, whiteOutcome, w[col] + whiteChange);
      }

      // ===== QORA tomon =====
      if (b.placement_status === 'in_progress') {
        const step = calculatePlacementStep(
          b.rating_bullet, w.rating_bullet, blackOutcome, b.placement_games_played, b.placement_streak
        );
        blackChange = wideMatch ? Math.round(step.change / 2) : step.change;
        const appliedRating = wideMatch ? b.rating_bullet + blackChange : step.newRating;
        await q.applyPlacementGameOutcome(
          game.blackId, appliedRating, step.newStreak, b.placement_games_played + 1, blackOutcome
        );
      } else {
        const calc = calculateELO(b[col], w[col], blackOutcome, b.total_games);
        blackChange = wideMatch ? Math.round(calc.change / 2) : calc.change;
        await q.applyGameOutcome(game.blackId, timeMode, blackOutcome, b[col] + blackChange);
      }
    } catch (err) {
      console.error('Reyting yangilashda xato:', err.message);
    }
  } else if (game.isAI) {
    // AI o'yinlari statistikaga kiradi, lekin reytingga ta'sir qilmaydi
    try {
      const outcome = result === '1-0' ? 'win' : result === '0-1' ? 'loss' : 'draw';
      await q.applyGameOutcome(game.whiteId, 'ai', outcome, null);
    } catch (err) {
      console.error('AI statistika xatosi:', err.message);
    }
  }

  try {
    await q.finishGame(id, {
      result, reason,
      pgn: game.chess.pgn(),
      fen: game.chess.fen(),
      whiteChange, blackChange
    });
  } catch (err) {
    console.error('O\'yinni saqlashda xato:', err.message);
  }

  // Telegram xabarlari (fon rejimida, xato bo'lsa o'yinni to'xtatmaydi)
  notifyGameOver(game, { whiteChange, blackChange }).catch(err =>
    console.error('Telegram xabar xatosi:', err.message)
  );

  // 5 daqiqadan keyin xotiradan o'chirish (kuzatuvchilar ko'rib ulgursin)
  setTimeout(() => removeGame(id), 5 * 60_000);

  return { whiteChange, blackChange };
}

/** Vaqti tugagan o'yinlarni topib yopadi (har sekundda chaqiriladi) */
export function sweepTimeouts(onGameOver) {
  for (const game of games.values()) {
    if (game.status !== 'active' || !game.hasClock) continue;

    const before = game.status;
    game.syncClock();

    if (before === 'active' && game.status === 'finished') {
      onGameOver(game);
    }
  }
}

export { games };
