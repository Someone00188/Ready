import { useEffect, useRef } from 'react';

export default function MoveList({ history = [] }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [history.length]);

  if (!history.length) {
    return <div className="g-moves"><span className="g-moves-empty">Moves will appear here</span></div>;
  }

  const pairs = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({ n: i / 2 + 1, w: history[i]?.san, b: history[i + 1]?.san });
  }

  return (
    <div className="g-moves" ref={ref}>
      {pairs.map(p => (
        <span key={p.n}>
          <span className="g-move-num">{p.n}.</span>
          <span className="g-move-san">{p.w}</span>
          {p.b && <span className="g-move-san">{p.b}</span>}
        </span>
      ))}
    </div>
  );
}
