// start-combined.js
//
// Render TEKIN tarifida "Background Worker" xizmat turi mavjud emas — faqat
// "Web Service" bepul. Shu sababli backend va telegram-botni BITTA jarayonda,
// bitta Web Service ichida ishga tushiramiz.
//
// Ishlatish: node start-combined.js   (Render startCommand shu bo'ladi)
//
// Eslatma: bu ikkalasini alohida serverlarga ajratishdan (production uchun
// tavsiya etiladigan usul) KO'RA yomonroq — chunki backend yoki bot birida xato
// bo'lsa ikkalasi ham to'xtashi mumkin. Pullik tarifga o'tganingizda render.yaml
// dagi ikkita alohida xizmatga qaytish tavsiya etiladi.

console.log('🚀 Combined mode: backend + telegram-bot bitta jarayonda ishga tushmoqda...\n');

// MUHIM: import tartibi va ishga tushirish ketma-ketligi qat'iy nazorat qilinadi,
// aks holda "webhook hali ro'yxatga olinmagan paytda server allaqachon start
// bo'lib ketishi" kabi poyga holati (race condition) yuzaga kelishi mumkin edi
// (avvalgi versiyada shu bor edi — server.js top-level'da o'zini avtomatik
// ishga tushirar edi). Endi ikkalasi ham FAQAT shu yerdan, aniq tartibda
// chaqiriladi:
//
//   1) backend/server.js import qilinadi — bu FAQAT Express app, HTTP server,
//      Socket.io va route'larni tayyorlaydi; hech narsani ishga tushirmaydi
//      (chunki bu fayl endi "asosiy modul" emas — start() avtomatik chaqirilmaydi).
//   2) telegram-bot/bot.js import qilinadi — bu FAQAT bot handler'larini
//      ro'yxatga oladi; hech narsani ishga tushirmaydi (launch() chaqirilmaydi).
//   3) Bot webhook callback'ini app'ga ulash uchun hook ro'yxatga olinadi.
//   4) Nihoyat server.start() chaqiriladi — bu DB'ni tayyorlaydi, backup
//      restore/scheduler'ni ishga tushiradi, keyin webhook hook'ni chaqiradi
//      (shu payt app'ga bot route'i qo'shiladi), va FAQAT shundan keyin
//      server.listen() qiladi. Demak PORT ochilguncha webhook allaqachon tayyor.
const serverModule = await import('./backend/server.js');
const botModule = await import('./telegram-bot/bot.js');

// Bot'ni POLLING emas, WEBHOOK orqali ulaymiz (bot.js'dagi izohga qarang):
// Render Free'da polling serverni hech qachon uyg'otmaydi va deploy paytida
// 409 Conflict bilan butun jarayonni yiqitishi mumkin.
serverModule.onReadyForWebhook(async (app) => {
  const ok = await botModule.setupWebhook(app);
  if (!ok) {
    // PUBLIC_URL yo'q bo'lsa (masalan lokal ishga tushirilganda) — pollingga tushamiz.
    await botModule.launchPolling();
  }
});

await serverModule.start();
