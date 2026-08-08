import * as gm from '../game/gameManager.js';
import * as q from '../db/queries.js';
import { findBestMove } from '../game/engine.js';
import * as mm from '../game/matchmaking.js';

// ===== ONLINE USER TRACKING =====
// userId -> { socketIds: Set, status: 'online'|'in_game', gameId: string|null }
const onlineUsers = new Map();

// Pending challenges: challengeId -> { fromId, fromName, toId, timeMode, timeout, createdAt }
const pendingChallenges = new Map();

function generateChallengeId() {
  return `ch${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function getUserStatus(userId) {
  const entry = onlineUsers.get(String(userId));
  if (!entry) return 'offline';
  return entry.status;
}

export function registerSocketHandlers(io) {

  function setUserStatus(userId, status, gameId = null) {
    const uid = String(userId);
    const entry = onlineUsers.get(uid);
    if (entry) {
      entry.status = status;
      entry.gameId = gameId;
    }
  }

  function broadcastFriendStatus(userId, status) {
    // Barcha ulangan foydalanuvchilarga status o'zgarganini bildiramiz
    // (frontend faqat o'z do'stlari uchun filtr qiladi)
    io.emit('friend_status_changed', { userId: String(userId), status });
  }

  // O'yin tugaganini hammaga e'lon qilish
  async function broadcastGameOver(game) {
    const { whiteChange, blackChange } = await gm.finalizeGame(game);

    io.to(game.id).emit('game_over', {
      result: game.result,
      reason: game.reason,
      state: game.getState(),
      whiteChange,
      blackChange
    });

    // Ikkala o'yinchini "online" holatiga qaytaramiz
    for (const uid of [game.whiteId, game.blackId]) {
      if (!uid) continue;
      const entry = onlineUsers.get(String(uid));
      if (entry && entry.socketIds.size > 0) {
        entry.status = 'online';
        entry.gameId = null;
        broadcastFriendStatus(uid, 'online');
      }
    }
  }

  // AI navbati bo'lsa yuradi
  async function maybeAIMove(game) {
    if (!game.isAI || game.status !== 'active') return;
    if (game.chess.turn() !== 'b') return;   // AI doim qora

    io.to(game.id).emit('ai_thinking', true);

    // Event loop ni bloklamaslik uchun keyingi tickda
    await new Promise(r => setImmediate(r));

    const best = findBestMove(game.chess.fen(), game.difficulty || 3);
    io.to(game.id).emit('ai_thinking', false);

    if (!best) return;

    const mv = game.moveRaw(best.from, best.to, best.promotion);
    if (!mv) return;

    await q.insertMove(game.id, game.chess.history().length, mv.san, game.chess.fen())
      .catch(e => console.error('AI yurishini saqlash:', e.message));

    io.to(game.id).emit('move_made', { move: mv, state: game.getState() });

    if (game.status === 'finished') await broadcastGameOver(game);
  }

  io.on('connection', (socket) => {
    console.log('🔌 Ulandi:', socket.id);

    // ===== FOYDALANUVCHI ONLINE BO'LISHI =====
    // Frontend ulangandan so'ng darhol shu eventni yuborishi kerak
    socket.on('user_online', ({ userId, username }) => {
      if (!userId) return;
      const uid = String(userId);
      socket.data.userId = uid;
      socket.data.username = username || null;

      let entry = onlineUsers.get(uid);
      if (!entry) {
        entry = { socketIds: new Set(), status: 'online', gameId: null };
        onlineUsers.set(uid, entry);
      }
      entry.socketIds.add(socket.id);

      // Agar avvaldan faol o'yinda bo'lsa, statusni saqlab qolamiz
      const activeGame = gm.findActiveGameForUser(uid);
      if (activeGame) {
        entry.status = 'in_game';
        entry.gameId = activeGame.id;
      } else if (entry.status !== 'in_game') {
        entry.status = 'online';
      }

      socket.join(`user:${uid}`); // Shaxsiy xabarlar uchun room

      broadcastFriendStatus(uid, entry.status);
    });

    // ===== DO'STLAR STATUSINI SO'RASH =====
    socket.on('get_friends_status', ({ friendIds }) => {
      if (!Array.isArray(friendIds)) return;
      const statuses = {};
      for (const fid of friendIds) {
        statuses[String(fid)] = getUserStatus(fid);
      }
      socket.emit('friends_status', statuses);
    });

    // ===== DO'STGA CHALLENGE YUBORISH =====
    socket.on('send_challenge', async ({ fromId, fromName, toId, timeMode }) => {
      try {
        fromId = String(fromId);
        toId = String(toId);

        // O'zini-o'ziga taklif qilish taqiqlanadi
        if (fromId === toId) {
          return socket.emit('challenge_error', { error: "You can't challenge yourself" });
        }

        // Qabul qiluvchi online bo'lishi kerak
        const targetEntry = onlineUsers.get(toId);
        if (!targetEntry || targetEntry.socketIds.size === 0) {
          return socket.emit('challenge_error', { error: 'Player is offline' });
        }

        // Qabul qiluvchi allaqachon o'yinda bo'lmasligi kerak
        if (targetEntry.status === 'in_game') {
          return socket.emit('challenge_error', { error: 'Player is already in a game' });
        }

        // Yuboruvchi allaqachon boshqa o'yinda bo'lmasligi kerak
        const fromEntry = onlineUsers.get(fromId);
        if (fromEntry && fromEntry.status === 'in_game') {
          return socket.emit('challenge_error', { error: 'You are already in a game' });
        }

        // Dublikat challenge tekshirish (bir xil juftlik uchun faol taklif bormi)
        for (const [, ch] of pendingChallenges) {
          if (ch.fromId === fromId && ch.toId === toId) {
            return socket.emit('challenge_error', { error: 'Challenge already sent' });
          }
        }

        const challengeId = generateChallengeId();
        const timeout = setTimeout(() => {
          const ch = pendingChallenges.get(challengeId);
          if (!ch) return;
          pendingChallenges.delete(challengeId);
          io.to(`user:${fromId}`).emit('challenge_expired', { challengeId, toId });
          io.to(`user:${toId}`).emit('challenge_expired', { challengeId, fromId });
        }, 30_000); // 30 soniya kutish

        pendingChallenges.set(challengeId, {
          challengeId, fromId, fromName: fromName || 'Player', toId, timeMode: timeMode || 'normal_10',
          timeout, createdAt: Date.now()
        });

        // Qabul qiluvchiga real-time bildirishnoma
        io.to(`user:${toId}`).emit('challenge_received', {
          challengeId, fromId, fromName: fromName || 'Player', timeMode: timeMode || 'normal_10'
        });

        socket.emit('challenge_sent', { challengeId, toId });

      } catch (err) {
        console.error('send_challenge:', err);
        socket.emit('challenge_error', { error: 'Failed to send challenge' });
      }
    });

    // ===== CHALLENGE QABUL QILISH =====
    socket.on('accept_challenge', async ({ challengeId }) => {
      try {
        const ch = pendingChallenges.get(challengeId);
        if (!ch) return socket.emit('challenge_error', { error: 'Challenge expired' });

        clearTimeout(ch.timeout);
        pendingChallenges.delete(challengeId);

        // Ikkala tomon ham hali onlaynmi va bo'shmi tekshiramiz
        const fromEntry = onlineUsers.get(ch.fromId);
        const toEntry = onlineUsers.get(ch.toId);
        if (!fromEntry || fromEntry.socketIds.size === 0) {
          return socket.emit('challenge_error', { error: 'Opponent disconnected' });
        }
        if ((fromEntry.status === 'in_game') || (toEntry && toEntry.status === 'in_game')) {
          return socket.emit('challenge_error', { error: 'One of the players is already in a game' });
        }

        // Oq/Qorani tasodifiy tayinlash
        const flip = Math.random() < 0.5;
        const whiteId = flip ? ch.fromId : ch.toId;
        const whiteName = flip ? ch.fromName : (socket.data.username || 'Player');
        const blackId = flip ? ch.toId : ch.fromId;
        const blackName = flip ? (socket.data.username || 'Player') : ch.fromName;

        // Ismlarni bazadan olib to'g'irlaymiz
        const [whiteUser, blackUser] = await Promise.all([
          q.getUser(whiteId).catch(() => null),
          q.getUser(blackId).catch(() => null)
        ]);

        const game = await gm.createGame({
          whiteId,
          whiteName: whiteUser?.nickname || whiteName,
          timeMode: ch.timeMode,
          gameMode: '1v1'
        });

        // Ikkinchi o'yinchini darhol biriktiramiz (join_game kutmasdan)
        game.addBlackPlayer(blackId, blackUser?.nickname || blackName);
        await q.setBlackPlayer(game.id, blackId, blackUser?.nickname || blackName);

        // Ikkala foydalanuvchini "in_game" statusiga o'tkazamiz
        setUserStatus(whiteId, 'in_game', game.id);
        setUserStatus(blackId, 'in_game', game.id);
        broadcastFriendStatus(whiteId, 'in_game');
        broadcastFriendStatus(blackId, 'in_game');

        // Ikkala tomonga o'yin boshlanganini xabar qilamiz
        io.to(`user:${ch.fromId}`).emit('challenge_accepted', { gameId: game.id });
        io.to(`user:${ch.toId}`).emit('challenge_accepted', { gameId: game.id });

      } catch (err) {
        console.error('accept_challenge:', err);
        socket.emit('challenge_error', { error: 'Failed to start game' });
      }
    });

    // ===== CHALLENGE RAD ETISH =====
    socket.on('decline_challenge', ({ challengeId }) => {
      const ch = pendingChallenges.get(challengeId);
      if (!ch) return;

      clearTimeout(ch.timeout);
      pendingChallenges.delete(challengeId);

      io.to(`user:${ch.fromId}`).emit('challenge_declined', { challengeId, toId: ch.toId });
    });

    // ===== CHALLENGENI BEKOR QILISH (yuboruvchi tomonidan) =====
    socket.on('cancel_challenge', ({ challengeId }) => {
      const ch = pendingChallenges.get(challengeId);
      if (!ch) return;

      clearTimeout(ch.timeout);
      pendingChallenges.delete(challengeId);

      io.to(`user:${ch.toId}`).emit('challenge_cancelled', { challengeId });
    });

    // ===== MATCHNI BEKOR QILISH (Create Match yaratuvchisi tomonidan, raqib qo'shilmagunicha) =====
    socket.on('cancel_match', async ({ gameId }) => {
      try {
        const uid = socket.data.userId;
        if (!uid) return socket.emit('error_msg', 'Avtorizatsiya yo\'q');

        const res = await gm.cancelWaitingGame(gameId, uid);
        if (res.error) return socket.emit('error_msg', res.error);

        gm.clearReconnectTimer(gameId, uid);
        io.to(gameId).emit('match_cancelled', { reason: 'creator_cancelled' });
      } catch (err) {
        console.error('cancel_match:', err);
        socket.emit('error_msg', 'Bekor qilishda xato');
      }
    });

    // ===== QUICK MATCH: reyting boyicha avtomatik raqib qidirish =====
    socket.on('join_matchmaking', async ({ userId, username, timeMode }) => {
      try {
        const uid = String(userId);
        socket.data.userId = uid;
        socket.join(`user:${uid}`);

        await mm.joinQueue(uid, username, timeMode, (result) => {
          io.to(`user:${uid}`).emit('match_found', result);
        });

        // joinQueue darhol moslashtirmagan bo'lsa — "qidirilmoqda" holatini bildiramiz
        if (mm.isInQueue(uid, timeMode)) {
          socket.emit('matchmaking_searching', { timeMode });
        }
      } catch (err) {
        console.error('join_matchmaking:', err);
        socket.emit('error_msg', "Raqib qidirishda xatolik");
      }
    });

    socket.on('leave_matchmaking', ({ userId, timeMode }) => {
      if (!userId) return;
      mm.leaveQueue(userId, timeMode);
      socket.emit('matchmaking_cancelled', { timeMode });
    });

    // ===== O'YINGA QO'SHILISH =====
    socket.on('join_game', async ({ gameId, userId, username, spectate }) => {
      try {
        const game = gm.getActiveGame(gameId);

        if (!game) {
          // Arxivdagi o'yin — faqat ko'rish
          const record = await q.getGame(gameId);
          if (!record) return socket.emit('error_msg', "O'yin topilmadi");

          // Forward/backward replay uchun yurishlar tarixini ham qo'shamiz
          // (o'yin xotiradan o'chirilgan bo'lsa ham to'liq qayta tomosha qilish ishlaydi)
          const moveRows = await q.getMoves(gameId).catch(() => []);
          const history = moveRows.map(m => ({
            san: m.move_san,
            color: m.move_number % 2 === 1 ? 'w' : 'b'
          }));

          socket.join(gameId);
          return socket.emit('game_state', {
            id: record.id, fen: record.fen, pgn: record.pgn,
            status: record.status, result: record.result, reason: record.reason,
            timeMode: record.time_mode, whiteId: record.white_id, blackId: record.black_id,
            whiteName: record.white_name, blackName: record.black_name,
            history, moveCount: history.length,
            archived: true, role: 'spectator'
          });
        }

        socket.join(gameId);
        socket.data.gameId = gameId;
        socket.data.userId = userId ? String(userId) : null;
        socket.data.username = username || null;

        let role = 'spectator';
        const uid = String(userId || '');

        // Agar bu foydalanuvchi uchun uzilish taymeri bo'lsa — bekor qilamiz (qayta ulandi)
        if (uid) {
          gm.clearReconnectTimer(gameId, uid);
          let entry = onlineUsers.get(uid);
          if (!entry) {
            entry = { socketIds: new Set(), status: 'online', gameId: null };
            onlineUsers.set(uid, entry);
          }
          entry.socketIds.add(socket.id);
          socket.join(`user:${uid}`);
        }

        if (uid === game.whiteId) role = 'white';
        else if (uid === game.blackId) role = 'black';
        else if (!spectate && !game.blackId && !game.isAI && uid) {
          // Faqat "Quick Play" / ochiq havola orqali kirishda ishlaydi.
          // Do'st challenge orqali kelgan o'yinlarda blackId allaqachon belgilangan bo'ladi.
          game.addBlackPlayer(uid, socket.data.username || 'Qora');
          await q.setBlackPlayer(gameId, uid, socket.data.username || null);
          role = 'black';
          io.to(gameId).emit('player_joined', { userId: uid, state: game.getState() });
        }

        socket.data.role = role;

        // O'yinchi sifatida qo'shilsa — statusni "in_game" qilamiz
        if ((role === 'white' || role === 'black') && uid) {
          setUserStatus(uid, 'in_game', gameId);
          broadcastFriendStatus(uid, 'in_game');
        }

        socket.emit('game_state', { ...game.getState(), role });

        if (role === 'spectator') {
          socket.to(gameId).emit('spectator_joined', { count: io.sockets.adapter.rooms.get(gameId)?.size || 1 });
        } else if (role === 'white' || role === 'black') {
          // Raqibga qayta ulanganini bildiramiz (agar avval uzilgan bo'lsa foydali)
          socket.to(gameId).emit('opponent_reconnected', { userId: uid });
        }

      } catch (err) {
        console.error('join_game:', err);
        socket.emit('error_msg', 'Qo\'shilishda xato');
      }
    });

    // ===== YURISH =====
    socket.on('move', async ({ gameId, from, to, promotion }) => {
      try {
        const game = gm.getActiveGame(gameId);
        if (!game) return socket.emit('error_msg', "O'yin topilmadi");

        const userId = socket.data.userId;
        if (!userId) return socket.emit('error_msg', 'Avtorizatsiya yo\'q');

        const result = game.move(userId, { from, to, promotion });

        if (result.error) return socket.emit('invalid_move', { error: result.error, from, to });

        await q.insertMove(gameId, game.chess.history().length, result.move.san, game.chess.fen())
          .catch(e => console.error('Yurishni saqlash:', e.message));

        io.to(gameId).emit('move_made', { move: result.move, state: game.getState() });

        if (game.status === 'finished') {
          await broadcastGameOver(game);
        } else {
          maybeAIMove(game).catch(e => console.error('AI yurish xatosi:', e.message));
        }

      } catch (err) {
        console.error('move:', err);
        socket.emit('error_msg', 'Yurishda xato');
      }
    });

    // ===== MUMKIN YURISHLAR =====
    socket.on('get_legal_moves', ({ gameId, square }) => {
      const game = gm.getActiveGame(gameId);
      if (!game) return;
      socket.emit('legal_moves', { square, moves: game.legalMovesFrom(square) });
    });

    // ===== TASLIM =====
    socket.on('resign', async ({ gameId }) => {
      try {
        const game = gm.getActiveGame(gameId);
        if (!game) return socket.emit('error_msg', "O'yin topilmadi");

        const r = game.resign(socket.data.userId);
        if (r.error) return socket.emit('error_msg', r.error);

        await broadcastGameOver(game);
      } catch (err) {
        console.error('resign:', err);
      }
    });

    // ===== DURRANG =====
    socket.on('draw_offer', ({ gameId }) => {
      const game = gm.getActiveGame(gameId);
      if (!game) return;

      const r = game.offerDraw(socket.data.userId);
      if (r.error) return socket.emit('error_msg', r.error);

      socket.to(gameId).emit('draw_offered', { by: r.by });
      socket.emit('draw_offer_sent');
    });

    socket.on('accept_draw', async ({ gameId }) => {
      const game = gm.getActiveGame(gameId);
      if (!game) return;

      const r = game.acceptDraw(socket.data.userId);
      if (r.error) return socket.emit('error_msg', r.error);

      await broadcastGameOver(game);
    });

    socket.on('decline_draw', ({ gameId }) => {
      const game = gm.getActiveGame(gameId);
      if (!game) return;

      game.declineDraw(socket.data.userId);
      io.to(gameId).emit('draw_declined');
    });

    // ===== SOAT SINXRONI =====
    socket.on('sync', ({ gameId }) => {
      const game = gm.getActiveGame(gameId);
      if (game) socket.emit('clock_update', game.getState());
    });

    socket.on('disconnect', () => {
      console.log('🔌 Uzildi:', socket.id);

      const uid = socket.data.userId;
      if (!uid) return;

      mm.leaveAllQueues(uid); // Quick Match navbatida bo'lsa, chiqarib yuboramiz

      const entry = onlineUsers.get(uid);
      if (!entry) return;

      entry.socketIds.delete(socket.id);

      // Bu foydalanuvchining boshqa ochiq ulanishi bo'lmasa
      if (entry.socketIds.size === 0) {
        const gameId = socket.data.gameId || entry.gameId;

        if (gameId) {
          const game = gm.getActiveGame(gameId);
          if (game && game.status === 'active') {
            // Raqibga uzilganini bildiramiz, qayta ulanish uchun vaqt beramiz
            socket.to(gameId).emit('opponent_disconnected', { userId: uid });

            // 60 soniya ichida qayta ulanmasa — raqib yutadi
            const reconnectTimer = setTimeout(() => {
              const stillEntry = onlineUsers.get(uid);
              const stillDisconnected = !stillEntry || stillEntry.socketIds.size === 0;
              const g = gm.getActiveGame(gameId);

              if (stillDisconnected && g && g.status === 'active') {
                const winnerColor = g.whiteId === uid ? 'black' : 'white';
                g.forceTimeoutLoss ? g.forceTimeoutLoss(uid) : g.resign(uid);
                broadcastGameOver(g).catch(e => console.error('disconnect timeout broadcast:', e.message));
              }
            }, 60_000);

            gm.registerReconnectTimer(gameId, uid, reconnectTimer);
          } else if (game && game.status === 'waiting' && game.whiteId === uid) {
            // Match yaratuvchisi hali hech kim qo'shilmasdan uzilib qoldi —
            // 10 daqiqa ichida qaytmasa (yoki hech kim qo'shilmasa), match avtomatik bekor qilinadi.
            const cleanupTimer = setTimeout(async () => {
              const stillEntry = onlineUsers.get(uid);
              const stillDisconnected = !stillEntry || stillEntry.socketIds.size === 0;
              const g = gm.getActiveGame(gameId);

              if (stillDisconnected && g && g.status === 'waiting') {
                const res = await gm.cancelWaitingGame(gameId, uid).catch(() => null);
                if (res?.ok) io.to(gameId).emit('match_cancelled', { reason: 'creator_timeout' });
              }
            }, 10 * 60_000);

            gm.registerReconnectTimer(gameId, uid, cleanupTimer);
          }
        }

        // Faol o'yinda bo'lmasa — darhol offline qilamiz
        const activeGame = gm.findActiveGameForUser(uid);
        if (!activeGame) {
          onlineUsers.delete(uid);
          broadcastFriendStatus(uid, 'offline');
        }
      }
    });
  });

  // ===== VAQT TUGASHINI KUZATISH (har sekundda) =====
  setInterval(() => {
    gm.sweepTimeouts((game) => {
      broadcastGameOver(game).catch(e => console.error('timeout broadcast:', e.message));
    });
  }, 1000);

  // ===== SOATNI FRONTENDGA YUBORISH (har 2 sekundda) =====
  setInterval(() => {
    for (const game of gm.games.values()) {
      if (game.status === 'active' && game.hasClock) {
        io.to(game.id).emit('clock_update', {
          whiteTime: Math.max(0, Math.round(game.whiteTime)),
          blackTime: Math.max(0, Math.round(game.blackTime)),
          turn: game.chess.turn()
        });
      }
    }
  }, 2000);
}
