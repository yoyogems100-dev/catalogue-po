'use client';

import { useMemo, useState } from 'react';

type Category = { id: number; name: string };
type Mode = 'add' | 'remove' | null;

// One bar for everything you can do to a multi-selection of shapes or colors:
// link them to categories, unlink them, or delete them outright. Category
// actions go through /api/category-links/bulk in a single request, so 200
// selected colors x 3 categories is one write, not 600.
export default function BulkActionBar({
  kind,
  selectedIds,
  categories,
  scopedCategoryId,
  onClear,
  onDelete,
  onDone
}: {
  kind: 'shape' | 'color';
  selectedIds: number[];
  categories: Category[];
  /** When the list is filtered to one category, "remove" defaults to it. */
  scopedCategoryId?: number;
  onClear: () => void;
  /** Omit to hide Delete (e.g. while filtered to a category). */
  onDelete?: () => void;
  onDone: (message: string) => void;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const count = selectedIds.length;
  const noun = `${kind}${count === 1 ? '' : 's'}`;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query]);

  if (count === 0) return null;

  function open(next: Mode) {
    if (mode === next) return setMode(null);
    setMode(next);
    setQuery('');
    setPicked(next === 'remove' && scopedCategoryId ? [scopedCategoryId] : []);
  }

  function toggle(id: number) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function apply() {
    if (!mode || picked.length === 0) return;
    const names = categories.filter((c) => picked.includes(c.id)).map((c) => c.name);
    const where = names.length === 1 ? names[0] : `${names.length} categories`;
    if (mode === 'remove' && !confirm(`Remove ${count} ${noun} from ${where}? The ${noun} stay in the catalogue and in past orders.`)) return;
    setBusy(true);
    const res = await fetch('/api/category-links/bulk', {
      method: mode === 'add' ? 'POST' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryIds: picked, [kind === 'shape' ? 'shapeIds' : 'colorIds']: selectedIds })
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return onDone(data.error || 'Could not update categories.');
    setMode(null);
    setPicked([]);
    onDone(mode === 'add' ? `${count} ${noun} added to ${where}.` : `${count} ${noun} removed from ${where}.`);
  }

  return (
    <div className="bulk-bar" role="region" aria-label="Bulk actions">
      <div className="bulk-bar-row">
        <strong className="bulk-bar-count">{count} selected</strong>
        <button type="button" className="bulk-bar-link" onClick={onClear}>Clear</button>
        <div className="bulk-bar-actions">
          <button type="button" className={`btn-ghost ${mode === 'add' ? 'active' : ''}`} aria-expanded={mode === 'add'} onClick={() => open('add')}>Add to category</button>
          <button type="button" className={`btn-ghost ${mode === 'remove' ? 'active' : ''}`} aria-expanded={mode === 'remove'} onClick={() => open('remove')}>Remove from category</button>
          {onDelete && <button type="button" className="btn-ghost bulk-bar-danger" onClick={onDelete}>Delete</button>}
        </div>
      </div>
      {mode && (
        <div className="bulk-bar-panel">
          <input type="search" placeholder="Search categories…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search categories" />
          <div className="bulk-bar-options">
            {shown.map((c) => (
              <label key={c.id} className={picked.includes(c.id) ? 'checked' : ''}>
                <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} />
                <span>{c.name}</span>
              </label>
            ))}
            {shown.length === 0 && <span className="bulk-bar-empty">No category matches.</span>}
          </div>
          <div className="bulk-bar-apply">
            <button type="button" className="btn" disabled={busy || picked.length === 0} onClick={apply}>
              {busy ? 'Saving…' : mode === 'add'
                ? `Add ${count} ${noun}${picked.length ? ` to ${picked.length} categor${picked.length === 1 ? 'y' : 'ies'}` : ''}`
                : `Remove ${count} ${noun}${picked.length ? ` from ${picked.length} categor${picked.length === 1 ? 'y' : 'ies'}` : ''}`}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setMode(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
