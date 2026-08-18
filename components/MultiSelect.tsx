'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ShapeIcon from './ShapeIcon';

type Option = { id: number; name: string; hex?: string | null; iconKey?: string | null };
type Palette = { id: number; name: string; memberIds: number[] };

export default function MultiSelect({
  options,
  selectedIds,
  onToggle,
  leading = 'none',
  placeholder = 'Nothing selected',
  emptyHint,
  palettes
}: {
  options: Option[];
  selectedIds: number[];
  onToggle: (id: number, currentlySelected: boolean) => void | Promise<void>;
  leading?: 'swatch' | 'icon' | 'none';
  placeholder?: string;
  emptyHint?: string;
  /** Quick-select groups shown above the option list -- checking one selects every member at once. */
  palettes?: Palette[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Local optimistic copy so clicks reflect instantly instead of waiting on a
  // server round-trip + page refresh -- fixes selections that appeared "stuck".
  const [localIds, setLocalIds] = useState<number[]>(selectedIds);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalIds(selectedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds.join(',')]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const selected = options.filter((o) => localIds.includes(o.id));
  const filtered = useMemo(
    () => options.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query]
  );

  function Leading({ o }: { o: Option }) {
    if (leading === 'swatch') return <span style={{ width: 12, height: 12, borderRadius: '50%', background: o.hex || '#ccc', border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />;
    if (leading === 'icon') return <span style={{ color: 'var(--navy)' }}><ShapeIcon iconKey={o.iconKey} size={12} /></span>;
    return null;
  }

  async function handleToggle(id: number, wasSelected: boolean) {
    setLocalIds((cur) => (wasSelected ? cur.filter((x) => x !== id) : [...cur, id]));
    try {
      await onToggle(id, wasSelected);
    } catch {
      setLocalIds((cur) => (wasSelected ? [...cur, id] : cur.filter((x) => x !== id)));
    }
  }

  // Selecting a palette adds every member not already selected; unchecking a
  // fully-selected palette removes every member. Individual colors within it
  // can still be toggled normally afterward either way.
  async function applyPalette(palette: Palette) {
    const isFullySelected = palette.memberIds.length > 0 && palette.memberIds.every((id) => localIds.includes(id));
    for (const id of palette.memberIds) {
      const isSel = localIds.includes(id);
      if (isFullySelected && isSel) await handleToggle(id, true);
      else if (!isFullySelected && !isSel) await handleToggle(id, false);
    }
  }

  return (
    <div style={{ position: 'relative' }} ref={rootRef}>
      <div className="ms-trigger" onClick={() => setOpen((v) => !v)}>
        <span className="ms-trigger-main">
          {leading !== 'none' && selected.length > 0 && (
            <span className="ms-preview-stack">
              {selected.slice(0, 5).map((o) => (
                <span key={o.id} className="ms-preview-dot"><Leading o={o} /></span>
              ))}
            </span>
          )}
          <span className="ms-placeholder">
            {selected.length === 0 ? placeholder : `${selected.length} selected`}
          </span>
        </span>
        <span className="ms-summary">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="ms-panel">
          <input
            type="text"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="ms-search"
          />
          {palettes && palettes.length > 0 && (
            <div className="ms-palette-section">
              {palettes.map((p) => {
                const fullySelected = p.memberIds.length > 0 && p.memberIds.every((id) => localIds.includes(id));
                return (
                  <div key={p.id} className={`ms-row ms-palette-row ${fullySelected ? 'ms-row-active' : ''}`} onClick={() => applyPalette(p)}>
                    <input type="checkbox" checked={fullySelected} readOnly />
                    <strong>{p.name}</strong>
                    <span className="ms-palette-count">{p.memberIds.length}</span>
                  </div>
                );
              })}
            </div>
          )}
          {filtered.length === 0 && <div style={{ padding: 12, fontSize: 12, color: '#8a8370' }}>{emptyHint || 'No matches.'}</div>}
          {filtered.map((o) => {
            const isSel = localIds.includes(o.id);
            return (
              <div
                key={o.id}
                className={`ms-row ${isSel ? 'ms-row-active' : ''}`}
                onClick={() => handleToggle(o.id, isSel)}
              >
                <input type="checkbox" checked={isSel} readOnly />
                <Leading o={o} />
                {o.name}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
