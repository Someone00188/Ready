import { Chess } from 'chess.js';
import { resolveTimeControl } from '../config.js';

export class Game {
  constructor({ id, whiteId, blackId, whiteName, blackName, timeMode, difficulty }) {
    this.id = id;
    this.whiteId = whiteId ? String(whiteId) : null;
    this.blackId = blackId ? String(blackId) : null;
    this.whiteName = whiteName || 'Oq';
    this.blackName = blackName || (timeMode === 'ai' ? 'AI' : 'Qora');
    this.timeMode = timeMode;
    this.difficulty = difficulty || null;
    this.isAI = timeMode === 'ai';

    this.chess = new Chess();

    const resolved = resolveTimeControl(timeMode) || { baseMs: null, incrementMs: 0 };
    this.incrementMs = resolved.incrementMs || 0;
    this.hasClock = resolved.baseMs != null;
    this.whiteTime = resolved.baseMs ?? Infinity;
    this.blackTime = resolved.baseMs ?? Infinity;

    this.status = this.isAI ? 'active' : 'waiting';  // 1v1 raqib kutadi
    this.result = null;      // '1-0' | '0-1' | '1/2-1/2'
    this.reason = null;      // checkmate | timeout | resignation | draw | stalemate
    this.drawOfferBy = null; // 'w' | 'b'
    this.wideMatch = false;  // matchmaking: reyting mos kelmagan holatda (kam o'yinchi) yaratilgan match

    this.lastMoveAt = Date.now();
    this.startedAt = null;
  }

  // Raqib qo'shildi → o'yin boshlanadi
  addBlackPlayer(userId, name) {
    if (this.blackId || this.isAI) return false;
    this.blackId = String(userId);
    this.blackName = name || 'Qora';
    this.status = 'active';
    this.startedAt = Date.now();
    this.lastMoveAt = Date.now();
    return true;
  }

  colorOf(userId) {
    const id = String(userId);
    if (id === this.whiteId) return 'w';
    if (id === this.blackId) return 'b';
    return null;
  }

  // Yurayotgan tomonning soatidan o'tgan vaqtni ayirish
  syncClock() {
    if (!this.hasClock || this.status !== 'active') return;

    const now = Date.now();
    const elapsed = now - this.lastMoveAt;
    const turn = this.chess.turn();

    if (turn === 'w') this.whiteTime -= elapsed;
    else this.blackTime -= elapsed;

    this.lastMoveAt = now;

    if (this.whiteTime <= 0) {
      this.whiteTime = 0;
      this.finish('0-1', 'timeout');
    } else if (this.blackTime <= 0) {
      this.blackTime = 0;
      this.finish('1-0', 'timeout');
    }
  }

  // Yurish. Xato bo'lsa { error } qaytaradi.
  move(userId, { from, to, promotion }) {
    if (this.status !== 'active') return { error: "O'yin faol emas" };

    this.syncClock();
    if (this.status !== 'active') return { error: 'Vaqt tugadi' };

    const color = this.isAI && String(userId) === this.whiteId ? 'w' : this.colorOf(userId);
    if (!color) return { error: "Siz bu o'yinning o'yinchisi emassiz" };
    if (color !== this.chess.turn()) return { error: 'Navbat sizniki emas' };

    let mv;
    try {
      mv = this.chess.move({ from, to, promotion: promotion || 'q' });
    } catch {
      return { error: "Noqonuniy yurish" };
    }
    if (!mv) return { error: "Noqonuniy yurish" };

    // Increment: yurgan tomonning soatiga qo'shiladi (yurishdan OLDINGI rang, chunki
    // chess.js allaqachon navbatni almashtirib bo'ldi)
    if (this.hasClock && this.incrementMs > 0) {
      if (mv.color === 'w') this.whiteTime += this.incrementMs;
      else this.blackTime += this.incrementMs;
    }

    this.drawOfferBy = null;
    this.lastMoveAt = Date.now();
    this.checkGameEnd();

    return { move: mv };
  }

  // AI yurishi (userId tekshiruvisiz)
  moveRaw(from, to, promotion = 'q') {
    try {
      const mv = this.chess.move({ from, to, promotion });
      if (!mv) return null;
      this.lastMoveAt = Date.now();
      this.checkGameEnd();
      return mv;
    } catch {
      return null;
    }
  }

  checkGameEnd() {
    if (this.chess.isCheckmate()) {
      // Mat qo'yilgan tomon yutqazadi
      this.finish(this.chess.turn() === 'w' ? '0-1' : '1-0', 'checkmate');
    } else if (this.chess.isStalemate()) {
      this.finish('1/2-1/2', 'stalemate');
    } else if (this.chess.isInsufficientMaterial()) {
      this.finish('1/2-1/2', 'insufficient_material');
    } else if (this.chess.isThreefoldRepetition()) {
      this.finish('1/2-1/2', 'threefold_repetition');
    } else if (this.chess.isDraw()) {
      this.finish('1/2-1/2', 'fifty_move_rule');
    }
  }

  resign(userId) {
    const color = this.colorOf(userId);
    if (!color) return { error: "Siz bu o'yinning o'yinchisi emassiz" };
    if (this.status !== 'active') return { error: "O'yin allaqachon tugagan" };

    this.finish(color === 'w' ? '0-1' : '1-0', 'resignation');
    return { ok: true };
  }

  /** Uzoq vaqt uzilib qolgan o'yinchi uchun avtomatik mag'lubiyat */
  forceTimeoutLoss(userId) {
    const color = this.colorOf(userId);
    if (!color) return { error: "Siz bu o'yinning o'yinchisi emassiz" };
    if (this.status !== 'active') return { error: "O'yin allaqachon tugagan" };

    this.finish(color === 'w' ? '0-1' : '1-0', 'disconnect_timeout');
    return { ok: true };
  }

  offerDraw(userId) {
    const color = this.colorOf(userId);
    if (!color) return { error: "Siz bu o'yinning o'yinchisi emassiz" };
    if (this.status !== 'active') return { error: "O'yin faol emas" };
    if (this.isAI) return { error: "AI bilan durrang taklif qilib bo'lmaydi" };

    this.drawOfferBy = color;
    return { ok: true, by: color };
  }

  acceptDraw(userId) {
    const color = this.colorOf(userId);
    if (!color) return { error: "Siz bu o'yinning o'yinchisi emassiz" };
    if (!this.drawOfferBy) return { error: 'Durrang taklifi yo\'q' };
    if (this.drawOfferBy === color) return { error: "O'z taklifingizni qabul qila olmaysiz" };

    this.finish('1/2-1/2', 'draw');
    return { ok: true };
  }

  declineDraw(userId) {
    const color = this.colorOf(userId);
    if (!color) return { error: "Siz bu o'yinning o'yinchisi emassiz" };
    this.drawOfferBy = null;
    return { ok: true };
  }

  finish(result, reason) {
    if (this.status === 'finished') return;
    this.status = 'finished';
    this.result = result;
    this.reason = reason;
    this.finishedAt = Date.now();
  }

  // Frontendga yuboriladigan holat
  getState() {
    if (this.status === 'active') this.syncClock();

    return {
      id: this.id,
      fen: this.chess.fen(),
      pgn: this.chess.pgn(),
      turn: this.chess.turn(),
      status: this.status,
      result: this.result,
      reason: this.reason,
      isAI: this.isAI,
      difficulty: this.difficulty,
      timeMode: this.timeMode,
      hasClock: this.hasClock,
      whiteTime: this.hasClock ? Math.max(0, Math.round(this.whiteTime)) : null,
      blackTime: this.hasClock ? Math.max(0, Math.round(this.blackTime)) : null,
      whiteId: this.whiteId,
      blackId: this.blackId,
      whiteName: this.whiteName,
      blackName: this.blackName,
      inCheck: this.chess.inCheck(),
      isCheckmate: this.chess.isCheckmate(),
      isStalemate: this.chess.isStalemate(),
      drawOfferBy: this.drawOfferBy,
      history: this.chess.history({ verbose: true }).map(m => ({
        san: m.san, from: m.from, to: m.to, color: m.color
      })),
      lastMove: (() => {
        const h = this.chess.history({ verbose: true });
        const last = h[h.length - 1];
        return last ? { from: last.from, to: last.to } : null;
      })(),
      moveCount: this.chess.history().length
    };
  }

  // Bir katakdan mumkin bo'lgan yurishlar (frontend highlight uchun)
  legalMovesFrom(square) {
    return this.chess.moves({ square, verbose: true }).map(m => ({
      to: m.to,
      captured: !!m.captured,
      promotion: !!m.promotion
    }));
  }
}
