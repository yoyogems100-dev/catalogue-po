'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import ShapeIcon from '@/components/ShapeIcon';
import ColorSwatch from '@/components/ColorSwatch';
import { searchOptions } from '@/lib/option-search';
import { sizeSearchScore } from '@/lib/size-options';
import { sameSizeKey, shapeSizeLabel, sizeDims } from '@/lib/size-label';
import { sizeFitsShape, ROUND_SIZE_MESSAGE } from '@/lib/shape-size-fit';

export type AddKind = 'shape' | 'color' | 'size';
type Shape = { id: number; name: string; iconKey?: string | null; refPhotoUrl?: string | null };
type Color = { id: number; name: string; hex: string | null; refPhotoUrl?: string | null };
type SizeRow = { id: number; shapeId: number; sizeMm: string; linked: boolean };

/**
 * "+ Add" from the admin order builder's Shape, Color or Size list: shows
 * what this category already has and what can be added, and adds the one the
 * buyer asked for. Sizes are added per shape -- 2.5 for Round is a different
 * stone from 2.5 for Heart.
 */
export default function AddOptionDialog({
  kind: startKind, categoryId, categoryName, typed, categoryShapes, pickedShapeIds, onClose, onAdded
}: {
  kind: AddKind;
  categoryId: number;
  categoryName: string;
  typed: string;
  /** Shapes already on the category -- the size tab adds to one of these. */
  categoryShapes: Shape[];
  pickedShapeIds: number[];
  onClose: () => void;
  /** After each add, so the builder can reload the lists and pick what was added. */
  onAdded: (kind: AddKind, id: number, extra?: { shape?: Shape }) => Promise<void> | void;
}) {
  const [kind, setKind] = useState<AddKind>(startKind);
  const [query, setQuery] = useState(typed);
  const [shapes, setShapes] = useState<Shape[] | null>(null);
  const [colors, setColors] = useState<Color[] | null>(null);
  const [sizes, setSizes] = useState<SizeRow[] | null>(null);
  const [extraShapes, setExtraShapes] = useState<Shape[]>([]);
  const allShapes = useMemo(() => [...categoryShapes, ...extraShapes.filter((s) => !categoryShapes.some((c) => c.id === s.id))], [categoryShapes, extraShapes]);
  const [sizeShapeId, setSizeShapeId] = useState<number | null>(pickedShapeIds[0] ?? categoryShapes[0]?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // What can be added: loaded once per tab (and per shape for sizes).
  useEffect(() => {
    setError('');
    const url = kind === 'size'
      ? (sizeShapeId ? `/api/admin/categories/${categoryId}/add-option?kind=size&shapeIds=${sizeShapeId}` : null)
      : `/api/admin/categories/${categoryId}/add-option?kind=${kind}`;
    if (!url) { setSizes([]); return; }
    if (kind === 'shape' && shapes) return;
    if (kind === 'color' && colors) return;
    if (kind === 'size') setSizes(null);
    let live = true;
    fetch(url).then((r) => r.json()).then((data) => {
      if (!live) return;
      if (data.error) { setError(data.error); return; }
      if (kind === 'shape') setShapes(data.shapes || []);
      else if (kind === 'color') setColors(data.colors || []);
      else setSizes(data.sizes || []);
    }).catch(() => live && setError('Could not load the list. Check your connection and try again.'));
    return () => { live = false; };
  }, [kind, categoryId, sizeShapeId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function add(body: Record<string, unknown>, label: string) {
    setBusy(label);
    setError('');
    const res = await fetch(`/api/admin/categories/${categoryId}/add-option`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setBusy(null); setError(data.error || 'Could not add it.'); return null; }
    setDone((d) => [...d, label]);
    return data as { id: number; created?: boolean };
  }

  async function addShape(shape: Shape) {
    const data = await add({ kind: 'shape', id: shape.id }, shape.name);
    if (!data) return;
    setShapes((list) => (list || []).filter((s) => s.id !== shape.id));
    setExtraShapes((list) => [...list, shape]);
    await onAdded('shape', shape.id, { shape });
    setBusy(null);
    // A shape is only orderable with sizes, so go straight on to its sizes.
    setSizeShapeId(shape.id);
    setQuery('');
    setKind('size');
  }

  async function addColor(color: Color) {
    const data = await add({ kind: 'color', id: color.id }, color.name);
    if (!data) return;
    setColors((list) => (list || []).filter((c) => c.id !== color.id));
    await onAdded('color', color.id);
    setBusy(null);
  }

  async function addSize(sizeMm: string) {
    if (!sizeShapeId) return;
    const shape = allShapes.find((s) => s.id === sizeShapeId);
    const data = await add({ kind: 'size', shapeId: sizeShapeId, sizeMm }, `${shape?.name || 'Shape'} ${shapeSizeLabel(shape?.name, sizeMm)}`);
    if (!data) return;
    setSizes((list) => {
      const rest = (list || []).filter((s) => s.id !== data.id);
      return [...rest, { id: data.id, shapeId: sizeShapeId, sizeMm, linked: true }];
    });
    await onAdded('size', data.id, { shape });
    setBusy(null);
    setQuery('');
  }

  const q = query.trim();
  const sizeShape = allShapes.find((s) => s.id === sizeShapeId) || null;
  const shapeList = useMemo(() => (shapes ? (q ? searchOptions(shapes, q, false) : shapes) : null), [shapes, q]);
  const colorList = useMemo(() => (colors ? (q ? searchOptions(colors, q, true) : colors) : null), [colors, q]);
  const sortedSizes = useMemo(() => {
    const byDims = (a: SizeRow, b: SizeRow) => {
      const da = sizeDims(a.sizeMm) || [Infinity], db = sizeDims(b.sizeMm) || [Infinity];
      for (let i = 0; i < Math.max(da.length, db.length); i++) if ((da[i] ?? 0) !== (db[i] ?? 0)) return (da[i] ?? 0) - (db[i] ?? 0);
      return 0;
    };
    // Everything the shape already has stays listed; only the ones to add narrow as you type.
    const all = [...(sizes || [])].sort(byDims);
    return { linked: all.filter((s) => s.linked), addable: all.filter((s) => !s.linked && (!q || sizeSearchScore(q, s.sizeMm) > 0)) };
  }, [sizes, q]);
  // The typed size, offered as its own button when it is a real size that the
  // shape doesn't carry in this category yet.
  const typedSize = q.replace(/\s*mm\s*$/i, '').replace(/\s*[×*X/]\s*/g, 'x');
  const typedValid = !!sizeDims(typedSize);
  const typedFits = typedValid && sizeFitsShape(sizeShape?.name, typedSize);
  const typedLinked = typedValid && (sizes || []).some((s) => s.linked && sameSizeKey(s.sizeMm) === sameSizeKey(typedSize));

  const tabs: { kind: AddKind; label: string }[] = [{ kind: 'shape', label: 'Shape' }, { kind: 'size', label: 'Size' }, { kind: 'color', label: 'Color' }];

  return createPortal(
    <div className="pl-backdrop" onClick={onClose}>
      <div className="pl-dialog ao-dialog" role="dialog" aria-modal="true" aria-labelledby="ao-title" onClick={(e) => e.stopPropagation()}>
        <header className="pl-head">
          <h2 id="ao-title">Add to {categoryName}</h2>
          <button type="button" className="pl-close" aria-label="Close" onClick={onClose}>×</button>
        </header>
        <div className="pl-body">
          <div className="po-type-toggle ao-tabs" role="tablist" aria-label="What to add">
            {tabs.map((t) => (
              <button key={t.kind} type="button" role="tab" aria-selected={kind === t.kind} className={kind === t.kind ? 'active' : ''} onClick={() => { if (t.kind !== kind) setQuery(''); setKind(t.kind); setError(''); }}>{t.label}</button>
            ))}
          </div>

          {kind === 'size' && (
            <div className="ao-shape-pick">
              <span className="po-label">Size for which shape?</span>
              {allShapes.length === 0 ? (
                <p className="pl-hint">This category has no shapes yet. Add a shape first.</p>
              ) : (
                <div className="ao-chips" role="radiogroup" aria-label="Shape">
                  {allShapes.map((s) => (
                    <button key={s.id} type="button" role="radio" aria-checked={s.id === sizeShapeId} className={`ao-chip${s.id === sizeShapeId ? ' active' : ''}`} onClick={() => setSizeShapeId(s.id)}>
                      <ShapeIcon iconKey={s.iconKey} size={18} /> {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <input
            type="text"
            className="ao-search"
            inputMode={kind === 'size' ? 'decimal' : undefined}
            placeholder={kind === 'size' ? 'Type a size, e.g. 2.5 or 6x8' : kind === 'shape' ? 'Search shapes…' : 'Search colors…'}
            aria-label={kind === 'size' ? 'Size' : `Search ${kind}s`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />

          {error && <p className="po-field-error" role="alert">{error}</p>}
          {done.length > 0 && <p className="pl-added" role="status">Added: {done.join(', ')}</p>}

          {kind === 'shape' && (
            shapeList === null ? <p className="pl-hint">Loading shapes…</p> : (
              <>
                <p className="ao-section">Not in {categoryName} yet{q ? ` · matching “${q}”` : ''}</p>
                {shapeList.length === 0 ? <p className="pl-hint">{q ? `No shape called “${q}”. New shapes are made in Admin › Shapes.` : 'Every shape is already in this category.'}</p> : (
                  <ul className="ao-list">
                    {shapeList.map((s) => (
                      <li key={s.id}>
                        <ShapeIcon iconKey={s.iconKey} size={22} />
                        <span>{s.name}</span>
                        <button type="button" className="ao-add" disabled={!!busy} onClick={() => addShape(s)}>{busy === s.name ? 'Adding…' : '+ Add'}</button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )
          )}

          {kind === 'color' && (
            colorList === null ? <p className="pl-hint">Loading colors…</p> : (
              <>
                <p className="ao-section">Not in {categoryName} yet{q ? ` · matching “${q}”` : ''}</p>
                {colorList.length === 0 ? <p className="pl-hint">{q ? `No color called “${q}”. New colors are made in Admin › Colors.` : 'Every color is already in this category.'}</p> : (
                  <ul className="ao-list">
                    {colorList.slice(0, 80).map((c) => (
                      <li key={c.id}>
                        <ColorSwatch hex={c.hex || '#ccc'} refPhotoUrl={c.refPhotoUrl} size={22} />
                        <span>{c.name}</span>
                        <button type="button" className="ao-add" disabled={!!busy} onClick={() => addColor(c)}>{busy === c.name ? 'Adding…' : '+ Add'}</button>
                      </li>
                    ))}
                  </ul>
                )}
                {colorList.length > 80 && <p className="pl-hint">Showing 80 of {colorList.length} — type to narrow down.</p>}
              </>
            )
          )}

          {kind === 'size' && sizeShape && (
            sizes === null ? <p className="pl-hint">Loading {sizeShape.name} sizes…</p> : (
              <>
                {typedValid && !typedLinked && (
                  typedFits ? (
                    <button type="button" className="po-add-line-btn ao-typed" disabled={!!busy} onClick={() => addSize(typedSize)}>
                      {busy ? 'Adding…' : `+ Add ${shapeSizeLabel(sizeShape.name, typedSize)} to ${sizeShape.name}`}
                    </button>
                  ) : <p className="po-field-error" role="alert">{ROUND_SIZE_MESSAGE}</p>
                )}
                {typedLinked && <p className="pl-hint">{sizeShape.name} {shapeSizeLabel(sizeShape.name, typedSize)} is already in this category — pick it from the Size list.</p>}

                <p className="ao-section">{sizeShape.name} sizes you can add{q ? ` · matching “${q}”` : ''}</p>
                {sortedSizes.addable.length === 0 ? <p className="pl-hint">{q ? (typedValid && typedFits && !typedLinked ? 'None match — use the button above to add it as a new size.' : 'None match what you typed.') : `Every known ${sizeShape.name} size is already here. Type a new one above.`}</p> : (
                  <div className="ao-sizes">
                    {sortedSizes.addable.map((s) => (
                      <button key={s.id} type="button" className="ao-size" disabled={!!busy} onClick={() => addSize(s.sizeMm)}>+ {shapeSizeLabel(sizeShape.name, s.sizeMm)}</button>
                    ))}
                  </div>
                )}

                <p className="ao-section">Already in {categoryName} ({sortedSizes.linked.length})</p>
                {sortedSizes.linked.length === 0 ? <p className="pl-hint">No {sizeShape.name} sizes yet.</p> : (
                  <div className="ao-sizes">
                    {sortedSizes.linked.map((s) => <span key={s.id} className="ao-size ao-size--in">{shapeSizeLabel(sizeShape.name, s.sizeMm)}</span>)}
                  </div>
                )}
              </>
            )
          )}
        </div>
        <footer className="pl-foot">
          <span className="ao-foot-note">Adds to {categoryName} for every buyer. Nothing is removed.</span>
          <button type="button" className="btn-ghost" onClick={onClose}>Done</button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
