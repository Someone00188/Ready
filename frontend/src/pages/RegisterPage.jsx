import { useState, useEffect, useRef } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import { BACKEND } from '../hooks/useGame';
import { rippleFx } from '../hooks/useRipple';

const LEVELS = [
  { value: 'beginner', label: 'Beginner', approx: '~400', desc: "Just learning the rules", icon: 'fa-solid fa-seedling' },
  { value: 'casual', label: 'Casual', approx: '~700', desc: 'I play sometimes for fun', icon: 'fa-solid fa-chess-pawn' },
  { value: 'intermediate', label: 'Intermediate', approx: '~1000', desc: 'I know the rules well', icon: 'fa-solid fa-chess-knight' },
  { value: 'advanced', label: 'Advanced', approx: '~1300', desc: 'I have real experience', icon: 'fa-solid fa-chess-bishop' },
  { value: 'expert', label: 'Expert', approx: '~1600', desc: 'I play at a high level', icon: 'fa-solid fa-crown' }
];

export default function RegisterPage({ onDone }) {
  const { user, ready } = useTelegram();

  const [nickname, setNickname] = useState('');
  const [level, setLevel] = useState('intermediate');
  const [status, setStatus] = useState(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const debounceRef = useRef(null);

  useEffect(() => {
    if (!ready || !user) return;

    const trimmed = nickname.trim();
    if (!trimmed) { setStatus(null); return; }

    setStatus('checking');
    clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${BACKEND}/api/users/check-nickname?nickname=${encodeURIComponent(trimmed)}&exclude=${user.id}`
        );
        const data = await res.json();
        setStatus(data.available ? 'ok' : (data.reason?.includes('band') ? 'taken' : 'invalid'));
        setReason(data.reason || '');
      } catch {
        setStatus(null);
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [nickname, ready, user]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (status !== 'ok' || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`${BACKEND}/api/users/complete-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          username: user.username,
          nickname: nickname.trim(),
          estimate: level
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'NICKNAME_TAKEN') { setStatus('taken'); setReason(data.error); }
        else setSubmitError(data.error || 'Registration failed');
        return;
      }

      onDone(data);
    } catch {
      setSubmitError('Could not reach the server');
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return <div className="app"><div className="center-loader"><div className="spinner" /></div></div>;
  }

  const canSubmit = status === 'ok' && !submitting;

  return (
    <div className="app">
      <div className="page active">
        <div className="topbar">
          <div className="topbar-title-wrap">
            <div className="topbar-icon"><i className="fa-solid fa-chess-king"></i></div>
            <div>
              <div className="topbar-title">Welcome</div>
              <div className="topbar-subtitle">Set up your ChessMate profile</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="more-group-title">Nickname</div>
          <input
            className={`nick-input${status === 'taken' || status === 'invalid' ? ' input-error' : ''}${status === 'ok' ? ' input-success' : ''}`}
            type="text"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder="Choose a unique nickname (can only be changed once)"
            maxLength={20}
            autoFocus
            autoComplete="off"
            spellCheck="false"
          />
          {status && nickname.trim() && (
            <div className={`nick-status ${status === 'ok' ? 'good' : status === 'checking' ? 'neutral' : 'bad'}`}>
              {status === 'checking' && <><i className="fa-solid fa-circle-notch fa-spin"></i> Checking availability…</>}
              {status === 'ok' && <><i className="fa-solid fa-circle-check"></i> Nickname is available</>}
              {status === 'taken' && <><i className="fa-solid fa-circle-xmark"></i> {reason || 'This nickname is already taken'}</>}
              {status === 'invalid' && <><i className="fa-solid fa-circle-exclamation"></i> {reason}</>}
            </div>
          )}

          <div className="more-group-title">Estimate Your Chess Strength</div>
          <div className="form-hint" style={{ marginBottom: 10, color: 'var(--text-tertiary)', fontSize: 12 }}>
            Just a starting point — you'll play 5 placement games and we'll find your real rating.
          </div>
          <div className="more-list stagger">
            {LEVELS.map(l => (
              <button
                type="button"
                key={l.value}
                className={`more-item level-item ripple${level === l.value ? ' active' : ''}`}
                onClick={(e) => { rippleFx(e); setLevel(l.value); }}
              >
                <div className="more-icon i1"><i className={l.icon}></i></div>
                <div className="level-item-text">
                  <div className="more-label">{l.label}</div>
                  <div className="more-item-sub">{l.desc}</div>
                </div>
                <span className="detail-row-val">{l.approx}</span>
              </button>
            ))}
          </div>

          {submitError && (
            <div className="form-error">
              <i className="fa-solid fa-triangle-exclamation"></i> {submitError}
            </div>
          )}

          <button className="btn-continue ripple" type="submit" disabled={!canSubmit} onClick={rippleFx}>
            {submitting ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Creating your profile…</> : 'Get Started'}
          </button>
        </form>
      </div>
    </div>
  );
}
