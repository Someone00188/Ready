import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';
import { useGame, BACKEND } from '../hooks/useGame';
import { rippleFx } from '../hooks/useRipple';

const PRESET_GROUPS = [
  { label: 'Bullet', items: [['bullet_1_0', '1+0'], ['bullet_2_1', '2+1']] },
  { label: 'Blitz', items: [['blitz_3_0', '3+0'], ['blitz_3_2', '3+2'], ['blitz_5_0', '5+0']] },
  { label: 'Rapid', items: [['rapid_10_0', '10+0'], ['rapid_15_10', '15+10'], ['rapid_30_0', '30+0']] },
  { label: 'Classical', items: [['classical_60_0', '60+0'], ['classical_90_30', '90+30']] }
];

function formatTimeMode(tm) {
  if (!tm) return '';
  const custom = /^custom_(\d+)_(\d+)$/.exec(tm);
  if (custom) return `Custom · ${custom[1]}+${custom[2]}`;
  const known = {
    bullet_1_0: 'Bullet · 1+0', bullet_2_1: 'Bullet · 2+1',
    blitz_3_0: 'Blitz · 3+0', blitz_3_2: 'Blitz · 3+2', blitz_5_0: 'Blitz · 5+0',
    rapid_10_0: 'Rapid · 10+0', rapid_15_10: 'Rapid · 15+10', rapid_30_0: 'Rapid · 30+0',
    classical_60_0: 'Classical · 60+0', classical_90_30: 'Classical · 90+30'
  };
  return known[tm] || tm;
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)',
      background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '12px',
      padding: '12px 18px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)',
      zIndex: 250, boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
    }}>
      {message}
    </div>
  );
}

function CenterState({ icon, title, subtitle, children }) {
  return (
    <div className="page active" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', textAlign: 'center', padding: '0 24px' }}>
      {icon && <div style={{ fontSize: '40px', marginBottom: '12px' }}>{icon}</div>}
      <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>{title}</div>
      {subtitle && <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function BackHomeButton({ navigate, label = 'Bosh sahifaga' }) {
  return (
    <button
      className="btn-continue ripple"
      onClick={(e) => { rippleFx(e); navigate('/', { replace: true }); }}
      style={{ padding: '12px 24px' }}
    >
      {label}
    </button>
  );
}

// ============================================================
// 1) Match yaratish formasi (/play — matchId yo'q)
// ============================================================
function CreateForm({ user, profile }) {
  const navigate = useNavigate();
  const [timeMode, setTimeMode] = useState('blitz_5_0');
  const [customMode, setCustomMode] = useState(false);
  const [customMin, setCustomMin] = useState(15);
  const [customInc, setCustomInc] = useState(10);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const effectiveTimeMode = customMode ? `custom_${customMin}_${customInc}` : timeMode;

  async function createMatch() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${BACKEND}/api/games/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whiteId: user.id,
          whiteName: profile?.nickname || user.name,
          timeMode: effectiveTimeMode,
          gameMode: '1v1'
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Match yaratilmadi");
      }
      const { gameId } = await res.json();
      navigate(`/play/${gameId}`, { replace: true });
    } catch (e) {
      setErr(e.message || "Match yaratilmadi. Server ishlayaptimi?");
      setBusy(false);
    }
  }

  return (
    <div className="page active" style={{ padding: '16px' }}>
      <div className="sheet-title" style={{ marginBottom: '16px' }}>♟️ Create Match</div>

      <div className="more-group-title">Time Control</div>
      {!customMode && PRESET_GROUPS.map(g => (
        <div key={g.label} style={{ marginBottom: 10 }}>
          <div className="chip-group-label">{g.label}</div>
          <div className="chip-row">
            {g.items.map(([id, label]) => (
              <button key={id} className={`chip ripple${timeMode === id ? ' on' : ''}`}
                onClick={(e) => { rippleFx(e); setTimeMode(id); }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="chip-row" style={{ marginTop: 6 }}>
        <button className={`chip ripple${customMode ? ' on' : ''}`}
          onClick={(e) => { rippleFx(e); setCustomMode(v => !v); }}>
          ⚙️ Custom
        </button>
      </div>

      {customMode && (
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <label style={{ flex: 1, fontSize: '13px', color: 'var(--text-tertiary)' }}>
            Minutes
            <input type="number" min={1} max={180} value={customMin}
              onChange={e => setCustomMin(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
              style={{ width: '100%', marginTop: 4, padding: '10px', borderRadius: '10px', background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', fontSize: '15px' }} />
          </label>
          <label style={{ flex: 1, fontSize: '13px', color: 'var(--text-tertiary)' }}>
            Increment (sec)
            <input type="number" min={0} max={60} value={customInc}
              onChange={e => setCustomInc(Math.max(0, Math.min(60, Number(e.target.value) || 0)))}
              style={{ width: '100%', marginTop: 4, padding: '10px', borderRadius: '10px', background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', fontSize: '15px' }} />
          </label>
        </div>
      )}

      {err && <div className="form-error" style={{ marginTop: 12 }}>{err}</div>}

      <div className="sheet-controls" style={{ marginTop: 24 }}>
        <button className="btn-secondary ripple" onClick={(e) => { rippleFx(e); navigate('/'); }}>Cancel</button>
        <button className="btn-continue ripple" onClick={(e) => { rippleFx(e); createMatch(); }} disabled={busy}>
          {busy ? 'Creating…' : 'Create Match'}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 2) /play/:matchId — avtomatik qo'shilish yoki kutish xonasi
// ============================================================
function JoinOrWait({ matchId, user, myNickname }) {
  const navigate = useNavigate();
  const { state, role, connected, error, matchCancelled, cancelMatch } = useGame(matchId, user, false, myNickname);
  const [toast, setToast] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const shareUrl = useMemo(() => `${window.location.origin}/play/${matchId}`, [matchId]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  // Qora sifatida qo'shildik — darhol o'yin sahifasiga
  useEffect(() => {
    if (role === 'black') navigate(`/game/${matchId}`, { replace: true });
  }, [role, matchId, navigate]);

  // Yaratuvchimiz va raqib hozirgina qo'shildi — o'yin sahifasiga
  useEffect(() => {
    if (role === 'white' && state?.blackId) navigate(`/game/${matchId}`, { replace: true });
  }, [role, state?.blackId, matchId, navigate]);

  // Match yaratuvchi tomonidan (yoki avto-tozalash bilan) bekor qilindi
  useEffect(() => {
    if (matchCancelled) {
      const t = setTimeout(() => navigate('/', { replace: true }), 1800);
      return () => clearTimeout(t);
    }
  }, [matchCancelled, navigate]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('✅ Link nusxalandi');
    } catch {
      showToast("❌ Nusxalab bo'lmadi");
    }
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Chess.uz — Match', text: "Men bilan shaxmat o'ynang!", url: shareUrl });
      } catch { /* foydalanuvchi bekor qilgan bo'lishi mumkin — indamaymiz */ }
    } else {
      copyLink();
    }
  }

  async function handleCancel() {
    setCancelling(true);
    cancelMatch();
    // match_cancelled eventi kelguncha biroz kutamiz, kelmasa ham baribir qaytaramiz
    setTimeout(() => navigate('/', { replace: true }), 1200);
  }

  if (matchCancelled) {
    return <CenterState icon="🚫" title="Match bekor qilindi" subtitle="Bosh sahifaga qaytilmoqda…" />;
  }

  if (error) {
    return (
      <CenterState icon="❓" title="Match Not Found" subtitle="Bu havola noto'g'ri yoki muddati o'tgan.">
        <BackHomeButton navigate={navigate} />
      </CenterState>
    );
  }

  // Hali ulanmagan / birinchi holat kutilmoqda
  if (!state && !role) {
    return (
      <div className="center-loader"><div className="spinner" /></div>
    );
  }

  // Ikkala joy ham band — biz na yaratuvchi, na hozirgina qo'shilgan black'miz
  if (role === 'spectator') {
    if (state?.status === 'cancelled') {
      return (
        <CenterState icon="🚫" title="Match Not Found" subtitle="Bu match yaratuvchi tomonidan bekor qilingan.">
          <BackHomeButton navigate={navigate} />
        </CenterState>
      );
    }
    if (state?.archived || state?.status === 'finished') {
      return (
        <CenterState icon="🏁" title="Match tugagan" subtitle="Bu o'yin allaqachon yakunlangan.">
          <BackHomeButton navigate={navigate} />
        </CenterState>
      );
    }
    return (
      <CenterState icon="🔒" title="Match is Full" subtitle="Bu matchda ikkita o'yinchi joyi allaqachon band.">
        <BackHomeButton navigate={navigate} />
      </CenterState>
    );
  }

  // role === 'white' — Waiting Room
  return (
    <div className="page active" style={{ padding: '16px' }}>
      <Toast message={toast} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: '24px' }}>
        <div style={{ width: '18px', height: '18px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '16px' }} />
        <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '4px' }}>Waiting for Opponent…</div>
        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
          {formatTimeMode(state?.timeMode)}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700,
          color: connected ? 'var(--accent)' : 'var(--red)', marginBottom: '20px'
        }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: connected ? 'var(--accent)' : 'var(--red)'
          }} />
          {connected ? 'Ulandi' : 'Ulanmoqda…'}
        </div>

        <div style={{
          width: '100%', background: 'var(--card)', border: '1px solid var(--card-border)',
          borderRadius: '12px', padding: '12px', fontSize: '13px', wordBreak: 'break-all',
          color: 'var(--text-tertiary)', marginBottom: '16px'
        }}>
          {shareUrl}
        </div>

        <div style={{ display: 'flex', gap: '10px', width: '100%', marginBottom: '10px' }}>
          <button className="btn-secondary ripple" style={{ flex: 1 }} onClick={(e) => { rippleFx(e); copyLink(); }}>
            📋 Copy Link
          </button>
          <button className="btn-continue ripple" style={{ flex: 1 }} onClick={(e) => { rippleFx(e); shareLink(); }}>
            📤 Share
          </button>
        </div>

        <button className="btn-secondary ripple" style={{ width: '100%', color: 'var(--red)' }}
          onClick={(e) => { rippleFx(e); handleCancel(); }} disabled={cancelling}>
          {cancelling ? 'Bekor qilinmoqda…' : '✕ Cancel Match'}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ============================================================
export default function CreateMatchPage() {
  const { matchId } = useParams();
  const { user, ready } = useTelegram();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!user) return;
    fetch(`${BACKEND}/api/users/${user.id}`).then(r => r.ok ? r.json() : null).then(setProfile).catch(() => {});
  }, [user]);

  if (!ready || !user) {
    return <div className="center-loader"><div className="spinner" /></div>;
  }

  if (matchId) {
    return <JoinOrWait matchId={matchId} user={user} myNickname={profile?.nickname} />;
  }
  return <CreateForm user={user} profile={profile} />;
}
