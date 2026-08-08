import { useMemo, useState, useEffect } from 'react';
import { Chess } from 'chess.js';

const FILES = ['a','b','c','d','e','f','g','h'];
const RANKS = ['8','7','6','5','4','3','2','1'];

// SVG shaxmat donalari — cburnett to'plami (Colin M.L. Burnett, GPLv2+)
// Klassik, aniq oq/qora farqlanadigan Staunton uslubidagi to'shlar.
import { PIECE_SVGS, PIECE_VIEWBOX } from '../pieces/cburnettPieces';

function Piece({ type, color }) {
  const key = (color === 'w' ? 'w' : 'b') + type.toUpperCase();
  return (
    <svg className={`piece ${color}`} viewBox={PIECE_VIEWBOX} aria-hidden="true">
      {PIECE_SVGS[key]}
    </svg>
  );
}

/**
 * Taxta. Qoidalar serverda tekshiriladi; bu yerdagi chess.js faqat
 * yurish nuqtalarini ko'rsatish uchun (server baribir qayta tekshiradi).
 */
export default function ChessBoard({ fen, orientation = 'w', canMove, turn, lastMove, inCheck, onMove, onTapFeedback }) {
  const [selected, setSelected] = useState(null);
  const [promotion, setPromotion] = useState(null);   // { from, to }

  const chess = useMemo(() => {
    try { return new Chess(fen); } catch { return new Chess(); }
  }, [fen]);

  // Taxta yangilanganda tanlovni tozalash
  useEffect(() => { setSelected(null); }, [fen]);

  const targets = useMemo(() => {
    if (!selected) return {};
    const map = {};
    for (const m of chess.moves({ square: selected, verbose: true })) {
      map[m.to] = { capture: !!m.captured, promotion: !!m.promotion };
    }
    return map;
  }, [selected, chess]);

  // Shoh turgan katak (shah bo'lsa)
  const checkSquare = useMemo(() => {
    if (!inCheck) return null;
    for (const row of chess.board()) {
      for (const p of row) {
        if (p && p.type === 'k' && p.color === turn) return p.square;
      }
    }
    return null;
  }, [inCheck, turn, chess]);

  function handleTap(square) {
    if (!canMove) return;

    const piece = chess.get(square);

    // Nishonga bosildi → yurish
    if (selected && targets[square]) {
      onTapFeedback?.('medium');
      if (targets[square].promotion) {
        setPromotion({ from: selected, to: square });
      } else {
        onMove(selected, square);
        setSelected(null);
      }
      return;
    }

    // O'z donasi → tanlash / tanlovni almashtirish
    if (piece && piece.color === turn) {
      onTapFeedback?.('light');
      setSelected(square === selected ? null : square);
      return;
    }

    setSelected(null);
  }

  function choosePromotion(kind) {
    onMove(promotion.from, promotion.to, kind);
    setPromotion(null);
    setSelected(null);
  }

  const files = orientation === 'w' ? FILES : [...FILES].reverse();
  const ranks = orientation === 'w' ? RANKS : [...RANKS].reverse();

  return (
    <div className="board-wrap">
      <div className="board" role="grid" aria-label="Shaxmat taxtasi">
        {ranks.map((rank, r) =>
          files.map((file, f) => {
            const square = file + rank;
            const piece = chess.get(square);
            // a1 qora, h1 oq: fayl indeksi + rank juft bo'lsa — oq katak
            const isLight = (FILES.indexOf(file) + parseInt(rank, 10)) % 2 === 0;
            const target = targets[square];

            const classes = ['sq', isLight ? 'light' : 'dark'];
            if (square === selected) classes.push('selected');
            if (lastMove && (square === lastMove.from || square === lastMove.to)) classes.push('last');
            if (square === checkSquare) classes.push('check');

            return (
              <div
                key={square}
                className={classes.join(' ')}
                onClick={() => handleTap(square)}
                role="gridcell"
                aria-label={`${square}${piece ? ` ${piece.color === 'w' ? 'oq' : 'qora'}` : ' bo\u2018sh'}`}
              >
                {piece && <Piece type={piece.type} color={piece.color} />}
                {target && <span className={`hint${target.capture ? ' capture' : ''}`} />}
                {f === 0 && <span className="coord rank">{rank}</span>}
                {r === 7 && <span className="coord file">{file}</span>}
              </div>
            );
          })
        )}
      </div>

      {promotion && (
        <div className="sheet-overlay" onClick={() => setPromotion(null)}>
          <div className="sheet-modal center-modal" onClick={e => e.stopPropagation()}>
            <div className="sheet-title" style={{ textAlign: 'center' }}>Promote Pawn</div>
            <p className="modal-result-sub">Which piece would you like?</p>
            <div className="g-promo-row">
              {['q', 'r', 'b', 'n'].map(k => (
                <button key={k} className="g-promo-btn ripple" onClick={() => choosePromotion(k)}
                        aria-label={{ q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[k]}>
                  <Piece type={k} color={turn === 'w' ? 'w' : 'b'} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
