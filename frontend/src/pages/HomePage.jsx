import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';
import { BACKEND } from '../hooks/useGame';
import { rippleFx } from '../hooks/useRipple';
import { stickerUrl } from '../data/stickers';
import PlaySheet from '../components/PlaySheet';

const TIME_LABELS = {
  bullet_1: 'Bullet · 1 daq', bullet_3: 'Bullet · 3 daq', bullet_5: 'Bullet · 5 daq',
  normal_10: 'Normal · 10 daq', normal_20: 'Normal · 20 daq', normal_30: 'Normal · 30 daq',
  long_1h: 'Uzoq · 1 soat', long_1d: 'Uzoq · 1 kun', ai: 'AI'
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}d oldin`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}s oldin`;
  const days = Math.floor(hrs / 24);
  return `${days}k oldin`;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user, ready } = useTelegram();

  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [games, setGames] = useState([]);
  const [showPlaySheet, setShowPlaySheet] = useState(false);
  const [playMode, setPlayMode] = useState('1v1');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [p, f, g] = await Promise.all([
        fetch(`${BACKEND}/api/users/${user.id}`).then(r => r.json()),
        fetch(`${BACKEND}/api/users/${user.id}/friends`).then(r => r.json()),
        fetch(`${BACKEND}/api/users/${user.id}/games?limit=5`).then(r => r.json())
      ]);
      setProfile(p);
      setFriends(f);
      setGames(g);
    } catch { /* offline — bo'sh holatda qoladi */ }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (!ready || loading) {
    return <div className="center-loader"><div className="spinner" /></div>;
  }

  const winRate = profile?.total_games ? Math.round((profile.wins / profile.total_games) * 100) : 0;
  const me = user ? String(user.id) : null;

  function openPlay(mode) {
    setPlayMode(mode);
    setShowPlaySheet(true);
  }

  return (
    <div className="page active" id="page-home">

      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-left">
          <div className="avatar-ring">
            <div className="avatar-fallback">{(profile?.nickname || user?.name || '?').charAt(0).toUpperCase()}</div>
            {profile?.profile_sticker ? (
              <div style={{
                position: 'absolute', bottom: '-2px', right: '-2px',
                width: '20px', height: '20px', borderRadius: '50%',
                background: 'var(--bg)', border: '2px solid var(--bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <img src={stickerUrl(profile.profile_sticker)} alt="" style={{ width: '13px', height: '13px' }} />
              </div>
            ) : (
              <div className="online-dot"></div>
            )}
          </div>
          <div>
            <div className="profile-name-row">
              <span className="profile-name">{profile?.nickname || user?.name || '—'}</span>
              <i className="fa-solid fa-circle-check verified-badge"></i>
            </div>
            <div className="profile-loc">
              <span className="flag-emoji">🇺🇿</span> {profile?.total_games || 0} o'yin
            </div>
          </div>
        </div>
        <div className="profile-right">
          <button className="bell-btn icon-btn ripple" onClick={rippleFx}>
            <i className="fa-regular fa-bell"></i>
          </button>
        </div>
      </div>

      {/* Rating / Winrate / Streak strip */}
      <div className="profile-stats-strip">
        <div className="pstat rating"><i className="fa-solid fa-trophy"></i>{profile?.rating_bullet ?? 1200}<span className="lbl">Rating</span></div>
        <div className="pstat winrate"><i className="fa-solid fa-chart-line"></i>{winRate}%<span className="lbl">Win Rate</span></div>
        <div className="pstat streak"><i className="fa-solid fa-fire"></i>{profile?.streak ?? 0}<span className="lbl">Streak</span></div>
      </div>

      {/* Action Cards */}
      <div className="actions-row">
        <button className="action-card quick ripple" onClick={(e) => { rippleFx(e); openPlay('1v1'); }}>
          <div className="action-icon"><i className="fa-solid fa-bolt"></i></div>
          <div className="action-label">Quick Play</div>
          <div className="action-sub">Play now</div>
        </button>
        <button className="action-card friends ripple" onClick={(e) => { rippleFx(e); navigate('/more/friends'); }}>
          <div className="action-icon"><i className="fa-solid fa-user-group"></i></div>
          <div className="action-label">Play Friends</div>
          <div className="action-sub">Challenge friends</div>
        </button>
        <button className="action-card bot ripple" onClick={(e) => { rippleFx(e); openPlay('ai'); }}>
          <div className="action-icon"><i className="fa-solid fa-robot"></i></div>
          <div className="action-label">Play Bot</div>
          <div className="action-sub">Train with AI</div>
        </button>
        <button className="action-card ripple" onClick={(e) => { rippleFx(e); navigate('/play'); }}>
          <div className="action-icon"><i className="fa-solid fa-link"></i></div>
          <div className="action-label">Create Match</div>
          <div className="action-sub">Share a link</div>
        </button>
      </div>

      {/* Stats Row */}
      <div className="stats-row">
        <div className="stat-box"><div className="stat-icon games"><i className="fa-solid fa-bullseye"></i></div><div className="stat-num">{profile?.total_games ?? 0}</div><div className="stat-lbl">Games</div></div>
        <div className="stat-box"><div className="stat-icon wins"><i className="fa-solid fa-thumbs-up"></i></div><div className="stat-num">{profile?.wins ?? 0}</div><div className="stat-lbl">Wins</div></div>
        <div className="stat-box"><div className="stat-icon losses"><i className="fa-solid fa-thumbs-down"></i></div><div className="stat-num">{profile?.losses ?? 0}</div><div className="stat-lbl">Losses</div></div>
        <div className="stat-box"><div className="stat-icon streak"><i className="fa-solid fa-crown"></i></div><div className="stat-num">{profile?.streak ?? 0}</div><div className="stat-lbl">Win Streak</div></div>
      </div>

      {/* Recent Games */}
      <div className="section-header">
        <span className="section-title">RECENT GAMES</span>
        <a className="section-link" onClick={() => navigate('/history')}>See All <i className="fa-solid fa-chevron-right"></i></a>
      </div>

      {games.length === 0 ? (
        <div className="empty-state-mini">
          <p>Hali o'yin o'ynamagansiz.</p>
        </div>
      ) : (
        <div className="stagger">
          {games.map(g => {
            const isWhite = String(g.white_id) === me;
            const oppName = isWhite ? (g.black_name || 'AI') : (g.white_name || '?');
            const change = isWhite ? g.white_rating_change : g.black_rating_change;
            let trophyClass = 'win';
            if (g.result === '1-0') trophyClass = isWhite ? 'win' : 'loss';
            else if (g.result === '0-1') trophyClass = isWhite ? 'loss' : 'win';
            else trophyClass = 'win';

            return (
              <div
                className="recent-row"
                key={g.id}
                onClick={(e) => { rippleFx(e); navigate(`/game/${g.id}`); }}
                style={{ cursor: 'pointer' }}
              >
                <div className={`recent-trophy ${trophyClass}`}><i className="fa-solid fa-trophy"></i></div>
                <div className="recent-avatar-fallback">{oppName.charAt(0).toUpperCase()}</div>
                <div className="recent-info">
                  <div className="recent-vs">vs {oppName}</div>
                  <div className="recent-meta">{TIME_LABELS[g.time_mode] || g.time_mode}</div>
                </div>
                <div className="recent-right">
                  {change != null && change !== 0 && (
                    <div className={`recent-diff ${change > 0 ? 'pos' : 'neg'}`}>{change > 0 ? '+' : ''}{change}</div>
                  )}
                  <div className="recent-ago">{timeAgo(g.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Friends Online */}
      <div className="section-header" style={{ marginTop: 18 }}>
        <span className="section-title">FRIENDS ({friends.length})</span>
        <a className="section-link" onClick={() => navigate('/more/friends')}>See All <i className="fa-solid fa-chevron-right"></i></a>
      </div>
      <div className="friends-scroll">
        {friends.map(f => (
          <div className="friend-item" key={f.telegram_id}>
            <div className="friend-avatar-wrap">
              <div className="friend-avatar-fallback">{(f.avatar_emoji || f.nickname || '?').charAt(0).toUpperCase()}</div>
              <div className="online"></div>
            </div>
            <div className="friend-name">{f.nickname}</div>
            <div className="friend-rating">{f.rating_bullet}</div>
          </div>
        ))}
        <div className="friend-item" onClick={() => navigate('/more/friends')}>
          <div className="friend-add"><i className="fa-solid fa-plus"></i></div>
          <div className="friend-name">Add</div>
        </div>
      </div>

      {showPlaySheet && (
        <PlaySheet
          user={user}
          profile={profile}
          initialMode={playMode}
          onClose={() => setShowPlaySheet(false)}
          onCreated={(gameId) => navigate(`/game/${gameId}`)}
        />
      )}
    </div>
  );
}
