// backend/utils/placement.js
//
// Yangi foydalanuvchi uchun professional "placement" (joylashtirish) tizimi.
// G'oya: foydalanuvchi o'z darajasini bilmaydi — tizim buni 5 ta o'yin
// davomida avtomatik aniqlaydi. Chess.com uslubiga o'xshash, lekin soddalashtirilgan.
//
// Bu fayl faqat SOF HISOB-KITOB — DB yoki socket bilan ishlamaydi (queries.js
// va gameManager.js orqali chaqiriladi). Shu tarzda mustaqil test qilinishi
// va kelajakda o'zgartirilishi oson.

/** Ro'yxatdan o'tishda ko'rsatiladigan 5 ta o'z-o'zini baholash darajasi */
export const ESTIMATE_LEVELS = {
  beginner:     { rating: 400,  label: 'Beginner',     labelUz: 'Boshlang\'ich' },
  casual:       { rating: 700,  label: 'Casual',        labelUz: 'Havaskor' },
  intermediate: { rating: 1000, label: 'Intermediate',  labelUz: "O'rta" },
  advanced:     { rating: 1300, label: 'Advanced',      labelUz: 'Yaxshi' },
  expert:       { rating: 1600, label: 'Expert',        labelUz: 'Ekspert' }
};

export const PLACEMENT_GAMES_REQUIRED = 5;

// Har bir placement o'yini uchun K-omil (o'zgarish kattaligi) — 1-o'yin eng katta,
// 5-o'yinga kelib normal reytingga yaqinlashadi.
const PLACEMENT_K = [200, 150, 120, 80, 50];

// Kutilmagan natija uchun qo'shimcha bonus/jarima koeffitsienti va tavaqqi
const SURPRISE_THRESHOLD = 150;   // shu darajadan katta farq "kutilmagan" hisoblanadi
const SURPRISE_BONUS_RATE = 0.25; // farqning necha foizi bonusga aylanadi
const SURPRISE_BONUS_CAP = 75;    // bonusning maksimal qiymati

// Ketma-ket 3+ bir xil natija — "consistency" signali
const STREAK_THRESHOLD = 3;
const STREAK_BONUS = 15;

export function isValidEstimate(key) {
  return Object.prototype.hasOwnProperty.call(ESTIMATE_LEVELS, key);
}

export function estimateToRating(key) {
  return ESTIMATE_LEVELS[key]?.rating ?? null;
}

export function expectedScore(rating, oppRating) {
  return 1 / (1 + Math.pow(10, (oppRating - rating) / 400));
}

/**
 * Bitta placement o'yinidan keyingi provisional (vaqtinchalik) reytingni hisoblaydi.
 *
 * @param {number} rating - joriy provisional reyting (o'yindan OLDIN)
 * @param {number} oppRating - raqib reytingi (provisional yoki doimiy — farqi yo'q)
 * @param {'win'|'loss'|'draw'} outcome
 * @param {number} gamesPlayedBefore - shu o'yingacha necha placement o'yin o'ynalgan (0..4)
 * @param {number} streakBefore - joriy ketma-ketlik: musbat=g'alaba, manfiy=mag'lubiyat, 0=hali yo'q/draw bilan uzilgan
 * @returns {{newRating:number, change:number, newStreak:number, expected:number}}
 */
export function calculatePlacementStep(rating, oppRating, outcome, gamesPlayedBefore, streakBefore = 0) {
  const K = PLACEMENT_K[Math.min(gamesPlayedBefore, PLACEMENT_K.length - 1)];
  const expected = expectedScore(rating, oppRating);
  const actual = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;

  let change = K * (actual - expected);

  // Performance tahlili: kutilmagan natija uchun qo'shimcha signal
  const ratingGap = oppRating - rating; // musbat = raqib kuchliroq ko'rinadi
  if (outcome === 'win' && ratingGap > SURPRISE_THRESHOLD) {
    change += Math.min(ratingGap - SURPRISE_THRESHOLD, SURPRISE_BONUS_CAP / SURPRISE_BONUS_RATE) * SURPRISE_BONUS_RATE;
  } else if (outcome === 'loss' && ratingGap < -SURPRISE_THRESHOLD) {
    change -= Math.min(-ratingGap - SURPRISE_THRESHOLD, SURPRISE_BONUS_CAP / SURPRISE_BONUS_RATE) * SURPRISE_BONUS_RATE;
  }

  // Ketma-ketlik (win/loss streak) — barqarorlik signali
  const newStreak = outcome === 'win' ? Math.max(streakBefore, 0) + 1
                   : outcome === 'loss' ? Math.min(streakBefore, 0) - 1
                   : 0; // draw ketma-ketlikni uzadi

  if (Math.abs(newStreak) >= STREAK_THRESHOLD) {
    change += Math.sign(newStreak) * STREAK_BONUS;
  }

  const newRating = Math.max(100, Math.round(rating + change));
  return { newRating, change: Math.round(change), newStreak, expected: +expected.toFixed(3) };
}

export function isPlacementComplete(gamesPlayed) {
  return gamesPlayed >= PLACEMENT_GAMES_REQUIRED;
}
