import { Telegraf, Markup } from 'telegraf';
import { config, isAdmin } from './config.js';
import { t } from './lib/i18n.js';
import * as api from './lib/api.js';

if (!config.TELEGRAM_TOKEN || config.TELEGRAM_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
  console.error('❌ TELEGRAM_TOKEN .env faylida yo\'q!');
  process.exit(1);
}
if (!config.INTERNAL_API_SECRET) {
  console.warn('⚠️  INTERNAL_API_SECRET .env da yo\'q — admin endpointlari (statistika/backup/restore) ishlamaydi.');
}

const bot = new Telegraf(config.TELEGRAM_TOKEN);

if (!/^https:\/\//.test(config.FRONTEND_URL)) {
  console.warn(`⚠️  FRONTEND_URL HTTPS emas: ${config.FRONTEND_URL}`);
  console.warn('   Telegram Mini App tugmasi ishlamaydi — HTTPS talab qilinadi.\n');
}

// ===== Xotiradagi holat (jarayon ichida yetarli — bitta bot instansi ishlaydi) =====
const session = new Map(); // telegramId(string) -> { mode: 'contact' | 'restore_wait_file' }

function getLang(user) {
  return user?.bot_lang || 'uz';
}

function mainKeyboard(lang, admin) {
  const rows = [
    [t('menuChess', lang)],
    [t('menuLang', lang), t('menuContact', lang)]
  ];
  if (admin) rows.push([t('menuAdmin', lang)]);
  return Markup.keyboard(rows).resize();
}

function adminInlineMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📊 Statistika', 'adm_stats')],
    [Markup.button.callback('📦 Backup yaratish', 'adm_backup')],
    [Markup.button.callback('♻️ Restore', 'adm_restore')],
    [Markup.button.callback('👥 Foydalanuvchilar', 'adm_users')]
  ]);
}

// ===== Majburiy kanal obunasi (barcha oddiy update'lar uchun, channel_post bundan mustasno) =====
bot.use(async (ctx, next) => {
  if (ctx.updateType === 'channel_post' || ctx.updateType === 'edited_channel_post') return next();
  if (!ctx.from) return next();

  try {
    const member = await ctx.telegram.getChatMember(`@${config.CHANNEL_USERNAME}`, ctx.from.id);
    if (['left', 'kicked'].includes(member.status)) {
      return sendJoinPrompt(ctx);
    }
  } catch (err) {
    console.error('Kanal a\'zoligini tekshirishda xato:', err.message);
  }
  return next();
});

async function sendJoinPrompt(ctx) {
  const lang = 'uz';
  await ctx.replyWithHTML(t('joinRequired', lang, config.CHANNEL_USERNAME), Markup.inlineKeyboard([
    [Markup.button.url("📢 Kanalga o'tish", `https://t.me/${config.CHANNEL_USERNAME}`)],
    [Markup.button.callback(t('checkSub', lang), 'check_sub')]
  ]));
}

bot.action('check_sub', async (ctx) => {
  try {
    const member = await ctx.telegram.getChatMember(`@${config.CHANNEL_USERNAME}`, ctx.from.id);
    if (['left', 'kicked'].includes(member.status)) {
      await ctx.answerCbQuery();
      return ctx.reply(t('stillNotSubbed', 'uz'));
    }
    await ctx.answerCbQuery('✅');
    await ctx.deleteMessage().catch(() => {});
    return startFlow(ctx);
  } catch (err) {
    await ctx.answerCbQuery();
    await ctx.reply('❌ Tekshirishda xato: ' + err.message);
  }
});

// ===== /start =====
bot.start(async (ctx) => startFlow(ctx));

async function startFlow(ctx) {
  const user = await api.telegramStart(
    ctx.from.id, ctx.from.username, ctx.from.first_name, ctx.from.last_name
  ).catch(err => { console.error('telegramStart xato:', err.message); return null; });

  const lang = getLang(user);
  const admin = isAdmin(ctx.from.id);

  await ctx.replyWithHTML(t('welcome', lang, ctx.from.first_name), mainKeyboard(lang, admin));
}

// ===== Asosiy menyu tugmalari =====
bot.hears(['♟️ Chess.uz'], async (ctx) => {
  await ctx.replyWithHTML(t('openSite', 'uz'), Markup.inlineKeyboard([
    [Markup.button.webApp(t('openSite', 'uz'), config.FRONTEND_URL)]
  ]));
});

bot.hears(['🌐 Til', '🌐 Язык', '🌐 Language'], async (ctx) => {
  await ctx.reply(t('chooseLang', 'uz'), Markup.inlineKeyboard([
    [Markup.button.callback('🇺🇿 O\'zbek', 'lang_uz'), Markup.button.callback('🇷🇺 Русский', 'lang_ru'), Markup.button.callback('🇬🇧 English', 'lang_en')]
  ]));
});

bot.action(/^lang_(uz|ru|en)$/, async (ctx) => {
  const lang = ctx.match[1];
  await api.setBotLang(ctx.from.id, lang).catch(() => {});
  await ctx.answerCbQuery();
  await ctx.editMessageReplyMarkup(null).catch(() => {});
  await ctx.reply(t('langSet', lang), mainKeyboard(lang, isAdmin(ctx.from.id)));
});

bot.hears(["💬 Admin bilan bog'lanish", '💬 Связаться с админом', '💬 Contact Admin'], async (ctx) => {
  session.set(String(ctx.from.id), { mode: 'contact' });
  await ctx.reply(t('contactAsk', 'uz'));
});

// ===== Admin panel kirishi =====
bot.hears(['🛠 Admin panel', '🛠 Админ-панель'], async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  await ctx.reply('🛠 Admin panel:', adminInlineMenu());
});

bot.action('adm_stats', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
  await ctx.answerCbQuery();
  try {
    const s = await api.adminStats(ctx.from.id);
    await ctx.replyWithHTML(
      `📊 <b>Statistika</b>\n\n` +
      `👥 Jami foydalanuvchilar: <b>${s.totalUsers}</b>\n` +
      `🆕 Bugun qo'shilgan: <b>${s.newToday}</b>\n` +
      `🗓 Shu hafta qo'shilgan: <b>${s.newWeek}</b>\n` +
      `📢 Jami broadcast: <b>${s.totalBroadcasts}</b>`
    );
  } catch (err) {
    await ctx.reply('❌ Statistika olinmadi: ' + err.message);
  }
});

bot.action('adm_users', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
  await ctx.answerCbQuery();
  try {
    const users = await api.adminUsers(ctx.from.id, 10);
    if (!users.length) return ctx.reply('Hozircha foydalanuvchi yo\'q.');
    const lines = users.map(u =>
      `• ${u.first_name || '—'} (@${u.username || '—'}) — <code>${u.telegram_id}</code>`
    );
    await ctx.replyWithHTML(`👥 <b>Oxirgi foydalanuvchilar</b>\n\n${lines.join('\n')}`);
  } catch (err) {
    await ctx.reply('❌ Ro\'yxat olinmadi: ' + err.message);
  }
});

// ===== Backup =====
bot.action('adm_backup', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
  await ctx.answerCbQuery();
  await ctx.reply('⏳ Backup yaratilmoqda, biroz kuting...');
  try {
    const result = await api.adminCreateBackup(ctx.from.id);
    if (!result.sent) {
      // Backup fayl serverda yaratildi, lekin Telegramga yuborishda xato chiqdi
      // (odatda: serverda Telegramga tarmoq ulanishi yo'q — VPN kerak bo'lishi mumkin)
      await ctx.reply(
        `⚠️ Backup fayl yaratildi (${result.fileName}), lekin yuborishda xatolik:\n` +
        `${result.sendError}\n\n` +
        `Server Telegram API'ga ulana olmayapti — server tomonda internet/VPN holatini tekshiring.`
      );
    }
    // Muvaffaqiyatli bo'lsa, fayl+hisobot backend tomonidan to'g'ridan-to'g'ri shu adminga yuboriladi.
  } catch (err) {
    await ctx.reply(`❌ Backup yaratishda xatolik.\nSabab: ${err.message}`);
  }
});

// ===== Restore =====
bot.action('adm_restore', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
  await ctx.answerCbQuery();
  session.set(String(ctx.from.id), { mode: 'restore_wait_file' });
  await ctx.reply('Backup faylni yuboring (.json).');
});

bot.on('document', async (ctx) => {
  const uid = String(ctx.from.id);
  const s = session.get(uid);

  if (!isAdmin(ctx.from.id) || !s || s.mode !== 'restore_wait_file') return;

  const doc = ctx.message.document;
  if (!doc.file_name?.toLowerCase().endsWith('.json')) {
    return ctx.reply("❌ Faqat .json formatdagi backup fayl qabul qilinadi (xavfsizlik sababli .sql qo'llab-quvvatlanmaydi).");
  }

  session.delete(uid);
  await ctx.reply('⏳ Fayl tekshirilmoqda...');

  try {
    const fileUrl = await ctx.telegram.getFileLink(doc.file_id);
    const res = await fetch(fileUrl.href || fileUrl);
    const buf = Buffer.from(await res.arrayBuffer());

    const check = await api.adminValidateRestore(ctx.from.id, buf);
    if (!check.valid) {
      return ctx.reply(`❌ Backup fayl yaroqsiz:\n${check.errors.join('\n')}`);
    }

    const countsLines = Object.entries(check.counts).map(([k, v]) => `• ${k}: ${v} ta`).join('\n');
    await ctx.reply(
      `⚠️ <b>DIQQAT!</b> Restore qilish hozirgi bazani almashtiradi.\n\n` +
      `Faylda topildi:\n${countsLines}\n\nDavom etilsinmi?`,
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Ha', `rst_ok:${check.token}`), Markup.button.callback('❌ Bekor qilish', 'rst_no')]
      ]) }
    );
  } catch (err) {
    await ctx.reply('❌ Fayl tekshirishda xatolik: ' + err.message);
  }
});

bot.action('rst_no', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageReplyMarkup(null).catch(() => {});
  await ctx.reply('Bekor qilindi.');
});

bot.action(/^rst_ok:(.+)$/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
  const token = ctx.match[1];
  await ctx.answerCbQuery();
  await ctx.editMessageReplyMarkup(null).catch(() => {});
  await ctx.reply('⏳ Restore boshlandi (avval xavfsizlik nusxasi olinmoqda)...');

  try {
    const result = await api.adminConfirmRestore(ctx.from.id, token);
    const c = result.restoredCounts;
    await ctx.replyWithHTML(
      `✅ <b>Restore muvaffaqiyatli yakunlandi.</b>\n\n` +
      `Tiklangan foydalanuvchilar: <b>${c.users ?? 0}</b>\n` +
      `Tiklangan o'yinlar: <b>${c.games ?? 0}</b>\n` +
      `Restore vaqti: <b>${(result.durationMs / 1000).toFixed(1)} soniya</b>`
    );
  } catch (err) {
    await ctx.reply(`❌ Restore amalga oshmadi.\nSabab: ${err.message}\nEski baza (xavfsizlik nusxasi) saqlangan.`);
  }
});

// ===== Contact Admin: foydalanuvchi xabarini adminga yo'naltirish =====
bot.on('text', async (ctx, next) => {
  const uid = String(ctx.from.id);
  const s = session.get(uid);
  if (!s || s.mode !== 'contact') return next();

  session.delete(uid);
  const header = `✉️ <b>${ctx.from.first_name || ''} ${ctx.from.last_name || ''}</b> ` +
                 `(@${ctx.from.username || '—'}, ID: <code>${ctx.from.id}</code>):\n\n`;

  for (const adminId of config.ADMIN_TELEGRAM_IDS) {
    try {
      const sent = await ctx.telegram.sendMessage(adminId, header + ctx.message.text, { parse_mode: 'HTML' });
      await api.contactThreadSave(sent.message_id, ctx.from.id).catch(() => {});
    } catch (err) {
      console.error('Admin xabar yuborishda xato:', err.message);
    }
  }

  await ctx.reply(t('contactSent', 'uz'));
});

// Admin forward qilingan xabarga REPLY qilsa — foydalanuvchiga yetkaziladi
bot.on('text', async (ctx, next) => {
  if (!isAdmin(ctx.from.id)) return next();
  const replyTo = ctx.message.reply_to_message;
  if (!replyTo) return next();

  const thread = await api.contactThreadGet(replyTo.message_id);
  if (!thread) return next();

  try {
    await ctx.telegram.sendMessage(
      thread.user_telegram_id,
      `${t('contactReplySent', 'uz')}\n\n${ctx.message.text}`,
      { parse_mode: 'HTML' }
    );
    await ctx.reply('✅ Yuborildi.');
  } catch (err) {
    await ctx.reply('❌ Yuborilmadi: ' + err.message);
  }
});

// ===== Kanal post — admin broadcast (belgilangan emoji bilan) =====
bot.on(['channel_post', 'edited_channel_post'], async (ctx) => {
  const post = ctx.channelPost || ctx.editedChannelPost;
  if (!post || post.chat?.username?.toLowerCase() !== config.CHANNEL_USERNAME.toLowerCase()) return;

  const text = post.text || post.caption || '';
  if (!text.includes(config.BROADCAST_MARKER)) return;

  const clean = text.split(config.BROADCAST_MARKER).join('').trim();
  let payload = null;

  if (post.photo?.length) {
    payload = { type: 'photo', fileId: post.photo[post.photo.length - 1].file_id, caption: clean, source: 'channel' };
  } else if (post.video) {
    payload = { type: 'video', fileId: post.video.file_id, caption: clean, source: 'channel' };
  } else if (text) {
    payload = { type: 'text', text: clean, source: 'channel' };
  }
  if (!payload) return;

  try {
    const adminId = config.ADMIN_TELEGRAM_IDS[0];
    const result = await api.adminBroadcast(adminId, payload);
    await ctx.telegram.sendMessage(adminId, `📢 Broadcast yuborildi: ${result.sent}/${result.total} foydalanuvchiga.`).catch(() => {});
  } catch (err) {
    console.error('Broadcast xatosi:', err.message);
  }
});

// ===== ERROR HANDLING =====
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('❌ Xato yuz berdi.').catch(() => {});
});

// ===== LAUNCH =====
//
// Render Free tarifida bot POLLING rejimida ishlay olmaydi: xizmat 15 daqiqa
// harakatsizlikdan keyin uxlab qoladi, va Telegram'dan kelayotgan getUpdates
// so'rovlari HAM inbound trafik hisoblanmaydi (bot o'zi Telegram'ga so'rov
// yuboradi, aksincha emas) — ya'ni polling serverni uyg'otmaydi va foydalanuvchi
// xabar yozganda hech narsa bo'lmaydi. Bundan tashqari, Render eski instansni
// yangi versiya bilan almashtirganda ikkita bot vaqtincha parallel ishlab,
// Telegram 409 Conflict qaytaradi va process.exit(1) butun combined jarayonni
// (backend bilan birga) o'ldiradi.
//
// Yechim: WEBHOOK rejimi. Telegram xabarni to'g'ridan-to'g'ri HTTP POST sifatida
// serverimizga yuboradi — bu HAQIQIY inbound so'rov, demak Render xizmatni
// uyg'otadi (UptimeRobot ping bilan birga amalda deyarli doim uyg'oq turadi).
// Bitta webhook har doim bitta faol instansga bog'lanadi, shu bilan 409 muammosi
// ham yo'qoladi.
//
// PUBLIC_URL — Render bergan tashqi manzil (masalan https://chess-uz.onrender.com).
// Agar berilmasa yoki HTTPS bo'lmasa, xavfsiz fallback sifatida polling'ga
// tushamiz (masalan lokal development uchun).

const PUBLIC_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
const WEBHOOK_PATH = `/telegram-webhook/${config.TELEGRAM_TOKEN}`;

export async function setupWebhook(app) {
  if (!/^https:\/\//.test(PUBLIC_URL)) {
    console.warn('⚠️  PUBLIC_URL (yoki RENDER_EXTERNAL_URL) HTTPS emas — webhook o\'rnatib bo\'lmaydi.');
    return false;
  }

  app.use(bot.webhookCallback(WEBHOOK_PATH));

  const webhookUrl = `${PUBLIC_URL}${WEBHOOK_PATH}`;
  await bot.telegram.setWebhook(webhookUrl, {
    drop_pending_updates: false,
    max_connections: 40
  });

  const info = await bot.telegram.getWebhookInfo();
  console.log(`✅ Bot webhook orqali ishga tushdi: @${config.TELEGRAM_BOT_USERNAME}`);
  console.log(`   Webhook URL: ${webhookUrl}`);
  if (info.last_error_message) {
    console.warn(`   ⚠️  Oxirgi webhook xatosi: ${info.last_error_message}`);
  }
  return true;
}

export async function launchPolling() {
  // Faqat webhook o'rnatib bo'lmaganda (masalan localhost dev) ishlatiladi.
  await bot.telegram.deleteWebhook({ drop_pending_updates: false }).catch(() => {});
  await bot.launch();
  launched = true;
  console.log(`✅ Bot POLLING orqali ishga tushdi (dev rejimi): @${config.TELEGRAM_BOT_USERNAME}`);
}

// bot.stop() faqat bot.launch() (polling) chaqirilgan bo'lsa ishlaydi — webhook
// rejimida bot.launch() umuman chaqirilmaydi, shu payt bot.stop() "Bot is not
// running!" xatosi bilan yiqiladi. Render har deploy/restart'da SIGTERM
// yuboradi, demak bu webhook rejimida DOIM ro'y beradigan qulash edi.
let launched = false;
process.once('SIGINT', () => { if (launched) bot.stop('SIGINT'); });
process.once('SIGTERM', () => { if (launched) bot.stop('SIGTERM'); });

export default bot;
