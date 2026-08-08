import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';
import { useTheme } from '../hooks/useTheme';
import { BACKEND } from '../hooks/useGame';
import { rippleFx } from '../hooks/useRipple';

export default function MorePage() {
  const navigate = useNavigate();
  const { user } = useTelegram();
  const { theme, toggleTheme } = useTheme();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!user) return;
    fetch(`${BACKEND}/api/users/${user.id}`).then(r => r.json()).then(setProfile).catch(() => {});
  }, [user]);

  return (
    <div className="page active" id="page-more">

      <div className="topbar">
        <div className="topbar-title-wrap">
          <div>
            <div className="topbar-title">More</div>
            <div className="topbar-subtitle">Settings &amp; account</div>
          </div>
        </div>
      </div>

      {/* Profile summary card */}
      <div className="more-profile-card ripple" onClick={(e) => { rippleFx(e); navigate('/more/profile'); }}>
        <div className="more-profile-fallback">{(profile?.nickname || user?.name || '?').charAt(0).toUpperCase()}</div>
        <div>
          <div className="more-profile-name">{profile?.nickname || user?.name || '—'} <i className="fa-solid fa-circle-check verified-badge"></i></div>
          <div className="more-profile-sub">{profile?.rating_bullet ?? 1200} Rating</div>
        </div>
        <i className="fa-solid fa-chevron-right more-profile-arrow"></i>
      </div>

      <div className="more-group-title">Account</div>
      <div className="more-list stagger">
        <div className="more-item ripple" onClick={(e) => { rippleFx(e); navigate('/more/profile'); }}>
          <div className="more-icon i1"><i className="fa-solid fa-user"></i></div>
          <div className="more-label">Profile</div>
          <i className="fa-solid fa-chevron-right"></i>
        </div>
        <div className="more-item ripple" onClick={(e) => { rippleFx(e); navigate('/more/stats'); }}>
          <div className="more-icon i2"><i className="fa-solid fa-chart-simple"></i></div>
          <div className="more-label">Statistics</div>
          <i className="fa-solid fa-chevron-right"></i>
        </div>
        <div className="more-item ripple" onClick={(e) => { rippleFx(e); navigate('/more/theme'); }}>
          <div className="more-icon i4"><i className="fa-solid fa-palette"></i></div>
          <div className="more-label">Board Theme</div>
          <i className="fa-solid fa-chevron-right"></i>
        </div>
        <div
          className="more-item ripple"
          onClick={(e) => { rippleFx(e); toggleTheme(); }}
          role="switch"
          aria-checked={theme === 'light'}
        >
          <div className="more-icon i4"><i className={`fa-solid ${theme === 'light' ? 'fa-sun' : 'fa-moon'}`}></i></div>
          <div className="more-label">Appearance</div>
          <div className="more-item-sub" style={{ marginRight: 8 }}>{theme === 'light' ? 'Light' : 'Dark'}</div>
          <span
            style={{
              width: 42, height: 24, borderRadius: 999,
              background: theme === 'light' ? 'var(--accent)' : 'var(--glass-strong)',
              position: 'relative', flexShrink: 0, transition: 'background 0.2s var(--ease)'
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: theme === 'light' ? 21 : 3,
              width: 18, height: 18, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s var(--ease-spring)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
            }} />
          </span>
        </div>
        <div className="more-item ripple" onClick={(e) => { rippleFx(e); navigate('/more/friends'); }}>
          <div className="more-icon i3"><i className="fa-solid fa-user-group"></i></div>
          <div className="more-label">Friends</div>
          <i className="fa-solid fa-chevron-right"></i>
        </div>
      </div>

      <div className="more-group-title">Support</div>
      <div className="more-list stagger">
        <div className="more-item ripple" onClick={rippleFx}>
          <div className="more-icon i9"><i className="fa-solid fa-circle-question"></i></div>
          <div className="more-label">Help</div>
          <i className="fa-solid fa-chevron-right"></i>
        </div>
        <div className="more-item ripple" onClick={rippleFx}>
          <div className="more-icon i10"><i className="fa-solid fa-circle-info"></i></div>
          <div className="more-label">About</div>
          <i className="fa-solid fa-chevron-right"></i>
        </div>
      </div>

      <div className="app-version">Shaxmat Bot v1.0</div>

    </div>
  );
}
