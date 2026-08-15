'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedShapeId, setExpandedShapeId] = useState<number | null>(null);

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

  const selectedShapes = allShapes.filter((s) => localShapeIds.includes(s.id));
  const filtered = useMemo(
    () => allShapes.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase())),
    [allShapes, query]
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

  return (
    <div style={{ position: 'relative' }}>
      <div className="ms-trigger" onClick={() => setOpen((v) => !v)}>
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
      </div>

      {open && (
        <div className="ms-panel">
          <input
            type="text"
            placeholder="Search shapes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="ms-search"
          />
          {filtered.map((shape) => {
            const active = localShapeIds.includes(shape.id);
            const sizesForShape = allSizes.filter((sz) => sz.shape_id === shape.id);
            const linkedForShape = sizesForShape.filter((sz) => localSizeIds.includes(sz.id));
            const isExpanded = expandedShapeId === shape.id;
            return (
              <div key={shape.id}>
                <div className={`ms-row ${active ? 'ms-row-active' : ''}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, cursor: 'pointer' }} onClick={() => handleToggleShape(shape.id, active)}>
                    <input type="checkbox" checked={active} readOnly />
                    <ShapeIcon iconKey={shape.iconKey} />
                    {shape.name}
                  </div>
                  {active && (
                    <button
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
                      <span style={{ fontSize: 11, color: '#8a8370' }}>No sizes defined for this shape yet.</span>
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                          <button className="btn-ghost" style={{ fontSize: 10.5, padding: '3px 8px' }} onClick={() => handleBulkSizes(shape.id, sizesForShape.map((sz) => sz.id))}>All</button>
                          <button className="btn-ghost" style={{ fontSize: 10.5, padding: '3px 8px' }} onClick={() => handleBulkSizes(shape.id, [])}>None</button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {sizesForShape.map((sz) => {
                            const sizeActive = localSizeIds.includes(sz.id);
                            return (
                              <span
                                key={sz.id}
                                className={`tag-chip ${sizeActive ? 'active' : ''}`}
                                style={{ cursor: 'pointer', fontSize: 10.5 }}
                                onClick={() => handleToggleSize(sz.id, sizeActive)}
                              >
                                {sz.size_mm}mm
                              </span>
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
