import express from 'express';
import * as q from '../db/queries.js';
import { getRatingCategory, getRatingEmoji } from '../utils/ratings.js';
import { isValidSticker } from '../data/stickers.js';
import { isValidEstimate, ESTIMATE_LEVELS, PLACEMENT_GAMES_REQUIRED } from '../utils/placement.js';

const router = express.Router();

// GET /api/users/estimate-levels — ro'yxatdan o'tishda ko'rsatiladigan 5 ta daraja
router.get('/estimate-levels', (req, res) => {
  res.json({
    levels: Object.entries(ESTIMATE_LEVELS).map(([key, v]) => ({ key, label: v.label })),
    gamesRequired: PLACEMENT_GAMES_REQUIRED
  });
});

// GET /api/users/:userId/placement-state — joriy placement holati (UI uchun)
router.get('/:userId/placement-state', async (req, res) => {
  try {
    const state = await q.getPlacementState(req.params.userId);
    if (!state) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    res.json({
      inProgress: state.placement_status === 'in_progress',
      gamesPlayed: state.placement_games_played,
      gamesRequired: PLACEMENT_GAMES_REQUIRED,
      rating: state.rating_bullet
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/:userId/reset-placement — placementni qaytadan boshlash
router.post('/:userId/reset-placement', async (req, res) => {
  try {
    const { estimate } = req.body;
    if (!isValidEstimate(estimate)) return res.status(400).json({ error: "Noto'g'ri daraja" });
    const user = await q.resetPlacement(req.params.userId, estimate);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/telegram-start — Telegram bot /start bosilganda chaqiriladi.
// telegram_id, username, ism-familiyani saqlaydi/yangilaydi. Dublikat yaratmaydi.
router.post('/telegram-start', async (req, res) => {
  try {
    const { userId, username, firstName, lastName } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId majburiy' });

    const user = await q.upsertTelegramUser(userId, username, firstName, lastName);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/register — foydalanuvchini yaratish yoki yangilash
router.post('/register', async (req, res) => {
  try {
    const { userId, username } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId majburiy' });

    const user = await q.getOrCreateUser(userId, username);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/check-nickname?nickname=X — mavjudmi tekshirish (jonli)
router.get('/check-nickname', async (req, res) => {
  try {
    const { nickname, exclude } = req.query;
    const err = q.validateNickname(nickname || '');
    if (err) return res.json({ available: false, reason: err });

    const taken = await q.isNicknameTaken(nickname, exclude);
    res.json({ available: !taken, reason: taken ? 'Bu nickname band' : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/complete-registration — nickname + o'z-o'zini baholash bilan ro'yxatdan o'tish
router.post('/complete-registration', async (req, res) => {
  try {
    const { userId, username, nickname, estimate } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId majburiy' });
    if (!isValidEstimate(estimate)) {
      return res.status(400).json({ error: "Noto'g'ri daraja" });
    }

    const user = await q.registerUser(userId, username, nickname, estimate);
    res.json(user);
  } catch (err) {
    if (err.code === 'INVALID_NICKNAME' || err.code === 'NICKNAME_TAKEN' || err.code === 'INVALID_ESTIMATE') {
      return res.status(409).json({ error: err.message, code: err.code });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/search?q=X — nickname bo'yicha qidirish
router.get('/search', async (req, res) => {
  try {
    const { q: query, userId } = req.query;
    if (!query || query.trim().length < 2) return res.json([]);

    const results = await q.searchByNickname(query, userId || '', 8);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:userId/bot-lang — Telegram bot tilini o'zgartirish
router.put('/:userId/bot-lang', async (req, res) => {
  try {
    const { lang } = req.body;
    if (!['uz', 'ru', 'en'].includes(lang)) return res.status(400).json({ error: "Noto'g'ri til" });
    await q.setUserBotLang(req.params.userId, lang);
    res.json({ ok: true, bot_lang: lang });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:userId — profil
router.get('/:userId', async (req, res) => {
  try {
    const user = await q.getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

    res.json({
      ...user,
      category_bullet: getRatingCategory(user.rating_bullet),
      category_normal: getRatingCategory(user.rating_normal),
      category_long: getRatingCategory(user.rating_long),
      emoji_bullet: getRatingEmoji(user.rating_bullet),
      win_rate: user.total_games ? +((user.wins / user.total_games) * 100).toFixed(1) : 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:userId/sticker — profil stikerini tanlash/o'zgartirish
router.put('/:userId/sticker', async (req, res) => {
  try {
    const { stickerId } = req.body;

    // null/bo'sh qiymat — stikerni olib tashlash (profilda hech narsa ko'rsatilmaydi)
    if (stickerId !== null && stickerId !== undefined && !isValidSticker(stickerId)) {
      return res.status(400).json({ error: "Noto'g'ri sticker ID" });
    }

    const user = await q.getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

    await q.setProfileSticker(req.params.userId, stickerId || null);
    res.json({ ok: true, profile_sticker: stickerId || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:userId/games — o'yinlar tarixi
router.get('/:userId/games', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    const games = await q.getUserGames(req.params.userId, limit);
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:userId/stats — statistika
router.get('/:userId/stats', async (req, res) => {
  try {
    const user = await q.getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

    const games = await q.getUserGames(req.params.userId, 100);
    const byMode = { bullet: 0, normal: 0, long: 0, ai: 0 };

    for (const g of games) {
      const key = String(g.time_mode).split('_')[0];
      if (byMode[key] !== undefined) byMode[key]++;
    }

    res.json({
      total_games: user.total_games,
      wins: user.wins,
      losses: user.losses,
      draws: user.draws,
      win_rate: user.total_games ? +((user.wins / user.total_games) * 100).toFixed(1) : 0,
      ratings: {
        bullet: user.rating_bullet,
        normal: user.rating_normal,
        long: user.rating_long
      },
      by_mode: byMode
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/leaderboard/:mode — top o'yinchilar
router.get('/leaderboard/:mode', async (req, res) => {
  try {
    const mode = req.params.mode || 'bullet';
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    const top = await q.getTopPlayers(mode, limit);
    res.json(top);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:userId/friends — do'stlar ro'yxati
router.get('/:userId/friends', async (req, res) => {
  try {
    const friends = await q.getFriends(req.params.userId);
    res.json(friends);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/:userId/friends — do'st qo'shish
router.post('/:userId/friends', async (req, res) => {
  try {
    const { friendId } = req.body;
    if (!friendId) return res.status(400).json({ error: 'friendId majburiy' });

    const friend = await q.getUser(friendId);
    if (!friend) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

    await q.addFriend(req.params.userId, friendId);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'SELF_FRIEND') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:userId/friends/:friendId — do'stlikni bekor qilish
router.delete('/:userId/friends/:friendId', async (req, res) => {
  try {
    await q.removeFriend(req.params.userId, req.params.friendId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
