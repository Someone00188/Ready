import { useState, useEffect } from 'react';
import { rippleFx } from '../hooks/useRipple';
import DetailTopbar from '../components/DetailTopbar';

const THEMES = [
  { id: 'green', name: 'Green (default)', light: '#eeeed2', dark: '#769656' },
  { id: 'classic', name: 'Classic', light: '#f0d9b5', dark: '#b58863' },
  { id: 'mono', name: 'Mono', light: '#d8d8d8', dark: '#565352' }
];

export default function ThemePage() {
  const [theme, setTheme] = useState(() => localStorage.getItem('boardTheme') || 'green');

  useEffect(() => {
    document.documentElement.dataset.board = theme;
    localStorage.setItem('boardTheme', theme);
  }, [theme]);

  return (
    <div className="page active">
      <DetailTopbar icon="fa-solid fa-palette" title="Themes" subtitle="Choose your board style" />

      <div className="more-list stagger">
        {THEMES.map(t => (
          <div
            key={t.id}
            className={`more-item theme-item ripple${theme === t.id ? ' active' : ''}`}
            onClick={(e) => { rippleFx(e); setTheme(t.id); }}
          >
            <div className="theme-preview">
              <i style={{ background: t.light }} /><i style={{ background: t.dark }} />
              <i style={{ background: t.dark }} /><i style={{ background: t.light }} />
            </div>
            <div className="more-label">{t.name}</div>
            {theme === t.id && <i className="fa-solid fa-circle-check verified-badge"></i>}
          </div>
        ))}
      </div>
    </div>
  );
}
