// Placement (dastlabki reyting aniqlash) va normal reyting tizimi sozlamalari.
// Barcha "sehrli sonlar" shu yerda — kelajakda sozlash kerak bo'lsa faqat shu faylni o'zgartirish kifoya.

// 1) Ro'yxatdan o'tishda ko'rsatiladigan 5 ta dastlabki baholash varianti.
//    Bu FAQAT boshlang'ich taxmin — yakuniy reyting emas.
export const ESTIMATE_OPTIONS = [
  { key: 'beginner',     label: 'Beginner',     desc: "Just learning the rules",     value: 400  },
  { key: 'casual',       label: 'Casual',       desc: "I play sometimes",            value: 700  },
  { key: 'intermediate', label: 'Intermediate', desc: "I know openings & tactics",   value: 1000 },
  { key: 'advanced',     label: 'Advanced',     desc: "I play competitively",        value: 1300 },
  { key: 'expert',       label: 'Expert',       desc: "I have serious experience",   value: 1600 }
];

// 2) Har bir toifada (bullet/normal/long) nechta "placement" o'yin o'ynash kerak.
export const PLACEMENT_GAMES = 5;

// 3) Har bir placement o'yini uchun asosiy K-koeffitsient (reyting o'zgarish kattaligi).
//    Birinchi o'yin eng katta, oxirgisi eng kichik — tezda haqiqiy darajaga yaqinlashish uchun.
export const PLACEMENT_K_SCHEDULE = [200, 150, 120, 80, 50];

// 4) Placement tugagach — oddiy Elo. K odatda 8..20 oralig'ida (raqib kuchiga qarab).
export const NORMAL_K_MIN = 8;
export const NORMAL_K_MAX = 20;
export const NORMAL_K_NEW_PLAYER = 24; // placement tugagandan keyingi ilk ~20 o'yin biroz yuqoriroq K

// 5) Matchmaking (Quick Play): shu oralig'dagi raqib "mos" hisoblanadi.
export const MATCHMAKING_RATING_WINDOW = 75;

// 6) Mos raqib topilmasa (o'yinchilar kam bo'lganda), eng yaqinini biriktiramiz,
//    lekin reyting o'zgarishi (ham + ham -) shu koeffitsientga ko'paytiriladi.
export const MISMATCH_PENALTY_FACTOR = 0.5;

// 7) Placement natijasini qayta boshlash (Reset) — suiiste'mol qilinmasligi uchun,
//    placement tugagandan keyin shu toifada kamida shuncha o'yin o'ynagan bo'lishi kerak.
export const RESET_MIN_GAMES_SINCE_PLACEMENT = 10;

// Performance-tahlil kuchaytirish koeffitsientlari (placement davomida)
export const PERFORMANCE = {
  strongOpponentThreshold: 150,   // raqib shundan ko'p yuqori bo'lsa "kuchli raqib"
  strongOpponentBoost: 1.35,      // ...yutsa, ijobiy o'zgarish shuncha marta kattalashadi
  weakOpponentThreshold: 150,     // raqib shundan ko'p past bo'lsa "kuchsiz raqib"
  weakOpponentPenalty: 1.35,      // ...yutqazsa, salbiy o'zgarish shuncha marta kattalashadi
  streakLength: 2,                // shuncha ketma-ket bir xil natija — "streak" hisoblanadi
  streakBoost: 1.15,               // streak yo'nalishida qo'shimcha kuchaytirish
  inconsistencyDamp: 0.9,         // natijalar aralash (streak yo'q) bo'lsa, ozroq yumshatish
  maxDeltaMultiplier: 1.6         // xavfsizlik chegarasi: delta bazaviy K'dan bunchalik ko'p oshmasin
};
