import { rippleFx } from '../hooks/useRipple';

const REASONS = {
  checkmate: 'Checkmate',
  timeout: 'Time out',
  resignation: 'Resignation',
  draw: 'Draw agreed',
  stalemate: 'Stalemate',
  insufficient_material: 'Insufficient material',
  threefold_repetition: 'Threefold repetition',
  fifty_move_rule: '50-move rule'
};

export default function GameOverModal({ result, reason, myColor, ratingChange, onClose, onNewGame }) {
  let title = 'Draw';
  let icon = 'fa-handshake';

  if (result === '1-0' || result === '0-1') {
    const iWon = (result === '1-0' && myColor === 'w') || (result === '0-1' && myColor === 'b');

    if (myColor) {
      title = iWon ? 'You Won' : 'You Lost';
      icon = iWon ? 'fa-trophy' : 'fa-face-frown';
    } else {
      title = result === '1-0' ? 'White Won' : 'Black Won';
      icon = 'fa-flag-checkered';
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet-modal center-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-result-icon"><i className={`fa-solid ${icon}`}></i></div>
        <div className="sheet-title" style={{ textAlign: 'center' }}>{title}</div>
        <p className="modal-result-sub">
          {REASONS[reason] || reason}
          {ratingChange != null && ratingChange !== 0 && (
            <> · Rating {ratingChange > 0 ? '+' : ''}{ratingChange}</>
          )}
        </p>
        <div className="sheet-controls">
          <button className="btn-secondary ripple" onClick={(e) => { rippleFx(e); onClose(); }}>View Board</button>
          <button className="btn-continue ripple" onClick={(e) => { rippleFx(e); onNewGame(); }}>New Game</button>
        </div>
      </div>
    </div>
  );
}
