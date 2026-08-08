import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';
import { BACKEND } from '../hooks/useGame';
import { rippleFx } from '../hooks/useRipple';
import { getRatingCategory, getRatingEmoji } from '../utils/ratingDisplay';
import { stickerUrl } from '../data/stickers';
import DetailTopbar from '../components/DetailTopbar';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useTelegram();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch(`${BACKEND}/api/users/${user.id}`)
      .then(r => r.json())
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="center-loader"><div className="spinner" /></div>;

  const winRate = profile?.total_games ? Math.round((profile.wins / profile.total_games) * 100) : 0;

  return (
    <div className="page active">
      <DetailTopbar icon="fa-solid fa-user" title="Profile" subtitle="Your account details" />

      <div className="profile-hero-card">
        <div style={{ position: 'relative', width: '76px', height: '76px', margin: '0 auto 14px auto' }}>
          <div className="profile-hero-avatar" style={{ margin: 0 }}>
            {(profile?.nickname || user?.name || '?').charAt(0).toUpperCase()}
          </div>
          {profile?.profile_sticker && (
            <div style={{
              position: 'absolute', bottom: '-4px', right: '-4px',
              width: '30px', height: '30px', borderRadius: '50%',
              background: 'var(--bg-elevated)', border: '2px solid var(--bg-elevated)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
            }}>
              <img src={stickerUrl(profile.profile_sticker)} alt="Profile sticker" style={{ width: '20px', height: '20px' }} />
            </div>
          )}
        </div>
        <div className="profile-hero-name">{profile?.nickname || '—'} <i className="fa-solid fa-circle-check verified-badge"></i></div>
        <div className="profile-hero-sub">{profile?.total_games || 0} games · {winRate}% win rate</div>
      </div>

      <div className="more-group-title">Profile Sticker</div>
      <div
        className="more-item ripple"
        onClick={(e) => { rippleFx(e); navigate('/more/profile/sticker'); }}
        style={{ marginBottom: '20px', cursor: 'pointer' }}
      >
        <div className="more-icon i4" style={{ overflow: 'hidden' }}>
          {profile?.profile_sticker ? (
            <img src={stickerUrl(profile.profile_sticker)} alt="" style={{ width: '22px', height: '22px' }} />
          ) : (
            <i className="fa-solid fa-icons"></i>
          )}
        </div>
        <div className="more-label">{profile?.profile_sticker ? 'Change Sticker' : 'Choose a Sticker'}</div>
        <i className="fa-solid fa-chevron-right"></i>
      </div>

      <div className="more-group-title">Ratings</div>
      <div className="detail-card">
        {[
          ['rating_bullet', 'fa-solid fa-bolt', 'Bullet'],
          ['rating_normal', 'fa-solid fa-bullseye', 'Normal'],
          ['rating_long', 'fa-regular fa-clock', 'Long']
        ].map(([key, icon, label]) => (
          <div className="detail-row" key={key}>
            <span><i className={icon} style={{ marginRight: 8, color: 'var(--accent)' }}></i>{label}</span>
            <span className="detail-row-val">
              {getRatingEmoji(profile?.[key])} {profile?.[key]} <i className="rating-cat">{getRatingCategory(profile?.[key])}</i>
            </span>
          </div>
        ))}
      </div>

      <div className="more-group-title">Results</div>
      <div className="hist-stats-row" style={{ marginBottom: 0 }}>
        <div className="hist-stat"><div className="hist-stat-icon" style={{ color: 'var(--accent)' }}><i className="fa-solid fa-trophy"></i></div><div className="hist-stat-num">{profile?.wins || 0}</div><div className="hist-stat-lbl">Wins</div></div>
        <div className="hist-stat"><div className="hist-stat-icon" style={{ color: 'var(--red)' }}><i className="fa-solid fa-face-frown"></i></div><div className="hist-stat-num">{profile?.losses || 0}</div><div className="hist-stat-lbl">Losses</div></div>
        <div className="hist-stat"><div className="hist-stat-icon" style={{ color: 'var(--yellow)' }}><i className="fa-solid fa-equals"></i></div><div className="hist-stat-num">{profile?.draws || 0}</div><div className="hist-stat-lbl">Draws</div></div>
      </div>
    </div>
  );
}
