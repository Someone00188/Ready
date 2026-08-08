import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';
import { BACKEND } from '../hooks/useGame';
import { rippleFx } from '../hooks/useRipple';

const TIME_LABELS = {
  bullet_1: 'Bullet 1', bullet_3: 'Bullet 3', bullet_5: 'Bullet 5',
  normal_10: 'Normal 10', normal_20: 'Normal 20', normal_30: 'Normal 30',
  long_1h: 'Uzoq 1s', long_1d: 'Uzoq 1k', ai: 'AI'
};

const FILTERS = [
  { id: 'all', label: 'All', icon: null },
  { id: 'bullet', label: 'Bullet', icon: 'fa-solid fa-rocket' },
  { id: 'normal', label: 'Normal', icon: 'fa-regular fa-clock' },
  { id: 'long', label: 'Long', icon: 'fa-solid fa-bolt' }
];

function dayLabel(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yest.toDateString();
  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' });
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { user, ready } = useTelegram();
  const [profile, setProfile] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch(`${BACKEND}/api/users/${user.id}`).then(r => r.json()),
      fetch(`${BACKEND}/api/users/${user.id}/games?limit=50`).then(r => r.json())
    ]).then(([p, g]) => { setProfile(p); setGames(g); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const me = user ? String(user.id) : null;

  const enriched = useMemo(() => games.map(g => {
    const isWhite = String(g.white_id) === me;
    const oppName = isWhite ? (g.black_name || 'AI') : (g.white_name || '?');
    const oppRating = isWhite ? g.black_rating : g.white_rating;
    const change = isWhite ? g.white_rating_change : g.black_rating_change;

    let resClass = 'draw', resLabel = 'DRAW';
    if (g.result === '1-0') { resClass = isWhite ? 'win' : 'loss'; }
    else if (g.result === '0-1') { resClass = isWhite ? 'loss' : 'win'; }
    if (resClass === 'win') resLabel = 'WIN';
    else if (resClass === 'loss') resLabel = 'LOSS';

    const familyKey = String(g.time_mode).split('_')[0]; // bullet | normal | long | ai
    return { ...g, oppName, oppRating, change, resClass, resLabel, familyKey };
  }), [games, me]);

  const filtered = filter === 'all' ? enriched : enriched.filter(g => g.familyKey === filter);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const g of filtered) {
      const label = dayLabel(g.created_at);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(g);
    }
    return [...map.entries()];
  }, [filtered]);

  const wins = enriched.filter(g => g.resClass === 'win').length;
  const losses = enriched.filter(g => g.resClass === 'loss').length;
  const draws = enriched.filter(g => g.resClass === 'draw').length;

  const bestRating = Math.max(profile?.rating_bullet ?? 0, profile?.rating_normal ?? 0, profile?.rating_long ?? 0);

  if (!ready || loading) {
    return <div className="center-loader"><div className="spinner" /></div>;
  }

  return (
    <div className="page active" id="page-history">

      <div className="topbar">
        <div className="topbar-title-wrap">
          <div className="topbar-icon"><i className="fa-regular fa-clock"></i></div>
          <div>
            <div className="topbar-title">Game History</div>
            <div className="topbar-subtitle">All your games in one place</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-tabs">
        {FILTERS.map(f => (
          <button
            key={f.id}
            className={`filter-tab ripple${filter === f.id ? ' active' : ''}`}
            onClick={(e) => { rippleFx(e); setFilter(f.id); }}
          >
            {f.icon && <i className={f.icon}></i>}
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="hist-stats-row four-col">
        <div className="hist-stat"><div className="hist-stat-icon" style={{ color: 'var(--accent)' }}><i className="fa-solid fa-arrow-trend-up"></i></div><div className="hist-stat-num">{profile?.total_games ?? 0}</div><div className="hist-stat-lbl">Games</div></div>
        <div className="hist-stat"><div className="hist-stat-icon" style={{ color: 'var(--accent)' }}><i className="fa-solid fa-thumbs-up"></i></div><div className="hist-stat-num">{wins}</div><div className="hist-stat-lbl">Wins</div></div>
        <div className="hist-stat"><div className="hist-stat-icon" style={{ color: 'var(--red)' }}><i className="fa-solid fa-thumbs-down"></i></div><div className="hist-stat-num">{losses}</div><div className="hist-stat-lbl">Losses</div></div>
        <div className="hist-stat"><div className="hist-stat-icon" style={{ color: 'var(--yellow)' }}><i className="fa-solid fa-equals"></i></div><div className="hist-stat-num">{draws}</div><div className="hist-stat-lbl">Draws</div></div>
      </div>

      {grouped.length === 0 ? (
        <div className="empty-state-mini"><p>Hali o'yin o'ynamagansiz.</p></div>
      ) : grouped.map(([label, list]) => (
        <div key={label}>
          <div className="day-divider">{label}</div>
          <div className="stagger">
            {list.map(g => (
              <div
                className={`game-row ${g.resClass}`}
                key={g.id}
                onClick={(e) => { rippleFx(e); navigate(`/game/${g.id}`); }}
                style={{ cursor: 'pointer' }}
              >
                <div className={`result-badge ${g.resClass}`}>
                  <i className={`fa-solid ${g.resClass === 'win' ? 'fa-trophy' : g.resClass === 'loss' ? 'fa-face-frown' : 'fa-equals'}`}></i>
                </div>
                <div className={`row-avatar ${g.resClass}`}>
                  <div className="row-avatar-fallback">{g.oppName.charAt(0).toUpperCase()}</div>
                  <div className="ring"></div>
                </div>
                <div className="row-info">
                  <div className="row-name-line"><span className="row-name">{g.oppName}</span></div>
                  <div className="row-sub"><span>{g.oppRating ?? '—'}</span> · <span>{TIME_LABELS[g.time_mode] || g.time_mode}</span></div>
                </div>
                <div className="row-right">
                  <span className={`result-tag ${g.resClass}`}>{g.resLabel}</span>
                  {g.change != null && g.change !== 0 && (
                    <span className="row-time" style={{ color: g.change > 0 ? 'var(--accent)' : 'var(--red)' }}>
                      {g.change > 0 ? '+' : ''}{g.change}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Bottom Stats */}
      <div className="bottom-stats-card">
        <div className="bstat">
          <div className="bstat-icon fire"><i className="fa-solid fa-fire"></i></div>
          <div className="bstat-num">{profile?.streak ?? 0}</div>
          <div className="bstat-lbl">Current Win<br />Streak</div>
        </div>
        <div className="bstat">
          <div className="bstat-icon rating"><i className="fa-solid fa-chart-line"></i></div>
          <div className="bstat-num">{bestRating || '—'}</div>
          <div className="bstat-lbl">Best<br />Rating</div>
        </div>
        <div className="bstat">
          <div className="bstat-icon time"><i className="fa-regular fa-clock"></i></div>
          <div className="bstat-num">{profile?.total_games ?? 0}</div>
          <div className="bstat-lbl">Total<br />Games</div>
        </div>
      </div>

    </div>
  );
}
