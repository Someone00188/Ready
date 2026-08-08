import { useNavigate } from 'react-router-dom';

const TABS = [
  { id: 'home', path: '/', icon: 'fa-solid fa-house', label: 'HOME' },
  { id: 'history', path: '/history', icon: 'fa-regular fa-clock', label: 'HISTORY' },
  { id: 'more', path: '/more', icon: 'fa-solid fa-ellipsis', label: 'MORE' }
];

export default function BottomNav({ active }) {
  const navigate = useNavigate();

  return (
    <div className="bottom-nav">
      {TABS.map(t => (
        <div
          key={t.id}
          className={`nav-item${active === t.path ? ' active' : ''}`}
          onClick={() => navigate(t.path)}
        >
          <i className={t.icon}></i>
          <span>{t.label}</span>
        </div>
      ))}
    </div>
  );
}
