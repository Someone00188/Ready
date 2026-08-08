import { NORMAL_K_MIN, NORMAL_K_MAX, NORMAL_K_NEW_PLAYER } from './config.js';

/**
 * Placement tugagandan keyingi K-koeffitsient.
 * Yangi (placementdan keyingi ~20 o'yin) — biroz yuqoriroq K, keyin standart 8..20 oralig'iga tushadi.
 * Raqib reytingi farqi katta bo'lsa (masalan kuchli o'yinchi juda kuchsiz bilan o'ynasa),
 * K ozroq kamaytiriladi — kutilmagan natija reytingni ortiqcha "silkitib" yubormasin.
 */
export function normalKFactor(gamesAfterPlacement, ratingGapAbs = 0) {
  let K = gamesAfterPlacement < 20 ? NORMAL_K_NEW_PLAYER : NORMAL_K_MAX;
  K = Math.max(NORMAL_K_MIN, K - Math.floor(ratingGapAbs / 200));
  return Math.min(NORMAL_K_MAX + 4, Math.max(NORMAL_K_MIN, K));
}
