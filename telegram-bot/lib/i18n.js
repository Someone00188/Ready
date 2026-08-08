// telegram-bot/lib/i18n.js
// Botning asosiy matnlari uchun UZ/RU/EN. Sayt tili bundan mustaqil (frontend'da alohida).

const STRINGS = {
  welcome: {
    uz: (name) => `♟ <b>Salom, ${name}!</b>\n\nShaxmat o'ynash uchun quyidagi tugma orqali saytga o'ting.`,
    ru: (name) => `♟ <b>Привет, ${name}!</b>\n\nНажмите кнопку ниже, чтобы открыть сайт и играть в шахматы.`,
    en: (name) => `♟ <b>Hi, ${name}!</b>\n\nTap the button below to open the site and play chess.`
  },
  openSite: {
    uz: '🌐 Chess.uz saytiga kirish',
    ru: '🌐 Открыть Chess.uz',
    en: '🌐 Open Chess.uz'
  },
  menuChess: { uz: '♟️ Chess.uz', ru: '♟️ Chess.uz', en: '♟️ Chess.uz' },
  menuLang: { uz: '🌐 Til', ru: '🌐 Язык', en: '🌐 Language' },
  menuContact: { uz: '💬 Admin bilan bog\'lanish', ru: '💬 Связаться с админом', en: '💬 Contact Admin' },
  menuAdmin: { uz: '🛠 Admin panel', ru: '🛠 Админ-панель', en: '🛠 Admin panel' },
  joinRequired: {
    uz: (ch) => `⚠️ Botdan foydalanish uchun avval kanalimizga a'zo bo'ling:\nhttps://t.me/${ch}\n\nA'zo bo'lgach, pastdagi tugmani bosing.`,
    ru: (ch) => `⚠️ Чтобы пользоваться ботом, сначала подпишитесь на канал:\nhttps://t.me/${ch}\n\nПосле подписки нажмите кнопку ниже.`,
    en: (ch) => `⚠️ Please join our channel first to use the bot:\nhttps://t.me/${ch}\n\nThen tap the button below.`
  },
  checkSub: { uz: '✅ Tekshirish', ru: '✅ Проверить', en: '✅ Check' },
  stillNotSubbed: {
    uz: "❌ Hali a'zo emassiz. Kanalga qo'shilib, qayta urinib ko'ring.",
    ru: '❌ Вы ещё не подписаны. Подпишитесь и попробуйте снова.',
    en: "❌ You haven't joined yet. Join and try again."
  },
  chooseLang: { uz: 'Tilni tanlang:', ru: 'Выберите язык:', en: 'Choose a language:' },
  langSet: { uz: '✅ Til o\'zgartirildi.', ru: '✅ Язык изменён.', en: '✅ Language updated.' },
  contactAsk: {
    uz: '✍️ Xabaringizni yozing — administratorga yuboriladi.',
    ru: '✍️ Напишите сообщение — оно будет отправлено администратору.',
    en: '✍️ Type your message — it will be sent to the administrator.'
  },
  contactSent: { uz: '✅ Xabaringiz administratorga yuborildi.', ru: '✅ Ваше сообщение отправлено администратору.', en: '✅ Your message was sent to the admin.' },
  contactReplySent: { uz: '📩 Administratordan javob keldi:', ru: '📩 Ответ администратора:', en: '📩 Reply from admin:' }
};

export function t(key, lang = 'uz', ...args) {
  const entry = STRINGS[key];
  if (!entry) return key;
  const val = entry[lang] || entry.uz;
  return typeof val === 'function' ? val(...args) : val;
}
