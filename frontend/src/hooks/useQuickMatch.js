import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { BACKEND } from './useGame';

/**
 * Quick Match navbatiga qo'shiladi va reyting bo'yicha mos raqib topilishini kutadi.
 * Backend: ±75 ichida darhol, topilmasa ~15s dan keyin eng yaqin raqib bilan
 * ("wide match" — bunda rating o'zgarishi 2 martaga kamayadi).
 */
export function useQuickMatch() {
  const socketRef = useRef(null);
  const [searching, setSearching] = useState(false);
  const [foundGameId, setFoundGameId] = useState(null);
  const [wideMatch, setWideMatch] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    return () => { socketRef.current?.disconnect(); };
  }, []);

  const search = useCallback((user, nickname, timeMode) => {
    setError(null);
    setFoundGameId(null);
    setWideMatch(false);
    setSearching(true);

    const socket = io(BACKEND, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_matchmaking', { userId: user.id, username: nickname || user.name, timeMode });
    });

    socket.on('match_found', ({ gameId, wideMatch: wide }) => {
      setSearching(false);
      setWideMatch(!!wide);
      setFoundGameId(gameId);
    });

    socket.on('error_msg', (msg) => {
      setError(msg);
      setSearching(false);
    });

    socket.on('connect_error', () => {
      setError("Serverga ulanib bo'lmadi");
      setSearching(false);
    });
  }, []);

  const cancel = useCallback((userId, timeMode) => {
    socketRef.current?.emit('leave_matchmaking', { userId, timeMode });
    socketRef.current?.disconnect();
    socketRef.current = null;
    setSearching(false);
  }, []);

  return { searching, foundGameId, wideMatch, error, search, cancel };
}
