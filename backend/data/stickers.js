// Backend validatsiya uchun sticker ID'lar ro'yxati.
// Frontend'dagi src/data/stickers.js bilan sinxron saqlanadi.
export const VALID_STICKER_IDS = new Set([
  'chess_king','chess_queen','chess_knight','chess_castle','chess_bishop',
  'rank_gold','rank_silver','rank_bronze','rank_star','rank_medal',
  'ach_trophy','ach_fire','ach_target','ach_rocket','ach_bolt',
  'prem_crown','prem_gem','prem_star2','prem_money','prem_ring',
  'fun_ghost','fun_alien','fun_robot','fun_unicorn','fun_partyface',
  'men_king','men_detective','men_superhero','men_ninja','men_cowboy',
  'women_queen','women_fairy','women_superhero','women_dancer','women_scientist',
  'country_uz','country_us','country_gb','country_ru','country_tr','country_de','country_fr','country_kz',
  'season_xmas','season_pumpkin','season_firework','season_snowman','season_flower'
]);

export function isValidSticker(id) {
  return VALID_STICKER_IDS.has(id);
}
