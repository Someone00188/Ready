import { useState, useEffect } from 'react';
import { BACKEND } from '../hooks/useGame';
import { useQuickMatch } from '../hooks/useQuickMatch';
import { rippleFx } from '../hooks/useRipple';

const TIME_GROUPS = [
  { label: 'Bullet', items: [['bullet_1', '1 min'], ['bullet_3', '3 min'], ['bullet_5', '5 min']] },
  { label: 'Normal', items: [['normal_10', '10 min'], ['normal_20', '20 min'], ['normal_30', '30 min']] },
  { label: 'Long', items: [['long_1h', '1 hour'], ['long_1d', '1 day']] }
];

const THEMES = [
  { id: 'green', light: '#eeeed2', dark: '#769656' },
  { id: 'classic', light: '#f0d9b5', dark: '#b58863' },
  { id: 'mono', light: '#d8d8d8', dark: '#565352' }
];

export default function PlaySheet({ user, profile, initialMode = '1v1', onClose, onCreated }) {
  const [mode, setMode] = useState(initialMode);
  const [timeMode, setTimeMode] = useState('normal_10');
  const [difficulty, setDifficulty] = useState(3);
  const [theme, setTheme] = useState(() => localStorage.getItem('boardTheme') || 'green');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const qm = useQuickMatch();

  useEffect(() => {
    document.documentElement.dataset.board = theme;
    localStorage.setItem('boardTheme', theme);
  }, [theme]);

  // Quick Match raqib topganda — o'yinga o'tamiz
  useEffect(() => {
    if (qm.foundGameId) onCreated(qm.foundGameId);
  }, [qm.foundGameId, onCreated]);

  function startQuickMatch() {
    setErr(null);
    qm.search(user, profile?.nickname, timeMode);
  }

  function cancelQuickMatch() {
    qm.cancel(user.id, timeMode);
  }

  async function createGame() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${BACKEND}/api/games/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whiteId: user.id,
          whiteName: profile?.nickname || user.name,
          timeMode: mode === 'ai' ? 'ai' : timeMode,
          difficulty: mode === 'ai' ? difficulty : null,
          gameMode: mode
        })
      });
      if (!res.ok) throw new Error();
      const { gameId } = await res.json();
      onCreated(gameId);
    } catch {
      setErr("Couldn't create game. Is the server running?");
      setBusy(false);
    }
  }

  function handleClose() {
    if (qm.searching) cancelQuickMatch();
    onClose();
  }

  return (
    <div className="sheet-overlay" onClick={handleClose}>
      <div className="sheet-modal" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle"></div>
        <div className="sheet-title">New Game</div>

        <div className="more-group-title">Opponent</div>
        <div className="chip-row">
          <button className={`chip ripple${mode === 'quick' ? ' on' : ''}`} onClick={(e) => { rippleFx(e); setMode('quick'); }}>⚡ Quick Match</button>
          <button className={`chip ripple${mode === '1v1' ? ' on' : ''}`} onClick={(e) => { rippleFx(e); setMode('1v1'); }}>With a Friend</button>
          <button className={`chip ripple${mode === 'ai' ? ' on' : ''}`} onClick={(e) => { rippleFx(e); setMode('ai'); }}>vs AI</button>
        </div>

        {mode === 'quick' && (
          <>
            <div className="more-group-title">Time Control</div>
            {TIME_GROUPS.map(g => (
              <div key={g.label} style={{ marginBottom: 10 }}>
                <div className="chip-group-label">{g.label}</div>
                <div className="chip-row">
                  {g.items.map(([id, label]) => (
                    <button key={id} className={`chip ripple${timeMode === id ? ' on' : ''}`} onClick={(e) => { rippleFx(e); setTimeMode(id); }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {qm.searching && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 4px', color: 'var(--text-secondary)', fontSize: 14 }}>
                <i className="fa-solid fa-circle-notch fa-spin" style={{ color: 'var(--accent)' }}></i>
                Searching for an opponent near your rating…
              </div>
            )}
            {qm.error && <div className="form-error">{qm.error}</div>}
          </>
        )}

        {mode === '1v1' && (
          <>
            <div className="more-group-title">Time Control</div>
            {TIME_GROUPS.map(g => (
              <div key={g.label} style={{ marginBottom: 10 }}>
                <div className="chip-group-label">{g.label}</div>
                <div className="chip-row">
                  {g.items.map(([id, label]) => (
                    <button key={id} className={`chip ripple${timeMode === id ? ' on' : ''}`} onClick={(e) => { rippleFx(e); setTimeMode(id); }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
        {mode === 'ai' && (
          <>
            <div className="more-group-title">AI Difficulty</div>
            <div className="chip-row">
              {[1, 2, 3, 4, 5].map(d => (
                <button key={d} className={`chip ripple${difficulty === d ? ' on' : ''}`} onClick={(e) => { rippleFx(e); setDifficulty(d); }}>
                  {['New', 'Easy', 'Medium', 'Expert', 'Master'][d - 1]}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="more-group-title">Board Theme</div>
        <div className="chip-row">
          {THEMES.map(t => (
            <button key={t.id} className={`theme-dot ripple${theme === t.id ? ' on' : ''}`} onClick={(e) => { rippleFx(e); setTheme(t.id); }}>
              <i style={{ background: t.light }} /><i style={{ background: t.dark }} />
              <i style={{ background: t.dark }} /><i style={{ background: t.light }} />
            </button>
          ))}
        </div>

        {err && <div className="form-error">{err}</div>}

        <div className="sheet-controls">
          {mode === 'quick' ? (
            qm.searching ? (
              <>
                <button className="btn-secondary ripple" style={{ flex: 1 }} onClick={(e) => { rippleFx(e); cancelQuickMatch(); }}>Cancel Search</button>
              </>
            ) : (
              <>
                <button className="btn-secondary ripple" onClick={(e) => { rippleFx(e); onClose(); }}>Cancel</button>
                <button className="btn-continue ripple" onClick={(e) => { rippleFx(e); startQuickMatch(); }}>Find Match</button>
              </>
            )
          ) : (
            <>
              <button className="btn-secondary ripple" onClick={(e) => { rippleFx(e); onClose(); }}>Cancel</button>
              <button className="btn-continue ripple" onClick={(e) => { rippleFx(e); createGame(); }} disabled={busy}>
                {busy ? 'Creating…' : 'Start'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
