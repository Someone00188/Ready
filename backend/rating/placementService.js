import { expectedScore, outcomeScore, basicDelta } from './eloCore.js';
import { PLACEMENT_GAMES, PLACEMENT_K_SCHEDULE, PERFORMANCE } from './config.js';

/**
 * Oldingi placement o'yinlaridan streak/consistency signalini chiqaradi.
 * @param {Array<{outcome:string}>} priorGames - shu toifadagi avvalgi placement o'yinlari (eskidan yangiga)
 */
function analyzeForm(priorGames) {
  if (priorGames.length === 0) return { streak: 0, streakOutcome: null, consistent: true };

  const last = priorGames[priorGames.length - 1].outcome;
  let streak = 1;
  for (let i = priorGames.length - 2; i >= 0; i--) {
    if (priorGames[i].outcome === last) streak++;
    else break;
  }

  // Consistency: oxirgi 3 ta natija ichida kamida 2 tasi bir xil bo'lsa "izchil" hisoblanadi
  const recent = priorGames.slice(-3).map(g => g.outcome);
  const counts = recent.reduce((acc, o) => ({ ...acc, [o]: (acc[o] || 0) + 1 }), {});
  const consistent = Object.values(counts).some(c => c >= 2) || recent.length < 2;

  return { streak, streakOutcome: last, consistent };
}

/**
 * Bitta placement o'yini uchun reyting o'zgarishini hisoblaydi — nafaqat W/L,
 * balki raqib kuchi, streak va izchillikni ham hisobga oladi.
 *
 * @param {object} p
 * @param {number} p.rating - o'yinchining joriy (provisional) reytingi
 * @param {number} p.opponentRating - raqib reytingi
 * @param {'win'|'draw'|'loss'} p.outcome
 * @param {number} p.gameNumber - 1..PLACEMENT_GAMES
 * @param {Array<{outcome:string, opponentRating:number}>} p.priorGames - shu toifadagi avvalgi placement o'yinlari
 * @returns {{ delta:number, newRating:number, meta:object }}
 */
export function computePlacementDelta({ rating, opponentRating, outcome, gameNumber, priorGames = [] }) {
  const idx = Math.min(gameNumber, PLACEMENT_K_SCHEDULE.length) - 1;
  const K = PLACEMENT_K_SCHEDULE[idx];

  let delta = basicDelta(rating, opponentRating, outcome, K);

  const ratingGap = opponentRating - rating; // musbat = raqib kuchliroq
  let appliedBoost = null;

  // Kuchli raqibni yutish — kattaroq mukofot
  if (outcome === 'win' && ratingGap >= PERFORMANCE.strongOpponentThreshold) {
    delta *= PERFORMANCE.strongOpponentBoost;
    appliedBoost = 'strong_opponent_win';
  }
  // Kuchsiz raqibga yutqazish — kattaroq jazo (delta manfiy, shuning uchun ko'paytirish jazoni kuchaytiradi)
  else if (outcome === 'loss' && -ratingGap >= PERFORMANCE.weakOpponentThreshold) {
    delta *= PERFORMANCE.weakOpponentPenalty;
    appliedBoost = 'weak_opponent_loss';
  }

  // Streak: bir xil yo'nalishda davom etayotgan bo'lsa, tezroq haqiqiy darajaga yaqinlashtiramiz
  const form = analyzeForm(priorGames);
  if (form.streak >= PERFORMANCE.streakLength) {
    if (form.streakOutcome === 'win' && outcome === 'win') { delta *= PERFORMANCE.streakBoost; appliedBoost = (appliedBoost || '') + '+win_streak'; }
    else if (form.streakOutcome === 'loss' && outcome === 'loss') { delta *= PERFORMANCE.streakBoost; appliedBoost = (appliedBoost || '') + '+loss_streak'; }
  } else if (!form.consistent) {
    // Natijalar aralash (g'alaba/mag'lubiyat almashinib turibdi) — ozroq yumshatamiz,
    // chunki hali aniq tendensiya yo'q
    delta *= PERFORMANCE.inconsistencyDamp;
  }

  // Xavfsizlik chegarasi — hech qachon bazaviy K'dan haddan tashqari oshib ketmasin
  const cap = K * PERFORMANCE.maxDeltaMultiplier;
  delta = Math.max(-cap, Math.min(cap, delta));
  delta = Math.round(delta);

  return {
    delta,
    newRating: Math.max(100, rating + delta), // 100 dan pastga tushmasin
    meta: { K, ratingGap, form, appliedBoost }
  };
}

export function isPlacementComplete(gamesPlayedInCategory) {
  return gamesPlayedInCategory >= PLACEMENT_GAMES;
}
