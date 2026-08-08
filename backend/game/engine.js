import { Chess } from 'chess.js';
import { AI_LEVELS } from '../config.js';

// Dona qiymatlari (santipeshka)
const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// Piece-square jadvallar (oq tomon nuqtai nazaridan, a8..h1)
const PST = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0
  ],
  n: [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50
  ],
  b: [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -20,-10,-10,-10,-10,-10,-10,-20
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0
  ],
  q: [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20
  ],
  k: [
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20
  ]
};

const FILES = 'abcdefgh';

function squareIndex(square, color) {
  const file = FILES.indexOf(square[0]);
  const rank = parseInt(square[1], 10);
  // Oq uchun: a8 = 0 ... h1 = 63
  const idx = (8 - rank) * 8 + file;
  return color === 'w' ? idx : 63 - idx;
}

// Pozitsiyani baholash (oq tomon foydasiga musbat)
function evaluate(chess) {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? -100000 : 100000;
  if (chess.isDraw() || chess.isStalemate()) return 0;

  let score = 0;
  const board = chess.board();

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece) continue;

      const value = PIECE_VALUE[piece.type];
      const pst = PST[piece.type][squareIndex(piece.square, piece.color)];
      const total = value + pst;

      score += piece.color === 'w' ? total : -total;
    }
  }

  return score;
}

// Yurishlarni saralash — yaxshi nomzodlarni oldinga (alpha-beta samaradorligi uchun)
function orderMoves(moves) {
  return moves.sort((a, b) => scoreMove(b) - scoreMove(a));
}

function scoreMove(m) {
  let s = 0;
  if (m.captured) s += 10 * PIECE_VALUE[m.captured] - PIECE_VALUE[m.piece];
  if (m.promotion) s += PIECE_VALUE[m.promotion];
  if (m.san.includes('#')) s += 100000;
  else if (m.san.includes('+')) s += 50;
  return s;
}

// Vaqt tugaganda qidiruvni to'xtatish uchun
class Timeout extends Error {}
let deadline = Infinity;

function checkTime() {
  if (Date.now() > deadline) throw new Timeout();
}

function minimax(chess, depth, alpha, beta, maximizing) {
  checkTime();
  if (depth === 0 || chess.isGameOver()) return evaluate(chess);

  const moves = orderMoves(chess.moves({ verbose: true }));

  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      chess.move(m);
      best = Math.max(best, minimax(chess, depth - 1, alpha, beta, false));
      chess.undo();
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      chess.move(m);
      best = Math.min(best, minimax(chess, depth - 1, alpha, beta, true));
      chess.undo();
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

/**
 * FEN pozitsiyasidan eng yaxshi yurishni topadi.
 * Iterative deepening + vaqt chegarasi: chuqurlikni bosqichma-bosqich oshiradi,
 * vaqt tugasa oxirgi tugallangan chuqurlik natijasini qaytaradi.
 * @param {string} fen
 * @param {number} level 1..5
 * @returns {{from, to, promotion, san} | null}
 */
export function findBestMove(fen, level = 3) {
  const settings = AI_LEVELS[level] || AI_LEVELS[3];
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });

  if (!moves.length) return null;
  if (moves.length === 1) {
    const m = moves[0];
    return { from: m.from, to: m.to, promotion: m.promotion || 'q', san: m.san };
  }

  // Pastroq darajalarda ba'zan tasodifiy yuradi — inson kabi xato qiladi
  if (settings.randomness > 0 && Math.random() < settings.randomness) {
    const m = moves[Math.floor(Math.random() * moves.length)];
    return { from: m.from, to: m.to, promotion: m.promotion || 'q', san: m.san };
  }

  deadline = Date.now() + settings.timeMs;

  const maximizing = chess.turn() === 'w';
  const ordered = orderMoves(moves);
  let bestMove = ordered[0];

  // Iterative deepening
  for (let depth = 1; depth <= settings.depth; depth++) {
    let localBest = ordered[0];
    let localScore = maximizing ? -Infinity : Infinity;
    let completed = true;

    try {
      for (const m of ordered) {
        chess.move(m);
        const score = minimax(chess, depth - 1, -Infinity, Infinity, !maximizing);
        chess.undo();

        if (maximizing ? score > localScore : score < localScore) {
          localScore = score;
          localBest = m;
        }
      }
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
      completed = false;
      // chess holatini tiklash
      while (chess.history().length > new Chess(fen).history().length) chess.undo();
    }

    if (completed) {
      bestMove = localBest;
      // Mat topildi — chuqurroq qidirish shart emas
      if (Math.abs(localScore) > 90000) break;
    } else {
      break;
    }
  }

  deadline = Infinity;

  return {
    from: bestMove.from,
    to: bestMove.to,
    promotion: bestMove.promotion || 'q',
    san: bestMove.san
  };
}

export { evaluate };
