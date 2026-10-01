'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import ShapeReferenceImage from './ShapeReferenceImage';
import { resolveSizes, sortSizes, suggestSizes } from '@/lib/quick-order';

type ShapeRef = { id: number; name: string; iconKey?: string | null; refPhotoUrl?: string | null };
/** pcs_per_ct: set on sizes sold by carat (Moissanite Round under 3 mm) -- pieces in 1 ct. */
export type GridSize = { id: number; shape_id: number; size_mm: string; pcs_per_ct?: number | null };
/** What the buyer typed per size id: carats for sizes sold by weight, else pieces. */
export type GridEntries = Record<number, string>;

/** A size entry that will become an order line: whole carats or whole pieces. */
export type GridLine = { size: GridSize; shape: ShapeRef; amount: number; pcs: number };

const WHOLE = /^\d*$/;

/** Entries that are filled in with a whole number above zero, in shape then size order. */
export function gridLines(shapes: ShapeRef[], sizes: GridSize[], entries: GridEntries): GridLine[] {
  const lines: GridLine[] = [];
  for (const shape of shapes) {
    sortSizes(sizes.filter((s) => s.shape_id === shape.id)).forEach((size) => {
      const raw = (entries[size.id] || '').trim();
      if (!raw || !WHOLE.test(raw)) return;
      const amount = Number(raw);
      if (!Number.isSafeInteger(amount) || amount <= 0) return;
      lines.push({ size, shape, amount, pcs: size.pcs_per_ct ? amount * size.pcs_per_ct : amount });
    });
  }
  return lines;
}

export function gridHasError(entries: GridEntries) {
  return Object.values(entries).some((v) => !WHOLE.test(v.trim()));
}

const fmt = (n: number) => n.toLocaleString('en-IN');

/** "3 sizes" while every line is one shape; mixed shapes read "30 items". */
export function countLabel(lines: { shape: { id: number } }[]) {
  const n = lines.length;
  const oneShape = new Set(lines.map((l) => l.shape.id)).size <= 1;
  return `${n} ${oneShape ? (n === 1 ? 'size' : 'sizes') : 'items'}`;
}

const unitOf = (s: GridSize) => (s.pcs_per_ct ? 'ct' : 'pcs');

/**
 * Moissanite quick order sheet. "Pick sizes" opens a panel of every size of
 * the shape: tick sizes, type one quantity, Add -- the panel stays open for
 * the next set until Done (which also keeps anything ticked and typed). Each
 * size then has its own row to change. Round under 3 mm is in ct, everything
 * else in pcs, and the two are never ticked together. Lines stay put when
 * switching shape (the shape tiles count them) and are added in one go.
 */
export default function SizeGridComposer({
  shapes,
  sizes,
  entries,
  onEntries,
  shapeId,
  onShape,
  onPanelChange,
}: {
  shapes: ShapeRef[];
  sizes: GridSize[];
  entries: GridEntries;
  onEntries: (next: GridEntries) => void;
  shapeId: number | null;
  onShape: (id: number) => void;
  /** Told when the size panel opens and closes. */
  onPanelChange?: (open: boolean) => void;
}) {
  const [sizeText, setSizeText] = useState('');
  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState('');
  // The size panel opens from the size box and stays open -- tick sizes, type
  // one quantity, Add, tick the next set -- until Done.
  const [panelOpen, setPanelOpen] = useState(false);
  useEffect(() => { onPanelChange?.(panelOpen); }, [panelOpen, onPanelChange]);
  // Sizes ticked in the size panel, to take one quantity together.
  const [picked, setPicked] = useState<number[]>([]);
  // The last amount entered per unit, repeated when the amount is left empty.
  const [last, setLast] = useState<{ ct?: number; pcs?: number }>({});
  const sizeInput = useRef<HTMLInputElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);

  // Keep the chosen shape in view in the strip, e.g. after tapping a line
  // of another shape in the selection list.
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = strip.current;
    const tile = row?.querySelector<HTMLElement>('.po-grid-shape.active');
    if (!row || !tile) return;
    const left = tile.offsetLeft; // the strip is position: relative, so its own offsetParent
    if (left < row.scrollLeft || left + tile.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: Math.max(0, left - 8), behavior: 'smooth' });
    }
  }, [shapeId]);

  useEffect(() => { setSizeText(''); setAmountText(''); setError(''); setPicked([]); }, [shapeId]);

  const shapeSizes = useMemo(() => sortSizes(sizes.filter((s) => s.shape_id === shapeId)), [sizes, shapeId]);
  const rows = shapeSizes.filter((s) => entries[s.id] !== undefined);
  // Only sizes that will actually be added count on the shape tiles.
  const countByShape = useMemo(() => {
    const m = new Map<number, number>();
    sizes.forEach((s) => { if (/^\d+$/.test((entries[s.id] || '').trim()) && Number(entries[s.id]) > 0) m.set(s.shape_id, (m.get(s.shape_id) || 0) + 1); });
    return m;
  }, [sizes, entries]);
  const shape = shapes.find((s) => s.id === shapeId) || null;

  // The ticked sizes take the quantity together; they are always one unit.
  const pickedSizes = shapeSizes.filter((s) => picked.includes(s.id));
  const draftUnit = pickedSizes.length ? unitOf(pickedSizes[0]) : null;
  const repeat = draftUnit ? last[draftUnit] : undefined;
  // The panel's sizes, narrowed by whatever is typed in the size box.
  const suggestions = useMemo(
    () => (sizeText.trim() ? suggestSizes(shapeSizes, sizeText, 200) : shapeSizes),
    [sizeText, shapeSizes]
  );
  const split = new Set(shapeSizes.map(unitOf)).size > 1;
  // With sizes ticked in one unit, the other unit's group folds to its
  // heading -- they can't share the quantity anyway. "Show" opens it again.
  const pickedUnit = pickedSizes[0] ? unitOf(pickedSizes[0]) : null;
  const [shownUnit, setShownUnit] = useState<'ct' | 'pcs' | null>(null);
  useEffect(() => { if (!pickedUnit) setShownUnit(null); }, [pickedUnit]);

  // Select all / Unselect all for one group (one unit), leaving other units' picks off.
  function selectGroup(group: GridSize[]) {
    const ids = group.map((s) => s.id);
    const all = ids.length > 0 && ids.every((id) => picked.includes(id));
    const unit = group[0] ? unitOf(group[0]) : null;
    setPicked((cur) => all
      ? cur.filter((id) => !ids.includes(id))
      : [...new Set([...cur.filter((id) => { const s = shapeSizes.find((z) => z.id === id); return s && unitOf(s) === unit; }), ...ids])]);
    setError('');
  }
  function closePanel() {
    setPanelOpen(false);
    setPicked([]);
    setSizeText('');
    setAmountText('');
    setError('');
  }
  // Done keeps anything ticked with a quantity typed, so nothing is lost.
  function done() {
    if (picked.length && amountText.trim()) { if (!addDraft()) return; }
    else if (picked.length) { setError(`Type a quantity for the ${picked.length === 1 ? 'picked size' : `${picked.length} picked sizes`}, or Clear`); amountInput.current?.focus(); return; }
    closePanel();
  }

  function togglePick(id: number) {
    const unit = unitOf(shapeSizes.find((s) => s.id === id)!);
    // A size in the other unit starts a new pick: ct and pcs never share an amount.
    setPicked((cur) => (cur.includes(id) ? cur.filter((p) => p !== id)
      : [...cur.filter((p) => { const s = shapeSizes.find((z) => z.id === p); return s && unitOf(s) === unit; }), id]));
    setError('');
  }

  function set(id: number, value: string) {
    onEntries({ ...entries, [id]: value });
  }
  function remove(id: number) {
    const next = { ...entries };
    delete next[id];
    onEntries(next);
  }

  /** Gives the ticked sizes the typed quantity (or the last one again). */
  function addDraft(): boolean {
    if (!picked.length) { setError('Pick sizes first'); return false; }
    const typed = amountText.trim();
    if (typed && !/^\d+$/.test(typed)) { setError('Whole numbers only'); amountInput.current?.focus(); return false; }
    const amount = typed ? Number(typed) : repeat;
    if (!amount) { setError(`Type the ${draftUnit}${pickedSizes.length > 1 ? ` for all ${pickedSizes.length} sizes` : ''}`); amountInput.current?.focus(); return false; }
    const next = { ...entries };
    pickedSizes.forEach((s) => { next[s.id] = String(amount); });
    onEntries(next);
    if (draftUnit) setLast((cur) => ({ ...cur, [draftUnit]: amount }));
    setSizeText('');
    setAmountText('');
    setPicked([]);
    setError('');
    // The next set of sizes is a tap away; drop the keyboard.
    amountInput.current?.blur();
    return true;
  }

  function onSizeKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { done(); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // In the panel, typing finds sizes: Enter ticks the one match (or each
    // size of a typed list or range), then the quantity is next.
    const typed = sizeText.trim() ? resolveSizes(shapeSizes, sizeText) : null;
    const hits = typed && 'sizes' in typed ? typed.sizes : suggestions.length === 1 ? suggestions : [];
    if (hits.length) {
      hits.forEach((s) => { if (!picked.includes(s.id)) togglePick(s.id); });
      setSizeText('');
      setError('');
    } else if (sizeText.trim()) { setError(typed && 'error' in typed ? typed.error : 'No such size'); return; }
    amountInput.current?.focus();
  }

  const qtyControls = (
    <>
      <span className="po-sheet-amount">
        <input
          ref={amountInput}
          className="po-sheet-input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="done"
          placeholder={repeat ? String(repeat) : 'Qty'}
          aria-label={`Quantity${draftUnit ? ` (${draftUnit})` : ''}`}
          value={amountText}
          onChange={(e) => { setAmountText(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDraft(); } }}
        />
        <span className="po-sheet-unit">{draftUnit || ''}</span>
      </span>
      <button type="button" className="po-sheet-add" onClick={addDraft} disabled={!picked.length}>
        {picked.length > 1 ? `Add ${picked.length}` : 'Add'}
      </button>
    </>
  );

  return (
    <div className="po-grid">
      <div className="po-label" id="po-grid-shapes">Shape</div>
      <div className="po-grid-shapes" ref={strip} role="group" aria-labelledby="po-grid-shapes">
        {shapes.map((s) => {
          const count = countByShape.get(s.id) || 0;
          return (
            <button
              key={s.id}
              type="button"
              className={`po-grid-shape${s.id === shapeId ? ' active' : ''}`}
              aria-pressed={s.id === shapeId}
              onClick={() => onShape(s.id)}
            >
              <ShapeReferenceImage className="po-grid-shape-img" name={s.name} src={s.refPhotoUrl} iconKey={s.iconKey} fallbackSize={26} />
              <span className="po-grid-shape-name">{s.name}</span>
              {count > 0 && <span className="po-grid-shape-count" aria-label={`${count} sizes`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {shape && (
        <div className="po-grid-sheet">
          <div className="po-grid-sheet-head">
            <span>{shapeSizes.some((s) => s.pcs_per_ct) ? 'Under 3 mm in ct · 3 mm and above in pcs' : 'Quantity in pcs'}</span>
          </div>

          {/* While the panel is open its buttons show each quantity; the rows
              come back for editing after Done, so the panel never drifts down. */}
          {rows.length > 0 && !panelOpen && (
            <ul className="po-sheet-rows">
              {rows.map((s) => {
                const raw = entries[s.id] || '';
                const bad = !WHOLE.test(raw.trim());
                const n = bad ? 0 : Number(raw) || 0;
                return (
                  <li key={s.id} className={`po-sheet-row${bad ? ' is-invalid' : ''}`}>
                    <label className="po-sheet-size" htmlFor={`po-sheet-${s.id}`}>{s.size_mm}<span> mm</span></label>
                    <span className="po-sheet-amount">
                      <input
                        id={`po-sheet-${s.id}`}
                        className="po-sheet-input"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={raw}
                        aria-invalid={bad || undefined}
                        onChange={(e) => set(s.id, e.target.value)}
                        onBlur={(e) => { const v = e.target.value.trim(); if (!v || /^0+$/.test(v)) remove(s.id); }}
                      />
                      <span className="po-sheet-unit">{unitOf(s)}</span>
                    </span>
                    <span className="po-sheet-pcs">{bad ? 'Whole number' : s.pcs_per_ct && n > 0 ? `~${fmt(n * s.pcs_per_ct)} pcs` : ''}</span>
                    <button type="button" className="po-sheet-remove" aria-label={`Remove ${shape.name} ${s.size_mm} mm`} onClick={() => remove(s.id)}>×</button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* A button, not a text box: on a phone a text box brings up the
              keyboard over the very sizes the buyer wants to tap. */}
          {!panelOpen ? (
            <button type="button" className="po-sheet-open" aria-expanded="false" onClick={() => setPanelOpen(true)}>
              <span>{rows.length ? `+ Add more ${shape.name} sizes` : `Pick ${shape.name} sizes`}</span>
              <span aria-hidden="true">▾</span>
            </button>
          ) : (
            <div className="po-sheet-entry is-open" role="group" aria-label={`Find a ${shape.name} size`}>
              <input
                ref={sizeInput}
                className="po-sheet-input po-sheet-size-input"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint="next"
                placeholder="Find a size, e.g. 1.5 or 1.2-1.8"
                aria-label="Find a size"
                value={sizeText}
                onChange={(e) => { setSizeText(e.target.value); setError(''); }}
                onKeyDown={onSizeKey}
              />
            </div>
          )}

          {panelOpen && (
            <div className="po-sheet-suggest">
              <div className="po-sheet-suggest-head">
                <span>{picked.length ? `${picked.length} picked` : 'Tap the sizes you need'}</span>
                {!split && (
                  <button type="button" onClick={() => selectGroup(suggestions)}>
                    {suggestions.length > 0 && suggestions.every((s) => picked.includes(s.id)) ? 'Unselect all' : 'Select all'}
                  </button>
                )}
                {picked.length > 0 && <button type="button" onClick={() => { setPicked([]); setError(''); }}>Clear</button>}
                <button type="button" className="po-sheet-suggest-done" onClick={done}>Done</button>
              </div>
              <div className="po-sheet-suggest-body">
                {/* Round mixes ct sizes and pcs sizes: one group each, so one
                    amount is never shared across the two units. */}
                {(['ct', 'pcs'] as const).map((unit) => {
                  const group = suggestions.filter((s) => unitOf(s) === unit);
                  if (!group.length) return null;
                  const all = group.every((s) => picked.includes(s.id));
                  const folded = split && !!pickedUnit && pickedUnit !== unit && shownUnit !== unit;
                  return (
                    <div key={unit} className={`po-sheet-suggest-group${folded ? ' is-folded' : ''}`}>
                      {split && (
                        <div className="po-sheet-suggest-group-head">
                          {/* Once a ct size has a quantity its button shows "40ct (~2,560)":
                              the heading says the bracket is pieces, not a price. */}
                          <span>{unit === 'ct'
                            ? `Under 3 mm · ct${group.some((z) => (entries[z.id] || '').trim()) ? ' (~pcs)' : ''}`
                            : '3 mm and above · pcs'}</span>
                          {folded
                            ? <button type="button" aria-expanded="false" onClick={() => setShownUnit(unit)}>Show {group.length}</button>
                            : <button type="button" onClick={() => selectGroup(group)}>{all ? 'Unselect all' : 'Select all'}</button>}
                        </div>
                      )}
                      {!folded && <>
                      <div className="po-sheet-suggest-list" role="listbox" aria-multiselectable="true" aria-label={`${shape.name} sizes${split ? ` in ${unit}` : ''}`}>
                        {group.map((s) => {
                          const has = entries[s.id] !== undefined && entries[s.id] !== '';
                          return (
                            <button
                              key={s.id}
                              type="button"
                              role="option"
                              aria-selected={picked.includes(s.id)}
                              className={`${picked.includes(s.id) ? 'is-picked' : ''}${has ? ' is-added' : ''}`}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => togglePick(s.id)}
                            >
                              {s.size_mm}
                              {has && <small>{s.pcs_per_ct && /^\d+$/.test(entries[s.id].trim())
                                ? `${entries[s.id]}ct (~${fmt(Number(entries[s.id]) * s.pcs_per_ct)})`
                                : `${entries[s.id]} ${unit}`}</small>}
                            </button>
                          );
                        })}
                      </div>
                      </>}
                    </div>
                  );
                })}
                {suggestions.length === 0 && <p className="po-sheet-suggest-empty">No {shape.name} size starts with &ldquo;{sizeText}&rdquo;</p>}
              </div>
              <div className="po-sheet-suggest-foot">{qtyControls}</div>
            </div>
          )}
          {/* Sizes can be added one at a time or several together; only when
              several are ticked is there something to explain. */}
          {error
            ? <p className="po-sheet-error" role="alert">{error}</p>
            : pickedSizes.length > 1
            ? <p className="po-sheet-help">Apply this qty to all {pickedSizes.length} sizes selected — you can update this later.</p>
            : null}
        </div>
      )}

    </div>
  );
}
