import { useState, useEffect, useCallback, useRef } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import { BACKEND } from '../hooks/useGame';
import { useChallenge } from '../hooks/useChallenge';
import { rippleFx } from '../hooks/useRipple';
import DetailTopbar from '../components/DetailTopbar';

const TIME_OPTIONS = [
  { id: 'bullet_1', label: 'Bullet · 1 min' },
  { id: 'bullet_3', label: 'Bullet · 3 min' },
  { id: 'normal_5', label: 'Blitz · 5 min' },
  { id: 'normal_10', label: 'Rapid · 10 min' },
  { id: 'normal_20', label: 'Rapid · 20 min' },
];

function StatusDot({ status }) {
  const color = status === 'online' ? 'var(--accent)' : status === 'in_game' ? 'var(--yellow)' : 'var(--text-tertiary)';
  return (
    <span style={{
      display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
      background: color, marginRight: '6px', flexShrink: 0
    }} />
  );
}

function statusLabel(status) {
  if (status === 'online') return 'Online';
  if (status === 'in_game') return 'In Game';
  return 'Offline';
}

function ChallengeSheet({ friend, onClose, onSend }) {
  const [timeMode, setTimeMode] = useState('normal_10');

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet-modal" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle"></div>
        <div className="sheet-title">Challenge {friend.nickname}</div>

        <div className="more-group-title">Game Mode</div>
        <div className="chip-row" style={{ flexWrap: 'wrap' }}>
          {TIME_OPTIONS.map(opt => (
            <button
              key={opt.id}
              className={`chip ripple${timeMode === opt.id ? ' on' : ''}`}
              onClick={(e) => { rippleFx(e); setTimeMode(opt.id); }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="sheet-controls">
          <button className="btn-secondary ripple" onClick={(e) => { rippleFx(e); onClose(); }}>
            Cancel
          </button>
          <button className="btn-continue ripple" onClick={(e) => { rippleFx(e); onSend(timeMode); }}>
            ⚔️ Send Challenge
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FriendsPage() {
  const { user } = useTelegram();
  const { friendStatuses, requestFriendsStatus, sendChallenge, outgoingChallenge } = useChallenge();

  const [friends, setFriends] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [pending, setPending] = useState(new Set());
  const [challengeTarget, setChallengeTarget] = useState(null);
  const debounceRef = useRef(null);

  const loadFriends = useCallback(async () => {
    if (!user) return;
    const r = await fetch(`${BACKEND}/api/users/${user.id}/friends`);
    const data = await r.json();
    setFriends(data);
    if (data.length > 0) {
      requestFriendsStatus(data.map(f => f.telegram_id));
    }
  }, [user, requestFriendsStatus]);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  useEffect(() => {
    if (friends.length === 0) return;
    const t = setInterval(() => requestFriendsStatus(friends.map(f => f.telegram_id)), 15000);
    return () => clearInterval(t);
  }, [friends, requestFriendsStatus]);

  useEffect(() => {
    if (!user || query.trim().length < 2) { setResults([]); return; }

    setSearching(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`${BACKEND}/api/users/search?q=${encodeURIComponent(query)}&userId=${user.id}`);
        setResults(await r.json());
      } catch { setResults([]); }
      setSearching(false);
    }, 350);

    return () => clearTimeout(debounceRef.current);
  }, [query, user]);

  const friendIds = new Set(friends.map(f => String(f.telegram_id)));

  async function addFriend(friendId) {
    setPending(p => new Set(p).add(friendId));
    try {
      await fetch(`${BACKEND}/api/users/${user.id}/friends`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId })
      });
      await loadFriends();
    } finally {
      setPending(p => { const n = new Set(p); n.delete(friendId); return n; });
    }
  }

  async function removeFriend(friendId) {
    setPending(p => new Set(p).add(friendId));
    try {
      await fetch(`${BACKEND}/api/users/${user.id}/friends/${friendId}`, { method: 'DELETE' });
      await loadFriends();
    } finally {
      setPending(p => { const n = new Set(p); n.delete(friendId); return n; });
    }
  }

  function handleSendChallenge(timeMode) {
    if (!challengeTarget) return;
    sendChallenge(challengeTarget.telegram_id, timeMode);
    setChallengeTarget(null);
  }

  return (
    <div className="page active">
      <DetailTopbar icon="fa-solid fa-user-group" title="Friends" subtitle="Search by nickname" />

      <input
        className="search-input"
        type="text"
        placeholder="Type a nickname…"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      {query.trim().length >= 2 && (
        <>
          <div className="more-group-title">Results</div>
          <div className="detail-card">
            {searching && <p className="empty-hint">Searching…</p>}
            {!searching && results.length === 0 && <p className="empty-hint">No one found</p>}
            {results.map(r => {
              const isFriend = friendIds.has(String(r.telegram_id));
              const busy = pending.has(String(r.telegram_id));
              return (
                <div className="detail-row" key={r.telegram_id}>
                  <span>{r.nickname} <span className="rating-cat">{r.rating_bullet}</span></span>
                  <button
                    className={`chip ripple${isFriend ? ' on' : ''}`}
                    disabled={busy}
                    onClick={(e) => { rippleFx(e); isFriend ? removeFriend(r.telegram_id) : addFriend(r.telegram_id); }}
                  >
                    {busy ? '…' : isFriend ? 'Added' : '+ Add'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="more-group-title">My Friends ({friends.length})</div>
      {friends.length === 0 ? (
        <div className="empty-state-mini"><p>Hali do'stlaringiz yo'q.</p></div>
      ) : (
        <div className="detail-card">
          {friends.map(f => {
            const status = friendStatuses[String(f.telegram_id)] || 'offline';
            const canPlay = status === 'online';
            const isSelf = String(f.telegram_id) === String(user?.id);
            const hasOutgoing = outgoingChallenge?.toId === String(f.telegram_id);

            return (
              <div className="detail-row" key={f.telegram_id} style={{ alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                  <StatusDot status={status} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                    {f.nickname}
                  </span>
                  <span className="rating-cat" style={{ marginLeft: '6px', flexShrink: 0 }}>{f.rating_bullet}</span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{statusLabel(status)}</span>
                  {!isSelf && (
                    <button
                      className="chip ripple"
                      disabled={!canPlay || hasOutgoing}
                      onClick={(e) => { rippleFx(e); setChallengeTarget(f); }}
                      style={{
                        opacity: canPlay && !hasOutgoing ? 1 : 0.5,
                        cursor: canPlay && !hasOutgoing ? 'pointer' : 'not-allowed',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {hasOutgoing ? '…' : '▶ Play'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {challengeTarget && (
        <ChallengeSheet
          friend={challengeTarget}
          onClose={() => setChallengeTarget(null)}
          onSend={handleSendChallenge}
        />
      )}
    </div>
  );
}
