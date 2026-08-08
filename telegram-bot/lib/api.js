// telegram-bot/lib/api.js
//
// Bot jarayoni ma'lumotlar bazasiga TO'G'RIDAN-TO'G'RI kirmaydi — buni faqat backend
// qiladi. Bot faqat shu HTTP klient orqali backend bilan gaplashadi. Bu ikkita jarayon
// bir xil SQLite faylini parallel yozishidan kelib chiqadigan muammolarning oldini oladi.

import { config } from '../config.js';

const BASE = config.BACKEND_URL.replace(/\/$/, '');

async function req(method, path, { body, isRaw, headers = {} } = {}) {
  const opts = { method, headers: { ...headers } };

  if (isRaw) {
    opts.headers['Content-Type'] = 'application/octet-stream';
    opts.body = body;
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Backend xatosi: ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function adminHeaders(adminId) {
  return { 'X-Internal-Secret': config.INTERNAL_API_SECRET, 'X-Admin-Id': String(adminId) };
}

// ===== Oddiy foydalanuvchi amallar =====
export const telegramStart = (userId, username, firstName, lastName) =>
  req('POST', '/api/users/telegram-start', { body: { userId, username, firstName, lastName } });

export const setBotLang = (userId, lang) =>
  req('PUT', `/api/users/${userId}/bot-lang`, { body: { lang } });

// ===== Admin amallar (barchasi maxfiy kalit + admin ID bilan himoyalangan) =====
export const adminStats = (adminId) =>
  req('GET', '/api/admin/stats', { headers: adminHeaders(adminId) });

export const adminUsers = (adminId, limit = 10) =>
  req('GET', `/api/admin/users?limit=${limit}`, { headers: adminHeaders(adminId) });

export const adminBroadcast = (adminId, payload) =>
  req('POST', '/api/admin/broadcast', { headers: adminHeaders(adminId), body: payload });

export const adminCreateBackup = (adminId) =>
  req('POST', '/api/admin/backup', { headers: adminHeaders(adminId), body: {} });

export const adminValidateRestore = (adminId, buffer) =>
  req('POST', '/api/admin/restore/validate', { headers: adminHeaders(adminId), body: buffer, isRaw: true });

export const adminConfirmRestore = (adminId, token) =>
  req('POST', '/api/admin/restore/confirm', { headers: adminHeaders(adminId), body: { token } });

// contact-thread ni ham "ichki xizmat" sifatida, birinchi admin ID nomidan chaqiramiz —
// chunki bu yerda gapiruvchi oddiy foydalanuvchi bo'lsa ham, chaqiruvning o'zi botdan keladi.
const primaryAdminId = () => config.ADMIN_TELEGRAM_IDS[0];

export const contactThreadSave = (adminMsgId, userTelegramId) =>
  req('POST', '/api/admin/contact-thread', { headers: adminHeaders(primaryAdminId()), body: { adminMsgId, userTelegramId } });

export const contactThreadGet = (adminMsgId) =>
  req('GET', `/api/admin/contact-thread/${adminMsgId}`, { headers: adminHeaders(primaryAdminId()) }).catch(() => null);
