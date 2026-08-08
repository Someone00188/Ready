import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { useGame, BACKEND } from '../hooks/useGame';
import { useTelegram } from '../hooks/useTelegram';
import { useSound } from '../hooks/useSound';
import { rippleFx } from '../hooks/useRipple';
import ChessBoard from '../components/ChessBoard';
import GameOverModal from '../components/GameOverModal';
import { PIECE_SVGS as CBURNETT_PIECES, PIECE_VIEWBOX as CBURNETT_VIEWBOX } from '../pieces/cburnettPieces';

const AI_LABELS = { 1: 'New', 2: 'Easy', 3: 'Medium', 4: 'Expert', 5: 'Master' };

function formatClock(ms) {
  if (ms == null) return '∞';
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (total < 20 && ms > 0) return `${m}:${String(s).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getCapturedPieces(history) {
  const captured = { white: [], black: [] };
  for (const move of history) {
    if (move.captured) {
      if (move.color === 'w') captured.black.push(move.captured);
      else captured.white.push(move.captured);
    }
  }
  return captured;
}

/**
 * Boshlang'ich pozitsiyadan boshlab har bir yurish (SAN) qayta o'ynatiladi va
 * har bir qadamdan keyingi FEN saqlanadi. Bu backend/socket'ga hech qanday
 * qo'shimcha so'rov yubormasdan — faqat mavjud `state.history`dan (SAN
 * ro'yxati) foydalanib — tarixdagi istalgan pozitsiyani ko'rsatish imkonini
 * beradi. Live o'yin holati bunga umuman ta'sir qilmaydi.
 * Qaytaradi: [{ fen, san, from, to, color }] — index 0 birinchi yurishdan keyingi holat.
 */
function buildPositionHistory(sanHistory) {
  const replay = new Chess();
  const positions = [];
  for (const m of sanHistory) {
    try {
      const result = replay.move(m.san);
      if (!result) break; // Nomuvofiq SAN bo'lsa, xavfsiz to'xtaymiz
      positions.push({
        fen: replay.fen(),
        san: m.san,
        from: result.from,
        to: result.to,
        color: m.color,
        inCheck: replay.inCheck()
      });
    } catch {
      break;
    }
  }
  return positions;
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function CapturedPieces({ pieces }) {
  return (
    <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', alignItems: 'center' }}>
      {pieces.map((p, i) => (
        <svg key={i} viewBox={CBURNETT_VIEWBOX} style={{ width: '16px', height: '16px' }}>
          {CBURNETT_PIECES[`w${p.toUpperCase()}`]}
        </svg>
      ))}
    </div>
  );
}

function PlayerBar({ name, rating, color, time, isTurn, hasClock, capturedPieces, isAI, difficulty }) {
  const label = formatClock(time);
  const low = time != null && time < 30_000;
  const isWhite = color === 'w';

  return (
    <div style={{
      background: 'var(--card)',
      border: `2px solid ${isTurn ? 'var(--accent)' : 'var(--card-border)'}`,
      borderRadius: '12px',
      padding: '12px',
      marginBottom: '8px',
      transition: 'all 0.2s'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: isWhite ? '#f5f5f5' : '#2a2a2a',
            border: '2px solid var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 700, color: isWhite ? '#000' : '#fff'
          }}>
            {name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {name}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', gap: '8px' }}>
              <span>⭐ {rating || 1200}</span>
              {isAI && <span>🤖 {AI_LABELS[difficulty] || difficulty}</span>}
            </div>
          </div>
        </div>
        <div style={{
          fontSize: '18px', fontWeight: 800, fontVariantNumeric: 'tabular-nums',
          background: low && isTurn ? 'var(--red-soft)' : isTurn ? 'var(--accent-soft)' : 'var(--glass)',
          color: low && isTurn ? 'var(--red)' : isTurn ? 'var(--accent)' : 'var(--text-secondary)',
          padding: '6px 12px', borderRadius: '8px', whiteSpace: 'nowrap'
        }}>
          {label}
        </div>
      </div>
      {capturedPieces && capturedPieces.length > 0 && (
        <CapturedPieces pieces={capturedPieces} />
      )}
    </div>
  );
}

/**
 * Move ro'yxati paneli — har bir yurish bosiladigan (clickable).
 * Bosilganda `onSelectIndex` chaqiriladi va tashqi komponent taxta
 * pozitsiyasini o'sha yurishdan keyingi holatga o'zgartiradi.
 * `viewIndex === null` — live pozitsiyada turibmiz (hech narsa tanlanmagan).
 */
function MoveHistoryPanel({ history, viewIndex, onSelectIndex, isLive }) {
  const listRef = useRef(null);
  const activeRef = useRef(null);

  // Tanlangan yurish ko'rinadigan qilib avtomatik scroll qilamiz
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }, [viewIndex]);

  if (history.length === 0) {
    return (
      <div style={{
        width: '100%', padding: '16px', textAlign: 'center', fontSize: '12px',
        color: 'var(--text-tertiary)', background: 'var(--card)', borderRadius: '12px'
      }}>
        No moves yet
      </div>
    );
  }

  // Yurishlarni juftlik (oq, qora) qilib guruhlaymiz — an'anaviy PGN ko'rinishi uchun
  const pairs = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({ num: i / 2 + 1, white: { move: history[i], idx: i }, black: history[i + 1] ? { move: history[i + 1], idx: i + 1 } : null });
  }

  return (
    <div
      ref={listRef}
      style={{
        width: '100%', display: 'flex', overflowX: 'auto', gap: '4px',
        padding: '10px 12px', background: 'var(--card)', borderRadius: '12px',
        border: '1px solid var(--card-border)', WebkitOverflowScrolling: 'touch'
      }}
    >
      {pairs.map(({ num, white, black }) => (
        <div key={num} style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 700, minWidth: '18px' }}>
            {num}.
          </span>
          <button
            ref={viewIndex === white.idx ? activeRef : null}
            onClick={() => onSelectIndex(white.idx)}
            style={{
              padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
              whiteSpace: 'nowrap', cursor: 'pointer', border: 'none',
              background: viewIndex === white.idx ? 'var(--accent-soft)' : 'transparent',
              color: viewIndex === white.idx ? 'var(--accent)' : 'var(--text-primary)'
            }}
          >
            {white.move.san}
          </button>
          {black && (
            <button
              ref={viewIndex === black.idx ? activeRef : null}
              onClick={() => onSelectIndex(black.idx)}
              style={{
                padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                whiteSpace: 'nowrap', cursor: 'pointer', border: 'none',
                background: viewIndex === black.idx ? 'var(--accent-soft)' : 'transparent',
                color: viewIndex === black.idx ? 'var(--accent)' : 'var(--text-primary)'
              }}
            >
              {black.move.san}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default function GamePage() {
  const { gameId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const spectate = params.get('spectate') === '1';

  const { user, ready, haptic, notify } = useTelegram();
  const [myNickname, setMyNickname] = useState(null);
  const [showGameOverModal, setShowGameOverModal] = useState(true);
  const [confirmResign, setConfirmResign] = useState(false);
  // viewIndex === null  → live pozitsiyani ko'rsatyapmiz (normal o'yin)
  // viewIndex === N     → N-yurishdan keyingi tarixiy pozitsiyani ko'ryapmiz (faqat ko'rish uchun)
  const [viewIndex, setViewIndex] = useState(null);

  const {
    state, role, connected, error, gameOver, drawOffer, aiThinking, clock,
    move, resign, offerDraw, acceptDraw, declineDraw
  } = useGame(gameId, ready ? user : null, spectate, myNickname);

  const soundEnabled = localStorage.getItem('soundEnabled') !== '0';
  const { playMoveSound, playGameEndSound } = useSound(soundEnabled);

  useEffect(() => {
    if (!user) return;
    fetch(`${BACKEND}/api/users/${user.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(p => setMyNickname(p?.nickname || null))
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    const theme = localStorage.getItem('boardTheme') || 'green';
    document.documentElement.dataset.board = theme;
  }, []);

  useEffect(() => {
    if (!gameOver) return;
    notify(gameOver.result === '1/2-1/2' ? 'warning' : 'success');

    // Natijaga qarab ovoz: g'alaba / mag'lubiyat / durrang
    const myColor = role === 'white' ? 'white' : role === 'black' ? 'black' : null;
    const resultSide = gameOver.result === '1-0' ? 'white'
      : gameOver.result === '0-1' ? 'black'
      : 'draw';
    playGameEndSound(resultSide, myColor);
  }, [gameOver]);

  // MUHIM: useMemo har doim, shart-shartsiz, har bir render'da chaqirilishi kerak —
  // shuning uchun bu quyidagi "loading" early return'dan OLDIN turishi shart.
  // state hali kelmagan bo'lsa ham hook chaqiriladi (bo'sh natija bilan).
  const capturedPieces = useMemo(
    () => (state ? getCapturedPieces(state.history) : { white: [], black: [] }),
    [state]
  );

  // Har bir yurishdan keyingi FEN'ni boshlang'ich pozitsiyadan qayta o'ynatib hisoblaymiz.
  // Bu faqat ko'rsatish (display) uchun — live o'yin holatiga hech qanday ta'siri yo'q.
  const positionHistory = useMemo(
    () => (state ? buildPositionHistory(state.history) : []),
    [state?.history]
  );

  const moveCount = state?.history?.length ?? 0;

  // Yangi yurish kelganda mos ovoz chalinadi: capture > check > checkmate > oddiy move.
  // gameOver bo'lsa checkmate ovozi allaqachon playGameEndSound orqali chiqadi,
  // shuning uchun bu yerda faqat "checkmate emas" holatlarni farqlaymiz.
  const prevMoveCountForSoundRef = useRef(moveCount);
  useEffect(() => {
    if (moveCount > prevMoveCountForSoundRef.current) {
      const lastMove = state?.history?.[moveCount - 1];
      const isCapture = !!lastMove?.captured;
      const isCheckmate = !!state?.isCheckmate;
      const inCheck = !!state?.inCheck;
      playMoveSound({ isCapture, inCheck, isCheckmate });
    }
    prevMoveCountForSoundRef.current = moveCount;
  }, [moveCount]);

  // Yangi yurish kelganda (moveCount o'sganda) — agar foydalanuvchi allaqachon
  // eng oxirgi yurishni ko'rayotgan bo'lsa, avtomatik live'ga qaytamiz.
  // Agar u ataylab orqaroq pozitsiyani ko'rib turgan bo'lsa — u yerda qoladi
  // (live o'yin fonda davom etadi, lekin uning ko'rinishi buzilmaydi).
  const prevMoveCountRef = useRef(moveCount);
  useEffect(() => {
    if (moveCount !== prevMoveCountRef.current) {
      const wasAtLive = viewIndex === null || viewIndex >= prevMoveCountRef.current - 1;
      prevMoveCountRef.current = moveCount;
      if (wasAtLive) setViewIndex(null);
    }
  }, [moveCount]);

  const isLive = viewIndex === null;

  // Ko'rsatiladigan pozitsiya: live bo'lsa haqiqiy state.fen, aks holda tarixdagi FEN
  const displayFen = isLive || !state
    ? state?.fen
    : (viewIndex < 0 ? START_FEN : positionHistory[viewIndex]?.fen ?? state.fen);

  const displayLastMove = isLive || !state
    ? state?.lastMove
    : (viewIndex < 0 ? null : positionHistory[viewIndex] ? { from: positionHistory[viewIndex].from, to: positionHistory[viewIndex].to } : null);

  const displayInCheck = isLive || !state
    ? state?.inCheck
    : (viewIndex < 0 ? false : positionHistory[viewIndex]?.inCheck ?? false);

  const displayTurn = isLive || !state
    ? state?.turn
    : (viewIndex % 2 === 0 ? 'b' : 'w'); // viewIndex-yurishdan keyin navbat almashadi

  const goToIndex = useCallback((idx) => {
    const clamped = Math.max(-1, Math.min(moveCount - 1, idx));
    if (clamped >= moveCount - 1) {
      setViewIndex(null); // Eng oxirgi yurish = live holat
    } else {
      setViewIndex(clamped);
    }
    haptic?.('light');
  }, [moveCount, haptic]);

  const goLive = useCallback(() => { setViewIndex(null); haptic?.('light'); }, [haptic]);
  const goPrev = useCallback(() => {
    const current = viewIndex === null ? moveCount - 1 : viewIndex;
    goToIndex(current - 1);
  }, [viewIndex, moveCount, goToIndex]);
  const goNext = useCallback(() => {
    const current = viewIndex === null ? moveCount - 1 : viewIndex;
    goToIndex(current + 1);
  }, [viewIndex, moveCount, goToIndex]);
  const goFirst = useCallback(() => goToIndex(-1), [goToIndex]);
  const goLast = useCallback(() => goToIndex(moveCount - 1), [moveCount, goToIndex]);

  // Klaviatura bilan navigatsiya (desktop test uchun ham foydali)
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext]);

  // Swipe gesture — taxta ustida chapga/o'ngga suring
  const touchStartX = useRef(null);
  function onBoardTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onBoardTouchEnd(e) {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return; // juda kichik harakat — e'tiborsiz qoldiramiz
    if (dx > 0) goPrev(); else goNext();
  }

  if (!ready || !state) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '24px', color: 'var(--accent)', marginBottom: '16px' }}>⏳</div>
        <div style={{ color: 'var(--text-secondary)' }}>{connected ? 'Loading game…' : 'Connecting to server…'}</div>
      </div>
    );
  }

  const myColor = role === 'white' ? 'w' : role === 'black' ? 'b' : null;
  const orientation = myColor || 'w';
  const isMyTurn = myColor && state.turn === myColor && state.status === 'active';
  // Tarixiy pozitsiyani ko'rayotganda yurish taqiqlanadi — faqat live holatda yurish mumkin
  const canMove = !!isMyTurn && !aiThinking && isLive;

  const bottom = orientation === 'w' ? 'w' : 'b';
  const top = bottom === 'w' ? 'b' : 'w';

  let status = null, statusClass = '';
  if (error) { status = error; statusClass = 'danger'; }
  else if (!connected) { status = 'Connection lost — reconnecting'; statusClass = 'danger'; }
  else if (!isLive) { status = `Viewing move ${viewIndex + 1} of ${moveCount}`; statusClass = 'history'; }
  else if (state.status === 'waiting') { status = 'Waiting for opponent…'; statusClass = 'alert'; }
  else if (aiThinking) { status = 'AI is thinking…'; }
  else if (state.status === 'finished') { status = 'Game over'; }
  else if (state.inCheck) { status = state.turn === myColor ? 'You are in check!' : 'Check'; statusClass = 'alert'; }
  else if (role === 'spectator') { status = 'Spectating'; }
  else if (isMyTurn) { status = 'Your move'; }
  else { status = "Opponent's move"; }

  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '16px', paddingBottom: '100px', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '8px' }}>
          ◀
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '16px', fontWeight: 800 }}>Game</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {state.hasClock ? 'Timed match' : 'No time limit'}
          </div>
        </div>
      </div>

      <PlayerBar
        name={state.history[0] && top === 'b' ? state.blackName : state.whiteName}
        rating={top === 'w' ? state.whiteRating : state.blackRating}
        color={top}
        time={top === 'w' ? clock.whiteTime : clock.blackTime}
        isTurn={state.turn === top && state.status === 'active'}
        hasClock={state.hasClock}
        capturedPieces={top === 'w' ? capturedPieces.black : capturedPieces.white}
        isAI={state.isAI && top === 'b'}
        difficulty={state.difficulty}
      />

      <div
        style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '16px 0', position: 'relative' }}
        onTouchStart={onBoardTouchStart}
        onTouchEnd={onBoardTouchEnd}
      >
        <div style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>
          <ChessBoard
            fen={displayFen}
            orientation={orientation}
            canMove={canMove}
            turn={displayTurn}
            lastMove={displayLastMove}
            inCheck={displayInCheck}
            onMove={move}
            onTapFeedback={haptic}
          />
          {!isLive && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '12px',
              boxShadow: 'inset 0 0 0 3px var(--yellow)', pointerEvents: 'none'
            }} />
          )}
        </div>
      </div>

      {!isLive && (
        <button onClick={(e) => { rippleFx(e); goLive(); }} className="ripple"
          style={{
            width: '100%', padding: '12px', borderRadius: '10px', marginBottom: '12px',
            background: 'var(--yellow-soft)', border: '1px solid var(--yellow)',
            color: 'var(--yellow)', fontWeight: 800, fontSize: '13px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}>
          <i className="fa-solid fa-bolt"></i> Return to Live Game
        </button>
      )}

      <div style={{ marginBottom: '12px' }}>
        <MoveHistoryPanel
          history={state.history}
          viewIndex={viewIndex === null ? moveCount - 1 : viewIndex}
          onSelectIndex={goToIndex}
          isLive={isLive}
        />
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
          <button onClick={(e) => { rippleFx(e); goFirst(); }} className="ripple" disabled={moveCount === 0}
            style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'var(--glass)', border: '1px solid var(--card-border)', fontSize: '13px', cursor: moveCount === 0 ? 'default' : 'pointer', opacity: moveCount === 0 ? 0.4 : 1 }}>
            ⏮
          </button>
          <button onClick={(e) => { rippleFx(e); goPrev(); }} className="ripple" disabled={moveCount === 0}
            style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'var(--glass)', border: '1px solid var(--card-border)', fontSize: '13px', cursor: moveCount === 0 ? 'default' : 'pointer', opacity: moveCount === 0 ? 0.4 : 1 }}>
            ◀ Prev
          </button>
          <button onClick={(e) => { rippleFx(e); goNext(); }} className="ripple" disabled={isLive}
            style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'var(--glass)', border: '1px solid var(--card-border)', fontSize: '13px', cursor: isLive ? 'default' : 'pointer', opacity: isLive ? 0.4 : 1 }}>
            Next ▶
          </button>
          <button onClick={(e) => { rippleFx(e); goLast(); }} className="ripple" disabled={isLive}
            style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'var(--glass)', border: '1px solid var(--card-border)', fontSize: '13px', cursor: isLive ? 'default' : 'pointer', opacity: isLive ? 0.4 : 1 }}>
            ⏭
          </button>
        </div>
      </div>

      <PlayerBar
        name={bottom === 'b' ? state.blackName : state.whiteName}
        rating={bottom === 'w' ? state.whiteRating : state.blackRating}
        color={bottom}
        time={bottom === 'w' ? clock.whiteTime : clock.blackTime}
        isTurn={state.turn === bottom && state.status === 'active'}
        hasClock={state.hasClock}
        capturedPieces={bottom === 'w' ? capturedPieces.black : capturedPieces.white}
        isAI={state.isAI && bottom === 'b'}
        difficulty={state.difficulty}
      />

      <div style={{
        textAlign: 'center', fontSize: '13px', fontWeight: 700,
        color: statusClass === 'alert' || statusClass === 'history' ? 'var(--yellow)' : statusClass === 'danger' ? 'var(--red)' : 'var(--text-secondary)',
        padding: '12px', marginBottom: '12px'
      }}>
        {status}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {myColor && state.status === 'active' && (
          <>
            <button onClick={(e) => { rippleFx(e); setConfirmResign(true); }} className="ripple"
              style={{
                width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--glass)',
                border: '1px solid var(--card-border)', color: 'var(--red)', fontWeight: 700, cursor: 'pointer'
              }}>
              🚩 Resign
            </button>
            {!state.isAI && (
              <button onClick={(e) => { rippleFx(e); offerDraw(); }} className="ripple"
                style={{
                  width: '100%', padding: '12px', borderRadius: '8px',
                  background: drawOffer === 'sent' ? 'var(--text-tertiary)' : 'var(--glass)',
                  border: `1px solid ${drawOffer === 'sent' ? 'var(--card-border)' : 'var(--card-border)'}`,
                  color: drawOffer === 'sent' ? 'var(--text-tertiary)' : 'var(--text-primary)',
                  fontWeight: 700, cursor: drawOffer === 'sent' ? 'not-allowed' : 'pointer'
                }}
                disabled={drawOffer === 'sent'}>
                🤝 {drawOffer === 'sent' ? 'Offer Sent' : 'Offer Draw'}
              </button>
            )}
          </>
        )}

        {(role === 'spectator' || state.status === 'finished') && (
          <button onClick={(e) => { rippleFx(e); navigate('/'); }} className="ripple"
            style={{
              width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--accent-soft)',
              border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer'
            }}>
            ⚡ New Game
          </button>
        )}
      </div>

      {drawOffer === 'incoming' && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 99
        }}>
          <div style={{
            width: '100%', maxWidth: 'calc(100% - 36px)', background: 'var(--bg-elevated)',
            borderRadius: '24px 24px 0 0', padding: '20px', marginBottom: 0
          }}>
            <div style={{ fontSize: '18px', fontWeight: 800, textAlign: 'center', marginBottom: '12px' }}>🤝 Draw Offer</div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '16px' }}>
              Your opponent offered a draw.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={(e) => { rippleFx(e); declineDraw(); }} className="ripple"
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px', background: 'var(--glass)',
                  border: '1px solid var(--card-border)', fontWeight: 700, cursor: 'pointer'
                }}>
                Decline
              </button>
              <button onClick={(e) => { rippleFx(e); acceptDraw(); }} className="ripple"
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px', background: 'var(--accent-soft)',
                  border: '1px solid var(--accent)', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer'
                }}>
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmResign && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 99
        }} onClick={() => setConfirmResign(false)}>
          <div style={{
            width: '100%', maxWidth: 'calc(100% - 36px)', background: 'var(--bg-elevated)',
            borderRadius: '24px 24px 0 0', padding: '20px'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '18px', fontWeight: 800, textAlign: 'center', marginBottom: '12px' }}>🚩 Resign?</div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '16px' }}>
              The game will end and your opponent will win.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={(e) => { rippleFx(e); setConfirmResign(false); }} className="ripple"
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px', background: 'var(--glass)',
                  border: '1px solid var(--card-border)', fontWeight: 700, cursor: 'pointer'
                }}>
                Cancel
              </button>
              <button onClick={(e) => { rippleFx(e); resign(); setConfirmResign(false); }} className="ripple"
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px', background: 'var(--red-soft)',
                  border: '1px solid var(--red)', color: 'var(--red)', fontWeight: 700, cursor: 'pointer'
                }}>
                Resign
              </button>
            </div>
          </div>
        </div>
      )}

      {gameOver && showGameOverModal && (
        <GameOverModal
          result={gameOver.result}
          reason={gameOver.reason}
          myColor={myColor}
          ratingChange={myColor === 'w' ? gameOver.whiteChange : myColor === 'b' ? gameOver.blackChange : null}
          onClose={() => setShowGameOverModal(false)}
          onNewGame={() => navigate('/')}
        />
      )}
    </div>
  );
}
