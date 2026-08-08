import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

// Backend manzili:
// 1) .env da VITE_BACKEND_URL berilgan bo'lsa — o'sha
// 2) Vite dev serverida (5173) — localhost:3000
// 3) Aks holda — sahifa qaysi manzildan ochilgan bo'lsa, o'sha
//    (backend frontend'ni o'zi tarqatganda: bitta tunnel yetadi)
const BACKEND =
  import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:3000'
    : typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

/**
 * Backend bilan real-time o'yin ulanishi.
 * Barcha qoidalar serverda tekshiriladi — bu hook faqat holatni ko'rsatadi.
 */
export function useGame(gameId, user, spectate, myNickname) {
  const socketRef = useRef(null);

  const [state, setState] = useState(null);
  const [role, setRole] = useState(null);            // white | black | spectator
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [drawOffer, setDrawOffer] = useState(null);  // 'incoming' | 'sent'
  const [aiThinking, setAiThinking] = useState(false);
  const [clock, setClock] = useState({ whiteTime: null, blackTime: null, turn: 'w' });
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [matchCancelled, setMatchCancelled] = useState(false);

  useEffect(() => {
    if (!gameId || !user) return;

    // Transport tartibi: avval polling, keyin websocket'ga ko'tariladi.
    // Tunnel (cloudflared/ngrok) orqali websocket birdan o'tmasligi mumkin —
    // polling har doim ishlaydi, keyin imkon bo'lsa websocket'ga o'tadi.
    const socket = io(BACKEND, {
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 4000,
      timeout: 20000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
      socket.emit('join_game', { gameId, userId: user.id, username: myNickname || user.name, spectate });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('connect_error', () => {
      setError('Serverga ulanib bo\'lmadi');
      setConnected(false);
    });

    socket.on('game_state', (s) => {
      setState(s);
      if (s.role) setRole(s.role);
      setClock({ whiteTime: s.whiteTime, blackTime: s.blackTime, turn: s.turn });
      if (s.status === 'finished' && s.result) {
        setGameOver({ result: s.result, reason: s.reason });
      }
    });

    socket.on('move_made', ({ state: s }) => {
      setState(s);
      setClock({ whiteTime: s.whiteTime, blackTime: s.blackTime, turn: s.turn });
      setDrawOffer(null);
      setError(null);
    });

    socket.on('player_joined', ({ state: s }) => setState(s));

    socket.on('invalid_move', ({ error: e }) => {
      setError(e);
      setTimeout(() => setError(null), 2000);
    });

    socket.on('clock_update', (c) => setClock(c));

    socket.on('game_over', ({ result, reason, state: s, whiteChange, blackChange }) => {
      if (s) setState(s);
      setGameOver({ result, reason, whiteChange, blackChange });
      setDrawOffer(null);
    });

    socket.on('draw_offered', () => setDrawOffer('incoming'));
    socket.on('draw_offer_sent', () => setDrawOffer('sent'));
    socket.on('draw_declined', () => setDrawOffer(null));

    socket.on('ai_thinking', (v) => setAiThinking(v));

    socket.on('opponent_disconnected', () => setOpponentDisconnected(true));
    socket.on('opponent_reconnected', () => setOpponentDisconnected(false));

    socket.on('match_cancelled', () => setMatchCancelled(true));

    socket.on('error_msg', (msg) => {
      setError(msg);
      setTimeout(() => setError(null), 2500);
    });

    return () => { socket.close(); socketRef.current = null; };
  }, [gameId, user?.id, spectate, myNickname]);

  // Mahalliy soat — server har 2 sekundda yangilaydi, orasini biz sanaymiz
  useEffect(() => {
    if (!state?.hasClock || state.status !== 'active') return;

    const t = setInterval(() => {
      setClock(c => {
        if (c.whiteTime == null) return c;
        return c.turn === 'w'
          ? { ...c, whiteTime: Math.max(0, c.whiteTime - 200) }
          : { ...c, blackTime: Math.max(0, c.blackTime - 200) };
      });
    }, 200);

    return () => clearInterval(t);
  }, [state?.hasClock, state?.status, clock.turn]);

  const move = useCallback((from, to, promotion) => {
    socketRef.current?.emit('move', { gameId, from, to, promotion });
  }, [gameId]);

  const resign     = useCallback(() => socketRef.current?.emit('resign', { gameId }), [gameId]);
  const offerDraw  = useCallback(() => socketRef.current?.emit('draw_offer', { gameId }), [gameId]);
  const acceptDraw = useCallback(() => socketRef.current?.emit('accept_draw', { gameId }), [gameId]);
  const declineDraw= useCallback(() => { socketRef.current?.emit('decline_draw', { gameId }); setDrawOffer(null); }, [gameId]);
  const cancelMatch = useCallback(() => socketRef.current?.emit('cancel_match', { gameId }), [gameId]);

  return {
    state, role, connected, error, gameOver, drawOffer, aiThinking, clock, opponentDisconnected, matchCancelled,
    move, resign, offerDraw, acceptDraw, declineDraw, cancelMatch
  };
}

export { BACKEND };
