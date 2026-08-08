import express from 'express';
import * as gm from '../game/gameManager.js';
import * as q from '../db/queries.js';
import { resolveTimeControl } from '../config.js';
import { notifyOpponentJoined } from '../utils/telegram.js';

const router = express.Router();

// POST /api/games/create — yangi o'yin (Quick Play, AI, Create Match — hammasi shu orqali)
router.post('/create', async (req, res) => {
  try {
    const { whiteId, whiteName, timeMode, difficulty, gameMode } = req.body;

    if (!whiteId) return res.status(400).json({ error: 'whiteId majburiy' });

    const resolved = resolveTimeControl(timeMode);
    if (!resolved) {
      return res.status(400).json({ error: `Noto'g'ri timeMode: ${timeMode}` });
    }
    if (gameMode === 'ai' && (difficulty < 1 || difficulty > 5)) {
      return res.status(400).json({ error: 'difficulty 1..5 oralig\'ida bo\'lishi kerak' });
    }

    await q.getOrCreateUser(whiteId, whiteName);
    const game = await gm.createGame({
      whiteId, whiteName, timeMode, difficulty, gameMode,
      increment: Math.round((resolved.incrementMs || 0) / 1000)
    });

    res.json({ gameId: game.id, status: game.status, state: game.getState() });
  } catch (err) {
    console.error('POST /create:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/games/:gameId/cancel — "Waiting for Opponent" holatidagi matchni yaratuvchi bekor qiladi
router.post('/:gameId/cancel', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId majburiy' });

    const result = await gm.cancelWaitingGame(req.params.gameId, userId);
    if (result.error) return res.status(400).json({ error: result.error });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/games/:gameId/join — ikkinchi o'yinchi qo'shiladi
router.post('/:gameId/join', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { userId, username } = req.body;

    if (!userId) return res.status(400).json({ error: 'userId majburiy' });

    const game = gm.getActiveGame(gameId);
    if (!game) return res.status(404).json({ error: "O'yin topilmadi yoki tugagan" });

    // O'zi yaratgan o'yin
    if (String(userId) === game.whiteId) {
      return res.json({ role: 'white', state: game.getState() });
    }

    // Allaqachon qora tomon
    if (String(userId) === game.blackId) {
      return res.json({ role: 'black', state: game.getState() });
    }

    // Bo'sh joy bormi
    if (!game.blackId && !game.isAI) {
      await q.getOrCreateUser(userId, username);
      game.addBlackPlayer(userId, username);
      await q.setBlackPlayer(gameId, userId, username);

      notifyOpponentJoined(game);

      return res.json({ role: 'black', state: game.getState() });
    }

    // Joy yo'q → kuzatuvchi
    res.json({ role: 'spectator', state: game.getState() });
  } catch (err) {
    console.error('POST /join:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/games/:gameId — o'yin ma'lumoti (faol yoki arxiv)
router.get('/:gameId', async (req, res) => {
  try {
    const { live, record } = await gm.getGameOrRecord(req.params.gameId);

    if (live) return res.json(live.getState());
    if (record) {
      const moveRows = await q.getMoves(req.params.gameId).catch(() => []);
      const history = moveRows.map(m => ({
        san: m.move_san,
        color: m.move_number % 2 === 1 ? 'w' : 'b'
      }));

      return res.json({
        id: record.id,
        fen: record.fen,
        pgn: record.pgn,
        status: record.status,
        result: record.result,
        reason: record.reason,
        time_mode: record.time_mode,
        timeMode: record.time_mode,
        whiteId: record.white_id,
        blackId: record.black_id,
        whiteName: record.white_name,
        blackName: record.black_name,
        difficulty: record.difficulty,
        history,
        moveCount: history.length,
        archived: true
      });
    }

    res.status(404).json({ error: "O'yin topilmadi" });
  } catch (err) {
    console.error('GET /:gameId:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/games/:gameId/moves — yurishlar tarixi
router.get('/:gameId/moves', async (req, res) => {
  try {
    const moves = await q.getMoves(req.params.gameId);
    res.json(moves);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/games/:gameId/legal?square=e2 — mumkin yurishlar
router.get('/:gameId/legal', (req, res) => {
  const game = gm.getActiveGame(req.params.gameId);
  if (!game) return res.status(404).json({ error: "O'yin topilmadi" });

  const { square } = req.query;
  if (!square) return res.status(400).json({ error: 'square majburiy' });

  res.json({ moves: game.legalMovesFrom(square) });
});

export default router;
