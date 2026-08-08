import { useEffect, useRef, useState, useCallback, createContext, useContext } from 'react';
import { io } from 'socket.io-client';
import { BACKEND } from './useGame';

const ChallengeContext = createContext(null);

/**
 * Butun ilova bo'ylab bitta socket ulanishi.
 * Do'stlar statusi va challenge (taklif) tizimini boshqaradi.
 * Bu hook faqat App darajasida bir marta ishga tushiriladi (Provider).
 */
export function ChallengeProvider({ user, myNickname, children }) {
  const socketRef = useRef(null);
  const [friendStatuses, setFriendStatuses] = useState({}); // userId -> 'online'|'offline'|'in_game'
  const [incomingChallenge, setIncomingChallenge] = useState(null); // { challengeId, fromId, fromName, timeMode }
  const [outgoingChallenge, setOutgoingChallenge] = useState(null); // { challengeId, toId }
  const [challengeNotice, setChallengeNotice] = useState(null); // { type: 'declined'|'expired'|'error', message }
  const [redirectGameId, setRedirectGameId] = useState(null);

  useEffect(() => {
    if (!user) return;

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

    function announce() {
      socket.emit('user_online', { userId: user.id, username: myNickname || user.name });
    }

    socket.on('connect', announce);
    // Reconnect bo'lganda ham qayta e'lon qilamiz
    socket.io.on('reconnect', announce);

    socket.on('friend_status_changed', ({ userId, status }) => {
      setFriendStatuses(prev => ({ ...prev, [userId]: status }));
    });

    socket.on('friends_status', (statuses) => {
      setFriendStatuses(prev => ({ ...prev, ...statuses }));
    });

    socket.on('challenge_received', ({ challengeId, fromId, fromName, timeMode }) => {
      setIncomingChallenge({ challengeId, fromId, fromName, timeMode });
    });

    socket.on('challenge_sent', ({ challengeId, toId }) => {
      setOutgoingChallenge({ challengeId, toId });
    });

    socket.on('challenge_error', ({ error }) => {
      setChallengeNotice({ type: 'error', message: error });
      setOutgoingChallenge(null);
    });

    socket.on('challenge_declined', () => {
      setChallengeNotice({ type: 'declined', message: 'Challenge declined.' });
      setOutgoingChallenge(null);
    });

    socket.on('challenge_expired', () => {
      setChallengeNotice({ type: 'expired', message: 'Challenge expired.' });
      setOutgoingChallenge(null);
      setIncomingChallenge(null);
    });

    socket.on('challenge_cancelled', () => {
      setIncomingChallenge(null);
    });

    socket.on('challenge_accepted', ({ gameId }) => {
      setOutgoingChallenge(null);
      setIncomingChallenge(null);
      setRedirectGameId(gameId);
    });

    return () => { socket.close(); socketRef.current = null; };
  }, [user?.id, myNickname]);

  const requestFriendsStatus = useCallback((friendIds) => {
    socketRef.current?.emit('get_friends_status', { friendIds });
  }, []);

  const sendChallenge = useCallback((toId, timeMode) => {
    if (!socketRef.current || !user) return;
    socketRef.current.emit('send_challenge', {
      fromId: user.id,
      fromName: myNickname || user.name,
      toId,
      timeMode
    });
  }, [user, myNickname]);

  const acceptChallenge = useCallback((challengeId) => {
    socketRef.current?.emit('accept_challenge', { challengeId });
  }, []);

  const declineChallenge = useCallback((challengeId) => {
    socketRef.current?.emit('decline_challenge', { challengeId });
    setIncomingChallenge(null);
  }, []);

  const cancelChallenge = useCallback((challengeId) => {
    socketRef.current?.emit('cancel_challenge', { challengeId });
    setOutgoingChallenge(null);
  }, []);

  const clearNotice = useCallback(() => setChallengeNotice(null), []);
  const clearRedirect = useCallback(() => setRedirectGameId(null), []);

  const value = {
    friendStatuses, requestFriendsStatus,
    incomingChallenge, outgoingChallenge, challengeNotice, redirectGameId,
    sendChallenge, acceptChallenge, declineChallenge, cancelChallenge,
    clearNotice, clearRedirect
  };

  return (
    <ChallengeContext.Provider value={value}>
      {children}
    </ChallengeContext.Provider>
  );
}

export function useChallenge() {
  const ctx = useContext(ChallengeContext);
  if (!ctx) throw new Error('useChallenge must be used within ChallengeProvider');
  return ctx;
}
