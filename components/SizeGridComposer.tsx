'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import ShapeReferenceImage from './ShapeReferenceImage';
import { parseOrderText, resolveSizes, sortSizes, suggestSizes } from '@/lib/quick-order';

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
 * Moissanite quick order sheet. Buyers write orders in a notebook -- a shape,
 * then "size -> amount" lines -- so the sheet works the same way: type a size
 * (110 = 1.10 mm, ranges like 1.2-1.8), the amount, Enter, next line. An
 * empty amount repeats the last one. Round under 3 mm is in ct, everything
 * else in pcs. A whole order can also be pasted as text. Lines stay put when
 * switching shape (the shape tiles count them) and are added in one go.
 */
export default function SizeGridComposer({
  shapes,
  sizes,
  entries,
  onEntries,
  shapeId,
  onShape,
}: {
  shapes: ShapeRef[];
  sizes: GridSize[];
  entries: GridEntries;
  onEntries: (next: GridEntries) => void;
  shapeId: number | null;
  onShape: (id: number) => void;
}) {
  const [sizeText, setSizeText] = useState('');
  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState('');
  // The size panel: opens from the size box and stays open while sizes are
  // ticked (a tap on a phone blurs the box), closing on a tap elsewhere.
  const [panelOpen, setPanelOpen] = useState(false);
  const entryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!panelOpen) return;
    const close = (e: PointerEvent) => { if (!entryRef.current?.contains(e.target as Node)) setPanelOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [panelOpen]);
  // Sizes ticked in the size panel, to take one quantity together.
  const [picked, setPicked] = useState<number[]>([]);
  // The last amount entered per unit, repeated when the amount is left empty.
  const [last, setLast] = useState<{ ct?: number; pcs?: number }>({});
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteNote, setPasteNote] = useState<{ added: number; problems: string[] } | null>(null);
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
  const countByShape = useMemo(() => {
    const m = new Map<number, number>();
    sizes.forEach((s) => { if (entries[s.id] !== undefined) m.set(s.shape_id, (m.get(s.shape_id) || 0) + 1); });
    return m;
  }, [sizes, entries]);
  const shape = shapes.find((s) => s.id === shapeId) || null;

  // What the entry line stands for: the ticked sizes, else what is typed
  // ("1.1", "3, 3.5, 4", "1.2-1.8"). With sizes ticked, typing only filters
  // the panel.
  const pickedSizes = shapeSizes.filter((s) => picked.includes(s.id));
  const draft = useMemo(
    () => (picked.length || !sizeText.trim() ? null : resolveSizes(shapeSizes, sizeText)),
    [shapeSizes, sizeText, picked.length]
  );
  const draftSizes = picked.length ? pickedSizes : draft && 'sizes' in draft ? draft.sizes : [];
  const mixedUnits = draftSizes.length > 0 && !draftSizes.every((s) => unitOf(s) === unitOf(draftSizes[0]));
  const draftUnit = draftSizes.length && !mixedUnits ? unitOf(draftSizes[0]) : null;
  const repeat = draftUnit ? last[draftUnit] : undefined;
  const suggestions = useMemo(() => {
    if (!panelOpen) return [];
    if (!sizeText.trim()) return shapeSizes;
    if (picked.length) return suggestSizes(shapeSizes, sizeText, 200);
    const hits = suggestSizes(shapeSizes, sizeText, 200);
    // Nothing to offer once the box already holds exactly that one size.
    return hits.length === 1 && draftSizes.length === 1 && hits[0].id === draftSizes[0].id ? [] : hits;
  }, [panelOpen, sizeText, shapeSizes, draftSizes, picked.length]);

  function togglePick(id: number) {
    const unit = unitOf(shapeSizes.find((s) => s.id === id)!);
    // A size in the other unit starts a new pick: ct and pcs never share an amount.
    setPicked((cur) => (cur.includes(id) ? cur.filter((p) => p !== id)
      : [...cur.filter((p) => { const s = shapeSizes.find((z) => z.id === p); return s && unitOf(s) === unit; }), id]));
    setSizeText('');
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

  function addDraft() {
    if (!picked.length) {
      if (!sizeText.trim()) { sizeInput.current?.focus(); return; }
      if (!draft || 'error' in draft) { setError(draft && 'error' in draft ? draft.error : 'Type a size'); sizeInput.current?.focus(); return; }
    }
    if (mixedUnits) { setError('Sizes under 3 mm are in ct and the rest in pcs — add them separately'); return; }
    const typed = amountText.trim();
    if (typed && !/^\d+$/.test(typed)) { setError('Whole numbers only'); amountInput.current?.focus(); return; }
    const amount = typed ? Number(typed) : repeat;
    if (!amount) { setError(`Type the ${draftUnit || 'amount'}${draftSizes.length > 1 ? ` for all ${draftSizes.length} sizes` : ''}`); amountInput.current?.focus(); return; }
    const next = { ...entries };
    draftSizes.forEach((s) => { next[s.id] = String(amount); });
    onEntries(next);
    const units = new Set(draftSizes.map(unitOf));
    setLast((cur) => ({ ...cur, ...(units.has('ct') ? { ct: amount } : {}), ...(units.has('pcs') ? { pcs: amount } : {}) }));
    setSizeText('');
    setAmountText('');
    setPicked([]);
    setError('');
    // Ready for the next line, without the size panel covering the page.
    sizeInput.current?.focus();
    setPanelOpen(false);
  }

  function onSizeKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setPanelOpen(false); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (picked.length) {
      // Filtering the ticked list: Enter ticks the one match, else moves on.
      if (sizeText.trim() && suggestions.length === 1) { togglePick(suggestions[0].id); return; }
      setPanelOpen(false);
      amountInput.current?.focus();
      return;
    }
    // A partly typed size with one match takes it, like picking from a list.
    if (draftSizes.length === 0 && suggestions.length === 1) setSizeText(suggestions[0].size_mm);
    else if (!draft || 'error' in draft) { if (draft && 'error' in draft) setError(draft.error); return; }
    setError('');
    setPanelOpen(false);
    amountInput.current?.focus();
  }

  function readPaste() {
    const r = parseOrderText(pasteText, shapes, sizes, shapeId);
    if (r.lines.length) {
      const next = { ...entries };
      r.lines.forEach((l) => { next[l.sizeId] = String(l.amount); });
      onEntries(next);
      const lastShape = r.lines[r.lines.length - 1].shapeId;
      if (lastShape !== shapeId) onShape(lastShape);
    }
    setPasteNote({ added: r.lines.length, problems: r.problems });
    if (!r.problems.length && r.lines.length) { setPasteText(''); setPasteOpen(false); }
    else if (r.lines.length) setPasteText(r.rejected.join('\n'));
  }

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
            <strong>Pick the sizes you need for {shape.name} shape</strong>
            <span>{shapeSizes.some((s) => s.pcs_per_ct) ? 'Under 3 mm in ct · 3 mm and above in pcs' : 'Quantity in pcs'}</span>
          </div>

          {rows.length > 0 && (
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

          <div className="po-sheet-entry" ref={entryRef} role="group" aria-label={`Add ${shape.name} sizes`}>
            <span className="po-sheet-entry-size">
              <input
                ref={sizeInput}
                className="po-sheet-input"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint="next"
                placeholder={picked.length ? `${picked.length} picked` : 'Size'}
                aria-label="Size (mm)"
                aria-expanded={panelOpen}
                value={sizeText}
                onFocus={() => setPanelOpen(true)}
                onClick={() => setPanelOpen(true)}
                onChange={(e) => { setSizeText(e.target.value); setError(''); setPanelOpen(true); }}
                onKeyDown={onSizeKey}
              />
              {panelOpen && suggestions.length > 0 && (
                <span className="po-sheet-suggest">
                  <span className="po-sheet-suggest-head">
                    <span>Tap sizes{picked.length ? ` · ${picked.length} picked` : ''}</span>
                    {picked.length > 0 && (
                      <button type="button" onClick={() => { setPicked([]); setError(''); }}>Clear</button>
                    )}
                    {picked.length > 0 && (
                      <button type="button" className="po-sheet-suggest-done" onClick={() => { setPanelOpen(false); amountInput.current?.focus(); }}>Done</button>
                    )}
                  </span>
                  <span className="po-sheet-suggest-body">
                    {/* Round mixes ct sizes and pcs sizes: one group each, so one
                        amount is never shared across the two units. */}
                    {(['ct', 'pcs'] as const).map((unit) => {
                      const group = suggestions.filter((s) => unitOf(s) === unit);
                      if (!group.length) return null;
                      const ids = group.map((s) => s.id);
                      const all = ids.every((id) => picked.includes(id));
                      const split = suggestions.some((s) => unitOf(s) !== unit);
                      return (
                        <span key={unit} className="po-sheet-suggest-group">
                          <span className="po-sheet-suggest-group-head">
                            <span>{split ? (unit === 'ct' ? 'Under 3 mm · ct' : '3 mm and above · pcs') : ''}</span>
                            <button
                              type="button"
                              onClick={() => {
                                // Ticking one unit's sizes clears the other unit's.
                                setPicked((cur) => all
                                  ? cur.filter((id) => !ids.includes(id))
                                  : [...new Set([...cur.filter((id) => { const s = shapeSizes.find((z) => z.id === id); return s && unitOf(s) === unit; }), ...ids])]);
                                setSizeText('');
                                setError('');
                              }}
                            >
                              {all ? 'Unselect all' : sizeText.trim() ? 'Select these' : 'Select all'}
                            </button>
                          </span>
                          <span className="po-sheet-suggest-list" role="listbox" aria-multiselectable="true" aria-label={`${shape.name} sizes${split ? ` in ${unit}` : ''}`}>
                            {group.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                role="option"
                                aria-selected={picked.includes(s.id)}
                                className={`${picked.includes(s.id) ? 'is-picked' : ''}${entries[s.id] !== undefined ? ' is-added' : ''}`}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => togglePick(s.id)}
                              >
                                {s.size_mm}
                              </button>
                            ))}
                          </span>
                        </span>
                      );
                    })}
                  </span>
                </span>
              )}
            </span>
            <span className="po-sheet-amount">
              <input
                ref={amountInput}
                className="po-sheet-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="done"
                placeholder={repeat ? String(repeat) : 'Qty'}
                aria-label={`Amount${draftUnit ? ` (${draftUnit})` : ''}`}
                value={amountText}
                onFocus={() => setPanelOpen(false)}
                onChange={(e) => { setAmountText(e.target.value); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDraft(); } }}
              />
              <span className="po-sheet-unit">{draftUnit || ''}</span>
            </span>
            <button type="button" className="po-sheet-add" onClick={addDraft}>Add</button>
          </div>
          {error
            ? <p className="po-sheet-error" role="alert">{error}</p>
            : <p className="po-sheet-help">
                {mixedUnits
                  ? 'Sizes under 3 mm are in ct and the rest in pcs — add them separately'
                  : draftSizes.length > 1
                  ? `${draftSizes.length} sizes picked — one ${draftUnit} amount for all; change any line after`
                  : repeat
                  ? `Enter adds the line · empty amount = ${repeat} ${draftUnit} again`
                  : 'Tap Size to pick one or many sizes, then one amount for all'}
              </p>}

          <button type="button" className="po-sheet-paste-toggle" aria-expanded={pasteOpen} onClick={() => { setPasteOpen((o) => !o); setPasteNote(null); }}>
            {pasteOpen ? 'Close list' : 'Paste or type a whole list'}
          </button>
          {pasteOpen && (
            <div className="po-sheet-paste">
              <textarea
                rows={6}
                aria-label="Order list"
                placeholder={'Round\n1.00 30\n1.10 70\n1.2-1.8 100\nPear\n2.5x4 300'}
                value={pasteText}
                onChange={(e) => { setPasteText(e.target.value); setPasteNote(null); }}
              />
              <button type="button" className="po-sheet-add" onClick={readPaste} disabled={!pasteText.trim()}>Read list</button>
            </div>
          )}
          {pasteNote && (
            <div className="po-sheet-paste-note" role="status">
              {pasteNote.added > 0 && <p>Added {pasteNote.added} {pasteNote.added === 1 ? 'line' : 'lines'} from your list.</p>}
              {pasteNote.problems.length > 0 && (
                <>
                  <p>Not added — please check:</p>
                  <ul>{pasteNote.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
                </>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
