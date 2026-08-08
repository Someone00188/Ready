// backend/game/matchmaking.js
//
// Quick Match: reyting bo'yicha avtomatik raqib topish.
// - Odatiy holat: ±75 reyting oralig'ida raqib qidiriladi, topilsa darhol o'yin boshlanadi.
// - Agar o'yinchilar kam bo'lib, WIDE_MATCH_TIMEOUT_MS ichida mos raqib topilmasa —
//   navbatdagi ENG YAQIN raqib bilan baribir o'ynatiladi, lekin bu match "wide" deb
//   belgilanadi (gameManager.finalizeGame da rating o'zgarishi 2 marta kamaytiriladi).
//
// Xotirada ishlaydi (in-memory) — bir nechta server instansiyasi bo'lsa, Redis kabi
// tashqi navbat kerak bo'ladi (hozircha bitta instansiya uchun yetarli).

import * as gm from './gameManager.js';
import * as q from '../db/queries.js';
import { ratingColumn } from '../config.js';

export const RATING_TOLERANCE = 75;
const WIDE_MATCH_TIMEOUT_MS = 15_000;

// timeMode -> Map<userId, QueueEntry>
const queues = new Map();

function getQueue(timeMode) {
  if (!queues.has(timeMode)) queues.set(timeMode, new Map());
  return queues.get(timeMode);
}

function findBestMatch(queueMap, rating, tolerance, excludeUid = null) {
  let best = null;
  let bestDiff = Infinity;
  for (const entry of queueMap.values()) {
    if (entry.userId === excludeUid) continue;
    const diff = Math.abs(entry.rating - rating);
    if (diff <= tolerance && diff < bestDiff) {
      best = entry;
      bestDiff = diff;
    }
  }
  return best;
}

async function createMatchedGame(playerA, playerB, timeMode, wideMatch) {
  const game = await gm.createGame({
    whiteId: playerA.userId, whiteName: playerA.username, timeMode, gameMode: '1v1'
  });
  game.addBlackPlayer(playerB.userId, playerB.username);
  await q.setBlackPlayer(game.id, playerB.userId, playerB.username);

  if (wideMatch) {
    game.wideMatch = true;
    await q.setWideMatch(game.id).catch(() => {});
  }

  return { gameId: game.id, wideMatch };
}

/**
 * Navbatga qo'shiladi. Moslik topilsa ikkala tomon uchun ham onMatched(result) chaqiriladi
 * (chaqiruvchi o'zi uchun ham, oldin navbatda kutayotgan uchun ham).
 * @param {(result:{gameId:string, wideMatch:boolean}) => void} onMatched
 */
export async function joinQueue(userId, username, timeMode, onMatched) {
  const uid = String(userId);
  const queue = getQueue(timeMode);
  if (queue.has(uid)) return; // allaqachon navbatda

  const user = await q.getOrCreateUser(uid, username);
  const col = ratingColumn(timeMode) || 'rating_bullet';
  const rating = user[col];

  // 1) Darhol ±75 ichida moslik qidiramiz
  const opponent = findBestMatch(queue, rating, RATING_TOLERANCE);
  if (opponent) {
    queue.delete(opponent.userId);
    clearTimeout(opponent.timer);
    const result = await createMatchedGame(opponent, { userId: uid, username, rating }, timeMode, false);
    opponent.onMatched(result);
    onMatched(result);
    return;
  }

  // 2) Topilmadi — navbatga qo'shamiz, WIDE_MATCH_TIMEOUT_MS dan keyin eng yaqinini kutamiz
  const entry = { userId: uid, username, rating, onMatched, joinedAt: Date.now() };
  entry.timer = setTimeout(() => tryWideMatch(timeMode, uid), WIDE_MATCH_TIMEOUT_MS);
  queue.set(uid, entry);
}

async function tryWideMatch(timeMode, uid) {
  const queue = getQueue(timeMode);
  const current = queue.get(uid);
  if (!current) return;

  const opponent = findBestMatch(queue, current.rating, Infinity, uid);
  if (!opponent) {
    // Hali ham hech kim yo'q — qayta-qayta tekshirib turamiz, toki kimdir kelguncha
    current.timer = setTimeout(() => tryWideMatch(timeMode, uid), WIDE_MATCH_TIMEOUT_MS);
    return;
  }

  queue.delete(uid);
  queue.delete(opponent.userId);
  clearTimeout(opponent.timer);

  const result = await createMatchedGame(current, opponent, timeMode, true);
  current.onMatched(result);
  opponent.onMatched(result);
}

export function leaveQueue(userId, timeMode) {
  const queue = getQueue(timeMode);
  const entry = queue.get(String(userId));
  if (entry?.timer) clearTimeout(entry.timer);
  queue.delete(String(userId));
}

export function leaveAllQueues(userId) {
  for (const timeMode of queues.keys()) leaveQueue(userId, timeMode);
}

export function isInQueue(userId, timeMode) {
  return getQueue(timeMode).has(String(userId));
}

export function queueSize(timeMode) {
  return getQueue(timeMode).size;
}
