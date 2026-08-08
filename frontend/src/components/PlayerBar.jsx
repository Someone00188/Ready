function formatClock(ms) {
  if (ms == null) return null;
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (total < 20 && ms > 0) return `${m}:${String(s).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PlayerBar({ name, color, time, isTurn, hasClock, meta }) {
  const label = formatClock(time);
  const low = time != null && time < 30_000;

  const clockClass = ['g-clock'];
  if (!hasClock) clockClass.push('flat');
  else if (low && isTurn) clockClass.push('low');
  else if (isTurn) clockClass.push('running');

  return (
    <div className={`g-player-bar${isTurn ? ' active' : ''}`}>
      <div className="g-player-info">
        <div className={`g-avatar ${color}`}>{(name || '?').charAt(0).toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          <div className="g-player-name">{name}</div>
          {meta && <div className="g-player-meta">{meta}</div>}
        </div>
      </div>

      <div className={clockClass.join(' ')}>
        {hasClock ? label : '∞'}
      </div>
    </div>
  );
}
