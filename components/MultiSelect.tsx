'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import ShapeIcon from './ShapeIcon';
import ColorSwatch from './ColorSwatch';

type Option = { id: number; name: string; hex?: string | null; iconKey?: string | null; refPhotoUrl?: string | null };
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
  const [orderSnapshot, setOrderSnapshot] = useState<number[] | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  function closeAndRefocus() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  // UI/UX audit C-02 (same pattern as IconSelect): Up/Down/Home/End move
  // focus between option rows, Enter/Space activates the focused one,
  // Escape closes and returns focus to the trigger.
  function handleListKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAndRefocus();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      const active = document.activeElement as HTMLElement | null;
      if (active && active.getAttribute('role') === 'option') {
        e.preventDefault();
        active.click();
      }
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const list = listboxRef.current;
    if (!list) return;
    const items = Array.from(list.querySelectorAll<HTMLElement>('[role="option"]'));
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();
    let nextIndex: number;
    if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = items.length - 1;
    else if (e.key === 'ArrowDown') nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, items.length - 1);
    else nextIndex = currentIndex < 0 ? items.length - 1 : Math.max(currentIndex - 1, 0);
    items[nextIndex]?.focus();
  }

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

  useEffect(() => {
    if (!open) return;
    // Snapshot the selected-first order once when the panel opens -- otherwise
    // a row jumps to the top the instant you check it, right out from under
    // the cursor mid multi-select.
    const selectedSet = new Set(localIds);
    const ranked = [...options].sort((a, b) => Number(!selectedSet.has(a.id)) - Number(!selectedSet.has(b.id)));
    setOrderSnapshot(ranked.map((o) => o.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const orderedOptions = orderSnapshot
    ? [
        ...orderSnapshot.map((id) => options.find((o) => o.id === id)).filter((o): o is Option => !!o),
        ...options.filter((o) => !orderSnapshot.includes(o.id))
      ]
    : options;

  const selected = options.filter((o) => localIds.includes(o.id));
  const filtered = useMemo(
    () => orderedOptions.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orderedOptions, query]
  );

  function Leading({ o }: { o: Option }) {
    if (leading === 'swatch') return <ColorSwatch hex={o.hex} refPhotoUrl={o.refPhotoUrl} name={o.name} size={14} />;
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

  // Selects/clears every currently-filtered (search-matching) option, not
  // the full unfiltered list -- searching "blue" then "select all" should
  // only select the blue ones on screen, not everything.
  async function selectAllFiltered() {
    for (const o of filtered) if (!localIds.includes(o.id)) await handleToggle(o.id, false);
  }
  async function clearAllFiltered() {
    for (const o of filtered) if (localIds.includes(o.id)) await handleToggle(o.id, true);
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
      <button
        ref={triggerRef}
        type="button"
        className="ms-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={placeholder}
        onKeyDown={(e) => { if (e.key === 'Escape' && open) closeAndRefocus(); }}
      >
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
      </button>

      {open && (
        <div className="ms-panel">
          <input
            type="text"
            placeholder="Search..."
            aria-label={`Search ${placeholder}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') closeAndRefocus(); }}
            autoFocus
            className="ms-search"
          />
          <div className="ms-select-all-row">
            <button type="button" className="ms-select-all-btn" onClick={selectAllFiltered}>Select all{query.trim() ? ` (${filtered.length})` : ''}</button>
            <span>·</span>
            <button type="button" className="ms-select-all-btn" onClick={clearAllFiltered}>Clear all</button>
          </div>
          {palettes && palettes.length > 0 && (
            <div className="ms-palette-section" role="listbox" aria-label={`${placeholder} palettes`} aria-multiselectable="true" onKeyDown={handleListKeyDown}>
              {palettes.map((p) => {
                const fullySelected = p.memberIds.length > 0 && p.memberIds.every((id) => localIds.includes(id));
                return (
                  <div
                    key={p.id}
                    role="option"
                    aria-selected={fullySelected}
                    tabIndex={0}
                    className={`ms-row ms-palette-row ${fullySelected ? 'ms-row-active' : ''}`}
                    onClick={() => applyPalette(p)}
                  >
                    <input type="checkbox" checked={fullySelected} readOnly aria-hidden="true" tabIndex={-1} />
                    <strong>{p.name}</strong>
                    <span className="ms-palette-count">{p.memberIds.length}</span>
                  </div>
                );
              })}
            </div>
          )}
          {filtered.length === 0 && <div style={{ padding: 12, fontSize: 12, color: '#756e5c' }}>{emptyHint || 'No matches.'}</div>}
          <div role="listbox" aria-label={placeholder} aria-multiselectable="true" ref={listboxRef} onKeyDown={handleListKeyDown}>
            {filtered.map((o) => {
              const isSel = localIds.includes(o.id);
              return (
                <div
                  key={o.id}
                  role="option"
                  aria-selected={isSel}
                  tabIndex={0}
                  className={`ms-row ${isSel ? 'ms-row-active' : ''}`}
                  onClick={() => handleToggle(o.id, isSel)}
                >
                  <input type="checkbox" checked={isSel} readOnly aria-hidden="true" tabIndex={-1} />
                  <Leading o={o} />
                  {o.name}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
