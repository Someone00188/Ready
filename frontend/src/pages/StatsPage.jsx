import { useState, useEffect } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import { BACKEND } from '../hooks/useGame';
import DetailTopbar from '../components/DetailTopbar';

export default function StatsPage() {
  const { user } = useTelegram();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch(`${BACKEND}/api/users/${user.id}/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="center-loader"><div className="spinner" /></div>;

  const empty = !stats || stats.total_games === 0;

  return (
    <div className="page active">
      <DetailTopbar icon="fa-solid fa-chart-simple" title="Statistics" subtitle="Your performance breakdown" />

      {empty ? (
        <div className="empty-state-mini"><p>Hali statistika yo'q — birinchi o'yiningizni boshlang.</p></div>
      ) : (
        <>
          <div className="hist-stats-row">
            <div className="hist-stat"><div className="hist-stat-icon" style={{ color: 'var(--accent)' }}><i className="fa-solid fa-bullseye"></i></div><div className="hist-stat-num">{stats.total_games}</div><div className="hist-stat-lbl">Games</div></div>
            <div className="hist-stat"><div className="hist-stat-icon" style={{ color: 'var(--accent)' }}><i className="fa-solid fa-chart-line"></i></div><div className="hist-stat-num">{stats.win_rate}%</div><div className="hist-stat-lbl">Win Rate</div></div>
            <div className="hist-stat"><div className="hist-stat-icon" style={{ color: 'var(--accent)' }}><i className="fa-solid fa-thumbs-up"></i></div><div className="hist-stat-num">{stats.wins}</div><div className="hist-stat-lbl">Wins</div></div>
          </div>

          <div className="more-group-title">By Time Mode</div>
          <div className="detail-card">
            <div className="detail-row"><span><i className="fa-solid fa-rocket" style={{ marginRight: 8, color: 'var(--accent)' }}></i>Bullet</span><span className="detail-row-val">{stats.by_mode.bullet} games</span></div>
            <div className="detail-row"><span><i className="fa-solid fa-bullseye" style={{ marginRight: 8, color: 'var(--accent)' }}></i>Normal</span><span className="detail-row-val">{stats.by_mode.normal} games</span></div>
            <div className="detail-row"><span><i className="fa-regular fa-clock" style={{ marginRight: 8, color: 'var(--accent)' }}></i>Long</span><span className="detail-row-val">{stats.by_mode.long} games</span></div>
            <div className="detail-row"><span><i className="fa-solid fa-robot" style={{ marginRight: 8, color: 'var(--accent)' }}></i>AI</span><span className="detail-row-val">{stats.by_mode.ai} games</span></div>
          </div>

          <div className="more-group-title">Ratings</div>
          <div className="detail-card">
            <div className="detail-row"><span><i className="fa-solid fa-rocket" style={{ marginRight: 8, color: 'var(--accent)' }}></i>Bullet</span><span className="detail-row-val">{stats.ratings.bullet}</span></div>
            <div className="detail-row"><span><i className="fa-solid fa-bullseye" style={{ marginRight: 8, color: 'var(--accent)' }}></i>Normal</span><span className="detail-row-val">{stats.ratings.normal}</span></div>
            <div className="detail-row"><span><i className="fa-regular fa-clock" style={{ marginRight: 8, color: 'var(--accent)' }}></i>Long</span><span className="detail-row-val">{stats.ratings.long}</span></div>
          </div>
        </>
      )}
    </div>
  );
}
