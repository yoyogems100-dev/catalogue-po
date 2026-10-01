'use client';

import { useEffect, useMemo, useRef } from 'react';
import IconSelect from './IconSelect';
import ShapeReferenceImage from './ShapeReferenceImage';

type ShapeRef = { id: number; name: string; iconKey?: string | null; refPhotoUrl?: string | null };
/** pcs_per_ct: set on sizes sold by carat (Moissanite melee) -- pieces in 1 ct. */
export type GridSize = { id: number; shape_id: number; size_mm: string; pcs_per_ct?: number | null };
/** What the buyer typed per size id: carats for sizes sold by weight, else pieces. */
export type GridEntries = Record<number, string>;

/** A size entry that will become an order line: whole carats or whole pieces. */
export type GridLine = { size: GridSize; shape: ShapeRef; amount: number; pcs: number };

const WHOLE = /^\d*$/;

// "0.7" < "1" < "3x5" < "10": by the first number, then the second.
function sizeOrder(a: string, b: string) {
  const pa = a.split(/[x×*]/i).map(parseFloat);
  const pb = b.split(/[x×*]/i).map(parseFloat);
  return (pa[0] || 0) - (pb[0] || 0) || (pa[1] || 0) - (pb[1] || 0) || a.localeCompare(b);
}

/** Entries that are filled in with a whole number above zero, in shape then size order. */
export function gridLines(shapes: ShapeRef[], sizes: GridSize[], entries: GridEntries): GridLine[] {
  const lines: GridLine[] = [];
  for (const shape of shapes) {
    sizes
      .filter((s) => s.shape_id === shape.id)
      .sort((a, b) => sizeOrder(a.size_mm, b.size_mm))
      .forEach((size) => {
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

/**
 * Moissanite ordering: choose a shape from its photo, pick the sizes wanted
 * from its size dropdown, and each picked size opens as a card taking its own
 * weight (ct, melee under 3 mm) or pieces. Picks survive switching shape, so
 * one requirement can carry Round 0.7 mm 20 ct, Round 1 mm 100 ct and Oval
 * 4x6 50 pcs, all listed under the cards and added in one go.
 */
export default function SizeGridComposer({
  categoryId,
  shapes,
  sizes,
  picked,
  onPicked,
  entries,
  onEntries,
  shapeId,
  onShape,
}: {
  categoryId: number;
  shapes: ShapeRef[];
  sizes: GridSize[];
  /** Size ids opened as cards, across every shape. */
  picked: number[];
  onPicked: (next: number[]) => void;
  entries: GridEntries;
  onEntries: (next: GridEntries) => void;
  shapeId: number | null;
  onShape: (id: number) => void;
}) {
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

  const shapeSizes = useMemo(
    () => sizes.filter((s) => s.shape_id === shapeId).sort((a, b) => sizeOrder(a.size_mm, b.size_mm)),
    [sizes, shapeId]
  );
  const sizeOptions = useMemo(() => shapeSizes.map((s) => ({ id: s.id, name: `${s.size_mm} mm` })), [shapeSizes]);
  const shown = shapeSizes.filter((s) => picked.includes(s.id));
  const byWeight = shown.filter((s) => s.pcs_per_ct);
  const byPieces = shown.filter((s) => !s.pcs_per_ct);

  // Unpicking a size drops what was typed against it.
  function pickSizes(ids: number[]) {
    const mine = new Set(shapeSizes.map((s) => s.id));
    const next = [...picked.filter((id) => !mine.has(id)), ...ids];
    onPicked(next);
    const keep = new Set(next);
    if (Object.keys(entries).some((id) => !keep.has(Number(id)))) {
      onEntries(Object.fromEntries(Object.entries(entries).filter(([id]) => keep.has(Number(id)))));
    }
  }
  function remove(id: number) {
    onPicked(picked.filter((p) => p !== id));
    set(id, '');
  }

  const lines = useMemo(() => gridLines(shapes, sizes, entries), [shapes, sizes, entries]);
  const countByShape = useMemo(() => {
    const m = new Map<number, number>();
    sizes.forEach((s) => { if (picked.includes(s.id)) m.set(s.shape_id, (m.get(s.shape_id) || 0) + 1); });
    return m;
  }, [sizes, picked]);
  const shape = shapes.find((s) => s.id === shapeId) || null;

  function set(id: number, value: string) {
    const next = { ...entries };
    if (value.trim()) next[id] = value; else delete next[id];
    onEntries(next);
  }

  function cell(size: GridSize) {
    const raw = entries[size.id] || '';
    const bad = !WHOLE.test(raw.trim());
    const n = bad ? 0 : Number(raw.trim()) || 0;
    const rate = size.pcs_per_ct || null;
    const id = `po-grid-${size.id}`;
    return (
      <div key={size.id} className={`po-grid-cell${n > 0 ? ' is-filled' : ''}${bad ? ' is-invalid' : ''}`}>
        <div className="po-grid-cell-head">
          <label htmlFor={id} className="po-grid-size">
            {size.size_mm}<span> mm</span>
          </label>
          <button type="button" className="po-grid-cell-remove" aria-label={`Remove ${size.size_mm} mm`} onClick={() => remove(size.id)}>×</button>
        </div>
        <div className="po-grid-input">
          <input
            id={id}
            className="po-grid-qty"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={raw}
            aria-invalid={bad || undefined}
            aria-describedby={bad || rate ? `${id}-hint` : undefined}
            onChange={(e) => set(size.id, e.target.value)}
          />
          <span className="po-grid-unit">{rate ? 'ct' : 'pcs'}</span>
        </div>
        {(bad || rate) && (
          <span className="po-grid-hint" id={`${id}-hint`}>
            {bad ? 'Whole number' : n > 0 ? `~${fmt(n * rate!)} pcs` : `1ct = ~${rate} pcs`}
          </span>
        )}
      </div>
    );
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
              {count > 0 && <span className="po-grid-shape-count" aria-label={`${count} sizes picked`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {!shape ? (
        <p className="po-grid-empty">Choose a shape to see its sizes.</p>
      ) : (
        <div className="po-grid-sheet">
          <label className="po-label" id="po-grid-sizes-label">{shape.name} sizes (mm)</label>
          <IconSelect
            categoryId={categoryId}
            multiple
            optionKind="size"
            options={sizeOptions}
            values={shown.map((s) => s.id)}
            onChange={pickSizes}
            placeholder={`Choose ${shape.name} size(s)`}
          />
          {byWeight.length > 0 && (
            <>
              <p className="po-grid-group">Under 3 mm · weight (ct)</p>
              <div className="po-grid-cells">{byWeight.map(cell)}</div>
            </>
          )}
          {byPieces.length > 0 && (
            <>
              <p className="po-grid-group">{byWeight.length > 0 ? '3 mm and above · pieces' : 'Pieces'}</p>
              <div className="po-grid-cells">{byPieces.map(cell)}</div>
            </>
          )}
          {shown.length === 0 && <p className="po-grid-empty">Pick the sizes you need — each opens here for its own ct or pcs.</p>}
        </div>
      )}

      {lines.length > 0 && (
        <div className="po-grid-picks" aria-live="polite">
          <div className="po-grid-picks-head">
            <span>Your selection · {lines.length} {lines.length === 1 ? 'size' : 'sizes'}</span>
            <button type="button" onClick={() => { onEntries({}); onPicked([]); }}>Clear all</button>
          </div>
          <ul>
            {lines.map((l) => (
              <li key={l.size.id}>
                <button type="button" className="po-grid-pick-name" onClick={() => onShape(l.shape.id)}>
                  {l.shape.name} {l.size.size_mm} mm
                </button>
                <span className="po-grid-pick-qty">
                  {l.size.pcs_per_ct ? <>{fmt(l.amount)} ct <small>~{fmt(l.pcs)} pcs</small></> : <>{fmt(l.amount)} pcs</>}
                </span>
                <button type="button" className="po-grid-pick-remove" aria-label={`Remove ${l.shape.name} ${l.size.size_mm} mm`} onClick={() => remove(l.size.id)}>×</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
