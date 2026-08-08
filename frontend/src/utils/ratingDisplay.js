export function getRatingCategory(rating) {
  if (rating == null) return '';
  if (rating < 1000) return 'Yangi';
  if (rating < 1200) return "Boshlang'ich";
  if (rating < 1400) return "O'rta";
  if (rating < 1600) return 'Yaxshi';
  if (rating < 1800) return 'Yuqori';
  if (rating < 2000) return 'Ekspert';
  return 'Usta';
}

export function getRatingEmoji(rating) {
  if (rating == null) return '';
  if (rating < 1000) return '🔴';
  if (rating < 1200) return '🟠';
  if (rating < 1400) return '🟡';
  if (rating < 1600) return '🟢';
  if (rating < 1800) return '🔵';
  if (rating < 2000) return '⚫';
  return '👑';
}
