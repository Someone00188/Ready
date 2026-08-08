// Profil stikerlari — Twemoji (jdecked/twemoji) asosida.
// Manba: https://github.com/jdecked/twemoji — Kod: MIT, Grafika: CC-BY 4.0 (Copyright Twitter, Inc va boshqa hissa qo'shuvchilar)
// SVG fayllar SVGO bilan optimallashtirilib /public/stickers/ papkasiga joylashtirilgan.

export const STICKER_CATEGORIES = [
  { id: 'chess', label: 'Chess', icon: 'fa-solid fa-chess' },
  { id: 'rank', label: 'Rank', icon: 'fa-solid fa-ranking-star' },
  { id: 'achievement', label: 'Achievement', icon: 'fa-solid fa-trophy' },
  { id: 'premium', label: 'Premium', icon: 'fa-solid fa-crown' },
  { id: 'fun', label: 'Fun', icon: 'fa-solid fa-face-grin-stars' },
  { id: 'men', label: 'Men', icon: 'fa-solid fa-person' },
  { id: 'women', label: 'Women', icon: 'fa-solid fa-person-dress' },
  { id: 'country', label: 'Country', icon: 'fa-solid fa-flag' },
  { id: 'seasonal', label: 'Seasonal', icon: 'fa-solid fa-snowflake' }
];

export const STICKERS = [
  { id: 'chess_king', category: 'chess', label: 'King', file: 'chess_king.svg' },
  { id: 'chess_queen', category: 'chess', label: 'Pawn', file: 'chess_queen.svg' },
  { id: 'chess_knight', category: 'chess', label: 'Knight', file: 'chess_knight.svg' },
  { id: 'chess_castle', category: 'chess', label: 'Castle', file: 'chess_castle.svg' },
  { id: 'chess_bishop', category: 'chess', label: 'Bishop', file: 'chess_bishop.svg' },

  { id: 'rank_gold', category: 'rank', label: 'Gold', file: 'rank_gold.svg' },
  { id: 'rank_silver', category: 'rank', label: 'Silver', file: 'rank_silver.svg' },
  { id: 'rank_bronze', category: 'rank', label: 'Bronze', file: 'rank_bronze.svg' },
  { id: 'rank_star', category: 'rank', label: 'Star', file: 'rank_star.svg' },
  { id: 'rank_medal', category: 'rank', label: 'Medal', file: 'rank_medal.svg' },

  { id: 'ach_trophy', category: 'achievement', label: 'Trophy', file: 'ach_trophy.svg' },
  { id: 'ach_fire', category: 'achievement', label: 'Fire Streak', file: 'ach_fire.svg' },
  { id: 'ach_target', category: 'achievement', label: 'Bullseye', file: 'ach_target.svg' },
  { id: 'ach_rocket', category: 'achievement', label: 'Rocket', file: 'ach_rocket.svg' },
  { id: 'ach_bolt', category: 'achievement', label: 'Lightning', file: 'ach_bolt.svg' },

  { id: 'prem_crown', category: 'premium', label: 'Crown', file: 'prem_crown.svg' },
  { id: 'prem_gem', category: 'premium', label: 'Diamond', file: 'prem_gem.svg' },
  { id: 'prem_star2', category: 'premium', label: 'Glow Star', file: 'prem_star2.svg' },
  { id: 'prem_money', category: 'premium', label: 'Money Bag', file: 'prem_money.svg' },
  { id: 'prem_ring', category: 'premium', label: 'Ring', file: 'prem_ring.svg' },

  { id: 'fun_ghost', category: 'fun', label: 'Ghost', file: 'fun_ghost.svg' },
  { id: 'fun_alien', category: 'fun', label: 'Alien', file: 'fun_alien.svg' },
  { id: 'fun_robot', category: 'fun', label: 'Robot', file: 'fun_robot.svg' },
  { id: 'fun_unicorn', category: 'fun', label: 'Unicorn', file: 'fun_unicorn.svg' },
  { id: 'fun_partyface', category: 'fun', label: 'Party', file: 'fun_partyface.svg' },

  { id: 'men_king', category: 'men', label: 'Prince', file: 'men_king.svg' },
  { id: 'men_detective', category: 'men', label: 'Detective', file: 'men_detective.svg' },
  { id: 'men_superhero', category: 'men', label: 'Superhero', file: 'men_superhero.svg' },
  { id: 'men_ninja', category: 'men', label: 'Ninja', file: 'men_ninja.svg' },
  { id: 'men_cowboy', category: 'men', label: 'Cowboy', file: 'men_cowboy.svg' },

  { id: 'women_queen', category: 'women', label: 'Princess', file: 'women_queen.svg' },
  { id: 'women_fairy', category: 'women', label: 'Fairy', file: 'women_fairy.svg' },
  { id: 'women_superhero', category: 'women', label: 'Superhero', file: 'women_superhero.svg' },
  { id: 'women_dancer', category: 'women', label: 'Dancer', file: 'women_dancer.svg' },
  { id: 'women_scientist', category: 'women', label: 'Scientist', file: 'women_scientist.svg' },

  { id: 'country_uz', category: 'country', label: 'Uzbekistan', file: 'country_uz.svg' },
  { id: 'country_us', category: 'country', label: 'USA', file: 'country_us.svg' },
  { id: 'country_gb', category: 'country', label: 'UK', file: 'country_gb.svg' },
  { id: 'country_ru', category: 'country', label: 'Russia', file: 'country_ru.svg' },
  { id: 'country_tr', category: 'country', label: 'Turkey', file: 'country_tr.svg' },
  { id: 'country_de', category: 'country', label: 'Germany', file: 'country_de.svg' },
  { id: 'country_fr', category: 'country', label: 'France', file: 'country_fr.svg' },
  { id: 'country_kz', category: 'country', label: 'Kazakhstan', file: 'country_kz.svg' },

  { id: 'season_xmas', category: 'seasonal', label: 'Christmas', file: 'season_xmas.svg' },
  { id: 'season_pumpkin', category: 'seasonal', label: 'Halloween', file: 'season_pumpkin.svg' },
  { id: 'season_firework', category: 'seasonal', label: 'Fireworks', file: 'season_firework.svg' },
  { id: 'season_snowman', category: 'seasonal', label: 'Snowman', file: 'season_snowman.svg' },
  { id: 'season_flower', category: 'seasonal', label: 'Blossom', file: 'season_flower.svg' }
];

export function getStickerById(id) {
  return STICKERS.find(s => s.id === id) || null;
}

export function stickerUrl(idOrFile) {
  if (!idOrFile) return null;
  const s = STICKERS.find(st => st.id === idOrFile);
  const file = s ? s.file : idOrFile;
  return `/stickers/${file}`;
}

export default STICKERS;
