'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { HotMark, useHotSelling } from './HotSelling';
import { isHot, rankOptions } from '@/lib/hot-selling';
import ShapeIcon from './ShapeIcon';

type Ref = { id: number; name: string };
type ShapeRef = Ref & { iconKey?: string | null };
type Size = { id: number; shape_id: number; size_mm: string; weight_ct: number | null };

export default function ShapeSizeSelect({
  allShapes,
  allSizes,
  linkedShapeIds,
  linkedSizeIds,
  onToggleShape,
  onToggleSize,
  onBulkSizes
}: {
  allShapes: ShapeRef[];
  allSizes: Size[];
  linkedShapeIds: number[];
  linkedSizeIds: number[];
  onToggleShape: (id: number, currentlySelected: boolean) => void | Promise<void>;
  onToggleSize: (id: number, currentlySelected: boolean) => void | Promise<void>;
  onBulkSizes: (shapeId: number, sizeIds: number[]) => void;
}) {
  const { flags, ready } = useHotSelling();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [shapeOrder, setShapeOrder] = useState<number[]>([]);
  const [sizeOrder, setSizeOrder] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [expandedShapeId, setExpandedShapeId] = useState<number | null>(null);
  const [rangeMin, setRangeMin] = useState('');
  const [rangeMax, setRangeMax] = useState('');

  // Local optimistic copies so clicks reflect instantly instead of waiting on
  // a server round-trip + page refresh -- fixes selections that appeared "stuck".
  const [localShapeIds, setLocalShapeIds] = useState<number[]>(linkedShapeIds);
  const [localSizeIds, setLocalSizeIds] = useState<number[]>(linkedSizeIds);

  useEffect(() => {
    setLocalShapeIds(linkedShapeIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedShapeIds.join(',')]);

  useEffect(() => {
    setLocalSizeIds(linkedSizeIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedSizeIds.join(',')]);

  useEffect(() => {
    if (!open) { setQuery(''); return; }
    setShapeOrder(rankOptions(allShapes, new Set(localShapeIds), option => isHot(flags, 'shape', [option.id])).map(shape => shape.id));
    const outside = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
    // Keep options stable while checking items; reorder on the next opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready]);
  useEffect(() => {
    if (!open) return;
    setSizeOrder(rankOptions(allSizes, new Set(localSizeIds), option => isHot(flags, 'size', [option.id])).map(size => size.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expandedShapeId, ready]);
  const orderedShapes = [...allShapes].sort((a,b) => {
    const left = shapeOrder.indexOf(a.id), right = shapeOrder.indexOf(b.id);
    return (left < 0 ? allShapes.length : left) - (right < 0 ? allShapes.length : right);
  });
  const selectedShapes = allShapes.filter((s) => localShapeIds.includes(s.id));
  const filtered = useMemo(
    () => orderedShapes.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase())),
    [allShapes, query, shapeOrder]
  );

  async function handleToggleShape(id: number, wasSelected: boolean) {
    setLocalShapeIds((cur) => (wasSelected ? cur.filter((x) => x !== id) : [...cur, id]));
    try {
      await onToggleShape(id, wasSelected);
    } catch {
      setLocalShapeIds((cur) => (wasSelected ? [...cur, id] : cur.filter((x) => x !== id)));
    }
  }

  async function handleToggleSize(id: number, wasSelected: boolean) {
    setLocalSizeIds((cur) => (wasSelected ? cur.filter((x) => x !== id) : [...cur, id]));
    try {
      await onToggleSize(id, wasSelected);
    } catch {
      setLocalSizeIds((cur) => (wasSelected ? [...cur, id] : cur.filter((x) => x !== id)));
    }
  }

  function handleBulkSizes(shapeId: number, sizeIds: number[]) {
    const sizesForShape = allSizes.filter((sz) => sz.shape_id === shapeId).map((sz) => sz.id);
    setLocalSizeIds((cur) => [...cur.filter((id) => !sizesForShape.includes(id)), ...sizeIds]);
    onBulkSizes(shapeId, sizeIds);
  }

  // Matches a plain "1" / "1.5", or a compound "AxB"/"A*B" (x/X/* used
  // interchangeably) -- range-select and sort both key off the leading
  // number either way, so "4x6" sits with "4" and a 4x6-to-8x6 range picks
  // up every compound size whose first dimension falls in that span.
  function strictSizeNum(s: string): number {
    const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*(?:[xX*]\s*\d+(?:\.\d+)?)?$/);
    return m ? parseFloat(m[1]) : NaN;
  }

  function applyRange(shapeId: number) {
    const min = parseFloat(rangeMin);
    const max = parseFloat(rangeMax);
    if (Number.isNaN(min) || Number.isNaN(max)) return;
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    const sizesForShape = allSizes.filter((sz) => sz.shape_id === shapeId);
    const matchIds = sizesForShape
      .filter((sz) => {
        const v = strictSizeNum(sz.size_mm);
        return !Number.isNaN(v) && v >= lo && v <= hi;
      })
      .map((sz) => sz.id);
    if (matchIds.length === 0) return;
    const merged = [...new Set([...localSizeIds.filter((id) => sizesForShape.some((sz) => sz.id === id)), ...matchIds])];
    handleBulkSizes(shapeId, merged);
    setRangeMin('');
    setRangeMax('');
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); triggerRef.current?.focus(); } }}>
      <button ref={triggerRef} type="button" aria-label="Choose shapes and sizes" aria-expanded={open} className="ms-trigger" onClick={() => setOpen((v) => !v)}>
        <span className="ms-trigger-main">
          {selectedShapes.length > 0 && (
            <span className="ms-preview-stack">
              {selectedShapes.slice(0, 5).map((s) => (
                <span key={s.id} className="ms-preview-dot"><ShapeIcon iconKey={s.iconKey} size={12} /></span>
              ))}
            </span>
          )}
          <span className="ms-placeholder">
            {selectedShapes.length === 0
              ? 'No shapes selected'
              : `${selectedShapes.length} shapes · ${localSizeIds.length} sizes`}
          </span>
        </span>
        <span className="ms-summary">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="ms-panel">
          <input
            type="text"
            aria-label="Search shapes"
            placeholder="Search shapes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="ms-search"
          />
          {filtered.map((shape) => {
            const active = localShapeIds.includes(shape.id);
            const sizesForShape = allSizes.filter((sz) => sz.shape_id === shape.id).sort((a,b) => sizeOrder.indexOf(a.id) - sizeOrder.indexOf(b.id));
            const linkedForShape = sizesForShape.filter((sz) => localSizeIds.includes(sz.id));
            const isExpanded = expandedShapeId === shape.id;
            return (
              <div key={shape.id}>
                <div className={`ms-row ${active ? 'ms-row-active' : ''}`}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, cursor: 'pointer' }}>
                    <input type="checkbox" checked={active} onChange={() => handleToggleShape(shape.id, active)} />
                    <ShapeIcon iconKey={shape.iconKey} />
                    {shape.name}
                  </label>
                  <HotMark kind="shape" ids={[shape.id]} name={shape.name} />
                  {active && (
                    <button
                      type="button"
                      aria-label={`Sizes for ${shape.name}`}
                      aria-expanded={isExpanded}
                      className="ms-expand-btn"
                      onClick={() => setExpandedShapeId(isExpanded ? null : shape.id)}
                    >
                      {linkedForShape.length}/{sizesForShape.length} sizes {isExpanded ? '▲' : '▶'}
                    </button>
                  )}
                </div>
                {active && isExpanded && (
                  <div className="ms-subpanel">
                    {sizesForShape.length === 0 ? (
                      <span style={{ fontSize: 11, color: '#756e5c' }}>No sizes defined for this shape yet.</span>
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <button className="btn-ghost" style={{ fontSize: 10.5, padding: '3px 8px' }} onClick={() => handleBulkSizes(shape.id, sizesForShape.map((sz) => sz.id))}>All</button>
                          <button className="btn-ghost" style={{ fontSize: 10.5, padding: '3px 8px' }} onClick={() => handleBulkSizes(shape.id, [])}>None</button>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Min"
                            value={rangeMin}
                            onChange={(e) => setRangeMin(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: 42, fontSize: 10.5, padding: '3px 5px' }}
                          />
                          <span style={{ fontSize: 10, color: '#756e5c' }}>to</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Max"
                            value={rangeMax}
                            onChange={(e) => setRangeMax(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: 42, fontSize: 10.5, padding: '3px 5px' }}
                          />
                          <button className="btn-ghost" style={{ fontSize: 10.5, padding: '3px 8px' }} onClick={() => applyRange(shape.id)}>Range</button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {sizesForShape.map((sz) => {
                            const sizeActive = localSizeIds.includes(sz.id);
                            return (
                              <span key={sz.id} style={{display:"inline-flex",alignItems:"center"}}><button
                                type="button"
                                aria-pressed={sizeActive}
                                className={`tag-chip ${sizeActive ? 'active' : ''}`}
                                style={{ cursor: 'pointer', fontSize: 10.5 }}
                                onClick={() => handleToggleSize(sz.id, sizeActive)}
                              >
                                {sz.size_mm}mm
                              </button><HotMark kind="size" ids={[sz.id]} name={`${shape.name} ${sz.size_mm} mm`} /></span>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
