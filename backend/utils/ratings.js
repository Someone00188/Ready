// ELO reyting hisoblash

export function kFactor(gameCount) {
  if (gameCount < 30) return 40;
  if (gameCount < 100) return 25;
  return 16;
}

export function expectedScore(playerRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

/**
 * @param {number} rating - o'yinchi reytingi
 * @param {number} oppRating - raqib reytingi
 * @param {'win'|'loss'|'draw'} outcome
 * @param {number} gameCount - o'ynagan o'yinlar soni
 */
export function calculateELO(rating, oppRating, outcome, gameCount = 0) {
  const K = kFactor(gameCount);
  const expected = expectedScore(rating, oppRating);
  const actual = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
  const change = Math.round(K * (actual - expected));

  return { newRating: rating + change, change, expected: +expected.toFixed(3) };
}

/**
 * Natijadan ikkala tomon uchun reyting o'zgarishini hisoblaydi.
 * @param {string} result - '1-0' | '0-1' | '1/2-1/2'
 */
export function calculateBoth(whiteRating, blackRating, result, whiteGames = 0, blackGames = 0) {
  const whiteOutcome = result === '1-0' ? 'win' : result === '0-1' ? 'loss' : 'draw';
  const blackOutcome = result === '0-1' ? 'win' : result === '1-0' ? 'loss' : 'draw';

  return {
    white: calculateELO(whiteRating, blackRating, whiteOutcome, whiteGames),
    black: calculateELO(blackRating, whiteRating, blackOutcome, blackGames),
    whiteOutcome,
    blackOutcome
  };
}

export function getRatingCategory(rating) {
  if (rating < 1000) return 'Yangi';
  if (rating < 1200) return "Boshlang'ich";
  if (rating < 1400) return "O'rta";
  if (rating < 1600) return 'Yaxshi';
  if (rating < 1800) return 'Yuqori';
  if (rating < 2000) return 'Ekspert';
  return 'Usta';
}

export function getRatingEmoji(rating) {
  if (rating < 1000) return '🔴';
  if (rating < 1200) return '🟠';
  if (rating < 1400) return '🟡';
  if (rating < 1600) return '🟢';
  if (rating < 1800) return '🔵';
  if (rating < 2000) return '⚫';
  return '👑';
}
