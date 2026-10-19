'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useDragReorder, moveItem } from '@/hooks/useDragReorder';

type Item = { id: number; name: string; coverUrl: string | null };

// The order of the catalogue cards on /po. Moves are staged here and saved in
// one batch, so a dozen taps on the arrows is one write, and Cancel really
// does put everything back. Arrows and "type a position" are the phone way in;
// drag works too on a desktop.
export default function ArrangeOrder({ items, archivedIds, shelfOf, onDone }: {
  items: Item[];
  archivedIds: number[];
  shelfOf: (id: number) => string[];
  onDone: (saved: boolean) => void;
}) {
  const [list, setList] = useState(items);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [flashId, setFlashId] = useState<number | null>(null);
  const changed = list.some((item, i) => item.id !== items[i]?.id);

  function move(from: number, to: number) {
    const target = Math.max(0, Math.min(list.length - 1, to));
    if (target === from) return;
    setList(moveItem(list, from, target));
    setFlashId(list[from].id);
  }

  const { dragHandleProps, dropTargetProps, dragIndex, overIndex } = useDragReorder(move);

  function sortAZ() {
    setList([...list].sort((a, b) => a.name.localeCompare(b.name)));
    setFlashId(null);
  }

  async function save() {
    if (saving) return;
    setSaving(true); setError('');
    const res = await fetch('/api/categories/reorder-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Archived ones follow the live ones so numbering stays gap-free.
      body: JSON.stringify({ orderedIds: [...list.map((c) => c.id), ...archivedIds] })
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) { setError('Could not save the new order. Please try again.'); return; }
    onDone(true);
  }

  function cancel() {
    if (changed && !confirm('Discard the changes to the order?')) return;
    onDone(false);
  }

  return (
    <section className="arrange-order" aria-label="Arrange category order">
      <div className="arrange-order-intro">
        <p>
          Card <b>1</b> shows first in the <Link href="/po" target="_blank">catalogue</Link>. Use the arrows, type a position, or drag a row. Nothing changes for buyers until you press <b>Save order</b>.
        </p>
        <button type="button" className="btn-ghost" onClick={sortAZ}>Sort A–Z</button>
      </div>

      <ol className="arrange-order-list">
        {list.map((c, i) => {
          const shelves = shelfOf(c.id);
          return (
            <li key={c.id} {...dropTargetProps(i)}
              className={`arrange-order-row${overIndex === i ? ' drag-over-row' : ''}${flashId === c.id ? ' moved' : ''}`}
              style={{ opacity: dragIndex === i ? 0.4 : 1 }}>
              <span {...dragHandleProps(i)} className="drag-handle arrange-order-grip" title="Drag to reorder" aria-hidden="true">&#9776;</span>
              <PositionInput position={i + 1} max={list.length} name={c.name} onChange={(p) => move(i, p - 1)} />
              <span className="arrange-order-thumb">{c.coverUrl ? <img src={c.coverUrl} alt="" loading="lazy" decoding="async" /> : null}</span>
              <span className="arrange-order-name">
                <span>{c.name}</span>
                {shelves.length > 0 && <small>Also on {shelves.join(', ')}</small>}
              </span>
              <span className="arrange-order-moves">
                <button type="button" onClick={() => move(i, 0)} disabled={i === 0} aria-label={`Move ${c.name} to the top`} title="Move to top">⤒</button>
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${c.name} up`} title="Up">↑</button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === list.length - 1} aria-label={`Move ${c.name} down`} title="Down">↓</button>
                <button type="button" onClick={() => move(i, list.length - 1)} disabled={i === list.length - 1} aria-label={`Move ${c.name} to the bottom`} title="Move to bottom">⤓</button>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="arrange-order-bar" role="region" aria-label="Save order">
        <span className="arrange-order-status" role="status">{error || (changed ? 'Unsaved changes' : 'No changes yet')}</span>
        <button type="button" className="btn-ghost" onClick={() => { setList(items); setFlashId(null); }} disabled={!changed || saving}>Reset</button>
        <button type="button" className="btn-ghost" onClick={cancel} disabled={saving}>Cancel</button>
        <button type="button" className="btn" onClick={save} disabled={!changed || saving}>{saving ? 'Saving...' : 'Save order'}</button>
      </div>
    </section>
  );
}

// Type "1" to send a category to the top. Applied on Enter/blur so typing a
// two-digit number doesn't jump the row after the first digit.
function PositionInput({ position, max, name, onChange }: { position: number; max: number; name: string; onChange: (p: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  const cancelled = useRef(false);
  function commit() {
    const n = cancelled.current ? NaN : parseInt(text ?? '', 10);
    cancelled.current = false;
    setText(null);
    if (Number.isFinite(n) && n !== position) onChange(Math.max(1, Math.min(max, n)));
  }
  return (
    <input className="arrange-order-pos" type="text" inputMode="numeric" aria-label={`Position of ${name}`}
      value={text ?? String(position)}
      onFocus={(e) => { setText(String(position)); e.currentTarget.select(); }}
      onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 3))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') { cancelled.current = true; e.currentTarget.blur(); }
      }} />
  );
}
