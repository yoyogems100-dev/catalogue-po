'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MultiSelect from '@/components/MultiSelect';
import { useDragReorder, moveItem } from '@/hooks/useDragReorder';

type Shape = { id: number; name: string };
type Size = { id: number; shape_id: number; size_mm: string; weight_ct: number | null };
type Category = { id: number; num: number; name: string };
type CatShape = { category_id: number; shape_id: number };

export default function ShapesClient({
  shapes,
  sizes,
  categories,
  catShapes
}: {
  shapes: Shape[];
  sizes: Size[];
  categories: Category[];
  catShapes: CatShape[];
}) {
  const router = useRouter();
  const [newShape, setNewShape] = useState('');
  const [expandedSizes, setExpandedSizes] = useState<number | null>(null);
  const [expandedCats, setExpandedCats] = useState<number | null>(null);
  const [newSize, setNewSize] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [search, setSearch] = useState('');

  // Local optimistic copy so a drag reflects instantly instead of waiting on
  // the reorder-all round trip + router.refresh().
  const [localShapes, setLocalShapes] = useState(shapes);
  useEffect(() => setLocalShapes(shapes), [shapes]);

  const visibleShapes = search.trim()
    ? localShapes.filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()))
    : localShapes;

  const { dragHandleProps, dropTargetProps, dragIndex, overIndex } = useDragReorder(async (from, to) => {
    const prev = localShapes;
    const next = moveItem(localShapes, from, to);
    setLocalShapes(next);
    const res = await fetch('/api/shapes/reorder-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: next.map((s) => s.id) })
    });
    if (!res.ok) {
      setLocalShapes(prev);
      alert('Failed to save the new order.');
      return;
    }
    router.refresh();
  });

  async function addShape() {
    if (!newShape.trim()) return;
    const res = await fetch('/api/shapes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newShape }) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to add shape -- a shape with this name may already exist.');
      return;
    }
    setNewShape('');
    router.refresh();
  }

  async function moveShape(id: number, direction: 'up' | 'down') {
    const res = await fetch('/api/shapes/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shape_id: id, direction })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to reorder shape');
      return;
    }
    router.refresh();
  }

  async function deleteShape(id: number) {
    if (!confirm('Delete this shape and all its sizes? Photos tagged with it will keep the photo but lose the shape tag.')) return;
    await fetch('/api/shapes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    router.refresh();
  }

  async function renameShape(id: number, name: string) {
    const res = await fetch('/api/shapes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to rename shape');
    }
    router.refresh();
  }

  async function addSize(shapeId: number) {
    if (!newSize.trim()) return;
    // Comma or newline separated input adds every size in one action (e.g.
    // "0.8, 1.0, 1.1, 1.5") -- a single value still works exactly as before.
    const values = newSize.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    // The weight field only applies when adding a single size -- different
    // sizes genuinely weigh different amounts, so a bulk batch can't share
    // one carat value. Bulk-added sizes come in with weight_ct null; edit
    // each individually afterward if needed.
    const sizes = values.map((size_mm) => ({
      size_mm,
      weight_ct: values.length === 1 && newWeight ? parseFloat(newWeight) : null
    }));
    const res = await fetch('/api/shape-sizes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shape_id: shapeId, sizes })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to add size.');
      return;
    }
    setNewSize('');
    setNewWeight('');
    router.refresh();
  }

  async function deleteSize(id: number) {
    await fetch('/api/shape-sizes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    router.refresh();
  }

  async function toggleCategory(shapeId: number, categoryId: number, currentlyLinked: boolean) {
    const res = await fetch('/api/category-links/shape', {
      method: currentlyLinked ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, shape_id: shapeId })
    });
    if (!res.ok) throw new Error('Failed to update link');
    router.refresh();
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, maxWidth: 420 }}>
        <input type="text" placeholder="New shape name (e.g. Emerald Cut)" value={newShape} onChange={(e) => setNewShape(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addShape()} />
        <button className="btn" onClick={addShape}>Add shape</button>
      </div>
      <div style={{ marginBottom: 16, maxWidth: 280 }}>
        <input type="text" placeholder="Search shapes..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <table>
        <thead>
          <tr><th>Order</th><th>Shape</th><th>Sizes</th><th>Categories</th><th></th></tr>
        </thead>
        <tbody>
          {visibleShapes.map((s) => {
            const index = localShapes.findIndex((ls) => ls.id === s.id);
            const shapeSizes = sizes.filter((sz) => sz.shape_id === s.id);
            const linkedCatIds = catShapes.filter((cs) => cs.shape_id === s.id).map((cs) => cs.category_id);
            const sizesOpen = expandedSizes === s.id;
            const catsOpen = expandedCats === s.id;
            const dragProps = search.trim() ? {} : dropTargetProps(index);
            return (
              <>
                <tr
                  key={s.id}
                  {...dragProps}
                  className={!search.trim() && overIndex === index ? 'drag-over-row' : ''}
                  style={{ opacity: !search.trim() && dragIndex === index ? 0.4 : 1 }}
                >
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {!search.trim() && (
                      <>
                        <span {...dragHandleProps(index)} className="drag-handle" title="Drag to reorder">&#9776;</span>{' '}
                        <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => moveShape(s.id, 'up')} disabled={index === 0}>&uarr;</button>{' '}
                        <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => moveShape(s.id, 'down')} disabled={index === localShapes.length - 1}>&darr;</button>
                      </>
                    )}
                  </td>
                  <td><ShapeNameCell shape={s} onRename={renameShape} /></td>
                  <td>
                    <button className="btn-ghost" onClick={() => { setExpandedSizes(sizesOpen ? null : s.id); setExpandedCats(null); }}>
                      {shapeSizes.length} sizes {sizesOpen ? '▲' : '▼'}
                    </button>
                  </td>
                  <td>
                    <button className="btn-ghost" onClick={() => { setExpandedCats(catsOpen ? null : s.id); setExpandedSizes(null); }}>
                      {linkedCatIds.length} categories {catsOpen ? '▲' : '▼'}
                    </button>
                  </td>
                  <td><button className="btn-danger" onClick={() => deleteShape(s.id)}>Delete</button></td>
                </tr>
                {sizesOpen && (
                  <tr key={`${s.id}-sizes`}>
                    <td colSpan={5} style={{ background: '#faf8f3' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        {shapeSizes.map((sz) => (
                          <span key={sz.id} className="tag-chip">
                            {sz.size_mm} mm{sz.weight_ct ? ` · ${sz.weight_ct}ct` : ''}
                            <span style={{ cursor: 'pointer', color: '#a3341f' }} onClick={() => deleteSize(sz.id)}>&times;</span>
                          </span>
                        ))}
                        {shapeSizes.length === 0 && <span style={{ fontSize: 12, color: '#8a8370' }}>No sizes yet.</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 8, maxWidth: 420 }}>
                        <input
                          type="text"
                          placeholder="Size, e.g. 6x8 -- or 0.8, 1.0, 1.1 for bulk"
                          value={newSize}
                          onChange={(e) => setNewSize(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addSize(s.id)}
                        />
                        <input type="text" placeholder="Carat wt (single size only)" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} style={{ maxWidth: 160 }} />
                        <button className="btn" onClick={() => addSize(s.id)}>Add</button>
                      </div>
                    </td>
                  </tr>
                )}
                {catsOpen && (
                  <tr key={`${s.id}-cats`}>
                    <td colSpan={5} style={{ background: '#faf8f3' }}>
                      <p style={{ fontSize: 12, color: '#8a8370', marginBottom: 8 }}>
                        Which categories should offer "{s.name}" as a shape option. This is the same link used on each
                        category's own page -- edit from whichever side is more convenient.
                      </p>
                      <div style={{ maxWidth: 420 }}>
                        <MultiSelect
                          options={categories.map((c) => ({ id: c.id, name: c.name }))}
                          selectedIds={linkedCatIds}
                          onToggle={(catId, active) => toggleCategory(s.id, catId, active)}
                          placeholder="Not linked to any category"
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
          {visibleShapes.length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: 'center', color: '#8a8370', fontSize: 13 }}>No shapes match "{search}".</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}

function ShapeNameCell({ shape, onRename }: { shape: Shape; onRename: (id: number, name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(shape.name);

  async function save() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === shape.name) {
      setValue(shape.name);
      setEditing(false);
      return;
    }
    setEditing(false);
    await onRename(shape.id, trimmed);
  }

  if (!editing) {
    return (
      <span
        onClick={() => { setValue(shape.name); setEditing(true); }}
        style={{ cursor: 'pointer', borderBottom: '1px dashed var(--line)' }}
        title="Click to rename"
      >
        {shape.name}
      </span>
    );
  }

  return (
    <input
      autoFocus
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { setValue(shape.name); setEditing(false); }
      }}
      style={{ fontSize: 13, padding: '3px 6px', maxWidth: 180 }}
    />
  );
}
