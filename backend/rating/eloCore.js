// Sof Elo matematikasi. Hech qanday DB yoki yon ta'sir (side effect) yo'q —
// faqat raqamlar kiradi, raqamlar chiqadi. Test qilish va qayta ishlatish oson.

/** Kutilgan natija (0..1 oralig'ida) — standart Elo formulasi */
export function expectedScore(rating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
}

/** 'win' | 'draw' | 'loss' -> 1 | 0.5 | 0 */
export function outcomeScore(outcome) {
  if (outcome === 'win') return 1;
  if (outcome === 'draw') return 0.5;
  return 0;
}

/** Eng oddiy Elo o'zgarishi: K * (haqiqiy - kutilgan) */
export function basicDelta(rating, opponentRating, outcome, K) {
  const expected = expectedScore(rating, opponentRating);
  const actual = outcomeScore(outcome);
  return K * (actual - expected);
}
