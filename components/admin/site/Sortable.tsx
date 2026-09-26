'use client';

import { useRef, useState, type ReactNode } from 'react';
import s from './site-admin.module.css';

// Drag-to-reorder that works with a mouse, a finger and a keyboard. Native
// HTML5 drag-and-drop does not fire on touch screens, and the owner mostly
// works from a phone, so this uses pointer events on a grip handle. The
// arrow buttons remain for anyone who finds dragging fiddly.

type Props<T> = {
  items: T[];
  getId: (item: T) => number | string;
  onReorder: (next: T[]) => void;
  render: (item: T, index: number) => ReactNode;
  label: (item: T) => string;
  layout?: 'list' | 'grid';
};

export default function Sortable<T>({ items, getId, onReorder, render, label, layout = 'list' }: Props<T>) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = items.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onReorder(next);
  }

  function indexAt(x: number, y: number) {
    let best = -1;
    let bestDist = Infinity;
    refs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      const dist = inside ? 0 : Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    return best;
  }

  function onPointerDown(e: React.PointerEvent, index: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragIndex(index);
    setOverIndex(index);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragIndex === null) return;
    const i = indexAt(e.clientX, e.clientY);
    if (i >= 0 && i !== overIndex) setOverIndex(i);
  }
  function onPointerUp() {
    if (dragIndex !== null && overIndex !== null) move(dragIndex, overIndex);
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <ul className={layout === 'grid' ? s.sortGrid : s.sortList}>
      {items.map((item, i) => (
        <li
          key={getId(item)}
          ref={(el) => { refs.current[i] = el; }}
          className={`${s.sortItem} ${dragIndex === i ? s.dragging : ''} ${overIndex === i && dragIndex !== null && dragIndex !== i ? s.dropTarget : ''}`}
        >
          <button
            type="button"
            className={s.grip}
            aria-label={`Drag to reorder ${label(item)}. Use arrow keys to move.`}
            onPointerDown={(e) => onPointerDown(e, i)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); move(i, i - 1); }
              if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); move(i, i + 1); }
            }}
          >
            <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true" fill="currentColor">
              {[3, 9, 15].map((y) => [4, 10].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
            </svg>
          </button>
          <div className={s.sortBody}>{render(item, i)}</div>
          <div className={s.sortArrows}>
            <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${label(item)} up`}>↑</button>
            <button type="button" onClick={() => move(i, i + 1)} disabled={i === items.length - 1} aria-label={`Move ${label(item)} down`}>↓</button>
          </div>
        </li>
      ))}
    </ul>
  );
}
