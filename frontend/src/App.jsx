
import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTelegram } from './hooks/useTelegram';
import { BACKEND } from './hooks/useGame';
import { ChallengeProvider, useChallenge } from './hooks/useChallenge';
import BottomNav from './components/BottomNav';
import { rippleFx } from './hooks/useRipple';

import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import HistoryPage from './pages/HistoryPage';
import MorePage from './pages/MorePage';
import FriendsPage from './pages/FriendsPage';
import ProfilePage from './pages/ProfilePage';
import StatsPage from './pages/StatsPage';
import ThemePage from './pages/ThemePage';
import GamePage from './pages/GamePage';
import CreateMatchPage from './pages/CreateMatchPage';
import StickerPickerPage from './pages/StickerPickerPage';

// Sahifalar shu ro'yxatda bo'lsa pastki navigatsiya ko'rsatiladi
// (chessmate.html dizaynida faqat home/history/more'da bottom-nav bor)
const NAV_ROUTES = ['/', '/history', '/more'];

/**
 * Ilova bo'ylab har doim ko'rinadigan challenge UI:
 * - Kiruvchi taklif popup (Accept/Decline)
 * - Yuborilgan taklif kutish holati
 * - Bildirishnomalar (rad etildi / muddati tugadi / xato)
 * - Qabul qilingandan keyin o'yin sahifasiga avtomatik o'tish
 */
function GlobalChallengeUI() {
  const navigate = useNavigate();
  const {
    incomingChallenge, outgoingChallenge, challengeNotice, redirectGameId,
    acceptChallenge, declineChallenge, cancelChallenge, clearNotice, clearRedirect
  } = useChallenge();

  useEffect(() => {
    if (redirectGameId) {
      navigate(`/game/${redirectGameId}`);
      clearRedirect();
    }
  }, [redirectGameId]);

  useEffect(() => {
    if (challengeNotice) {
      const t = setTimeout(clearNotice, 3000);
      return () => clearTimeout(t);
    }
  }, [challengeNotice]);

  return (
    <>
      {incomingChallenge && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200
        }}>
          <div style={{
            width: '100%', maxWidth: 'calc(100% - 36px)', background: 'var(--bg-elevated)',
            borderRadius: '24px 24px 0 0', padding: '20px', marginBottom: 0
          }}>
            <div style={{ fontSize: '18px', fontWeight: 800, textAlign: 'center', marginBottom: '8px' }}>
              ⚔️ Challenge!
            </div>
            <p style={{ fontSize: '15px', textAlign: 'center', marginBottom: '16px' }}>
              <strong>{incomingChallenge.fromName}</strong> challenged you to a game.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={(e) => { rippleFx(e); declineChallenge(incomingChallenge.challengeId); }}
                className="ripple"
                style={{
                  flex: 1, padding: '14px', borderRadius: '10px', background: 'var(--glass)',
                  border: '1px solid var(--card-border)', fontWeight: 700, cursor: 'pointer', fontSize: '14px'
                }}>
                Decline
              </button>
              <button
                onClick={(e) => { rippleFx(e); acceptChallenge(incomingChallenge.challengeId); }}
                className="ripple"
                style={{
                  flex: 1, padding: '14px', borderRadius: '10px', background: 'var(--accent-soft)',
                  border: '1px solid var(--accent)', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontSize: '14px'
                }}>
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {outgoingChallenge && !incomingChallenge && (
        <div style={{
          position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '12px',
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
          zIndex: 150, boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
        }}>
          <div style={{ width: '16px', height: '16px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Waiting for response…</span>
          <button
            onClick={() => cancelChallenge(outgoingChallenge.challengeId)}
            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
            Cancel
          </button>
        </div>
      )}

      {challengeNotice && (
        <div style={{
          position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)',
          background: challengeNotice.type === 'error' ? 'var(--red-soft)' : 'var(--card)',
          border: `1px solid ${challengeNotice.type === 'error' ? 'var(--red)' : 'var(--card-border)'}`,
          borderRadius: '12px', padding: '12px 16px', fontSize: '13px', fontWeight: 700,
          color: challengeNotice.type === 'error' ? 'var(--red)' : 'var(--text-primary)',
          zIndex: 150, boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
        }}>
          {challengeNotice.message}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function Gate() {
  const { user, ready } = useTelegram();
  const [status, setStatus] = useState('checking'); // checking | needs-register | ready
  const [myNickname, setMyNickname] = useState(null);
  const location = useLocation();

  // Admin panel orqali backup restore qilinganda backend barcha ulangan
  // clientlarga 'data_restored' signalini yuboradi (backend/api/admin.js).
  // Bu paytgacha sahifa hali eski (restore'dan oldingi) so'rovlar natijasini
  // xotirasida/state'ida ushlab turishi mumkin edi — aynan shu narsa "botda
  // restore bo'ldi, saytda hammasi 0 ko'rinyapti" holatiga o'xshab ko'rinardi
  // (DB o'zi to'g'ri yangilangan bo'lsa ham). Signal kelganda butun sahifani
  // qayta yuklash — barcha keshlar/state'larni yangi DB holatiga moslashtirishning
  // eng oddiy va ishonchli yo'li.
  useEffect(() => {
    let socket;
    let cancelled = false;
    import('socket.io-client').then(({ io }) => {
      if (cancelled) return;
      socket = io(BACKEND, { transports: ['polling', 'websocket'] });
      socket.on('data_restored', () => {
        window.location.reload();
      });
    });
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, []);

  const check = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${BACKEND}/api/users/${user.id}`);
      if (res.status === 404) { setStatus('needs-register'); return; }
      const data = await res.json();
      setStatus(data.registered ? 'ready' : 'needs-register');
      setMyNickname(data.nickname || null);
    } catch {
      // Server javob bermasa ham botni ochib qo'yamiz — o'yin sahifalarida
      // o'zining xato ko'rsatishi ishlayveradi.
      setStatus('ready');
    }
  }, [user]);

  useEffect(() => { if (ready) check(); }, [ready, check]);

  if (!ready || status === 'checking') {
    return (
      <div className="app">
        <div className="center-loader"><div className="spinner" /></div>
      </div>
    );
  }

  if (status === 'needs-register') {
    return <RegisterPage onDone={() => setStatus('ready')} />;
  }

  const showNav = NAV_ROUTES.includes(location.pathname);

  return (
    <ChallengeProvider user={user} myNickname={myNickname}>
      <div className="app">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/more" element={<MorePage />} />
          <Route path="/more/friends" element={<FriendsPage />} />
          <Route path="/more/profile" element={<ProfilePage />} />
          <Route path="/more/profile/sticker" element={<StickerPickerPage />} />
          <Route path="/more/stats" element={<StatsPage />} />
          <Route path="/more/theme" element={<ThemePage />} />
          <Route path="/game/:gameId" element={<GamePage />} />
          <Route path="/play" element={<CreateMatchPage />} />
          <Route path="/play/:matchId" element={<CreateMatchPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {showNav && <BottomNav active={location.pathname} />}
        <GlobalChallengeUI />
      </div>
    </ChallengeProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Gate />
    </BrowserRouter>
  );
}
