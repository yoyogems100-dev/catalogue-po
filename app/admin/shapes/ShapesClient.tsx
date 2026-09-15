'use client';
import { HotMark } from '@/components/HotSelling';

import { Fragment, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CategoryLinkList from '@/components/admin/CategoryLinkList';
import ShapeIcon from '@/components/ShapeIcon';
import { useDragReorder, moveItem } from '@/hooks/useDragReorder';

type Shape = { id: number; name: string; icon_key?: string | null; ref_photo_url?: string | null };
type Size = { id: number; shape_id: number; size_mm: string; weight_ct: number | null };
type Category = { id: number; num: number; name: string };
type CatShape = { category_id: number; shape_id: number };

export default function ShapesClient({
  shapes,
  sizes,
  categories,
  catShapes,
  catSizes,
  initialCategoryId = 0
}: {
  shapes: Shape[];
  sizes: Size[];
  categories: Category[];
  catShapes: CatShape[];
  catSizes: {category_id:number;shape_size_id:number}[];
  initialCategoryId?:number;
}) {
  const router = useRouter();
  const [categoryFilter,setCategoryFilter] = useState(initialCategoryId);
  const scoped = categories.some(category => category.id === categoryFilter);
  const [newShape, setNewShape] = useState('');
  const [expandedSizes, setExpandedSizes] = useState<number | null>(null);
  const [expandedCats, setExpandedCats] = useState<number | null>(null);
  const [newSize, setNewSize] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  // UI/UX audit ("visible saved-state feedback"): add/rename/delete here
  // previously refreshed the table with no acknowledgement -- a failed
  // request and a successful one looked identical.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Local optimistic copy so a drag reflects instantly instead of waiting on
  // the reorder-all round trip + router.refresh().
  const [localShapes, setLocalShapes] = useState(shapes);
  useEffect(() => setLocalShapes(shapes), [shapes]);

  const visibleShapes = localShapes.filter(shape => (!scoped || catShapes.some(link => link.category_id === categoryFilter && link.shape_id === shape.id)) && shape.name.toLowerCase().includes(search.trim().toLowerCase()));
  const canReorder = !scoped && !search.trim();

  // Bulk select/delete: only ever holds ids currently in view (search/category
  // filtered), so switching the filter can't leave a stale, invisible shape
  // silently selected.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  useEffect(() => {
    const visibleIds = new Set(visibleShapes.map((s) => s.id));
    setSelected((cur) => {
      const next = new Set([...cur].filter((id) => visibleIds.has(id)));
      return next.size === cur.size ? cur : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter]);
  const allVisibleSelected = visibleShapes.length > 0 && visibleShapes.every((s) => selected.has(s.id));

  function toggleSelected(id: number) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelected((cur) => (allVisibleSelected ? new Set() : new Set(visibleShapes.map((s) => s.id))));
  }

  async function bulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} shape${ids.length > 1 ? 's' : ''} and all their sizes? Photos tagged with them will keep the photo but lose the shape tag.`)) return;
    const results = await Promise.all(ids.map((id) => fetch('/api/shapes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then((r) => r.ok)));
    const failed = results.filter((ok) => !ok).length;
    setSelected(new Set());
    setToast(failed === 0 ? `${ids.length} shape${ids.length > 1 ? 's' : ''} deleted.` : `${ids.length - failed} of ${ids.length} deleted -- ${failed} failed.`);
    router.refresh();
  }

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
    setToast('Shape added.');
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

  async function deleteShape(id: number, name: string) {
    if (!confirm(`Delete "${name}" and all its sizes? Photos tagged with it will keep the photo but lose the shape tag.`)) return;
    const res = await fetch('/api/shapes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (!res.ok) { alert('Failed to delete shape -- try again.'); return; }
    setToast('Shape deleted.');
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
      return;
    }
    setToast('Renamed.');
    router.refresh();
  }

  async function uploadPhoto(id: number, file: File | null | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/shapes/${id}/photo`, { method: 'POST', body: fd });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to upload photo.');
      return;
    }
    setToast('Photo uploaded.');
    router.refresh();
  }

  async function removePhoto(id: number) {
    if (!confirm('Remove this reference photo? The shape will fall back to the plain vector icon.')) return;
    const res = await fetch(`/api/shapes/${id}/photo`, { method: 'DELETE' });
    if (!res.ok) { alert('Failed to remove photo -- try again.'); return; }
    setToast('Photo removed.');
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
    setToast(sizes.length > 1 ? 'Sizes added.' : 'Size added.');
    router.refresh();
  }

  async function deleteSize(id: number) {
    const res = await fetch('/api/shape-sizes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (!res.ok) { alert('Failed to delete size -- try again.'); return; }
    setToast('Size deleted.');
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
      <label>Filter by category<select aria-label="Shape category filter" value={categoryFilter} onChange={event => setCategoryFilter(Number(event.target.value))}><option value={0}>All categories</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      {scoped && <p>Showing shapes and sizes linked to this category. <a href={`/admin/categories/${categoryFilter}?tab=shapes`}>Manage category shapes &amp; sizes</a>. Names are shared across categories.</p>}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 280, flex: '1 1 200px' }}>
          <input type="text" placeholder="Search shapes..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <input type="text" placeholder="New shape name (e.g. Emerald Cut)" value={newShape} onChange={(e) => setNewShape(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addShape()} />
          <button className="btn" onClick={addShape}>Add shape</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: visibleShapes.length ? 'pointer' : 'default' }}>
          <input type="checkbox" checked={allVisibleSelected} disabled={visibleShapes.length === 0} onChange={toggleSelectAllVisible} />
          Select all shown
        </label>
        {selected.size > 0 && !scoped && (
          <button className="btn-ghost" style={{ fontSize: 12.5, color: '#a3341f' }} onClick={bulkDelete}>
            Delete {selected.size} selected
          </button>
        )}
      </div>

      <table>
        <thead>
          <tr><th></th><th>Order</th><th>Image</th><th>Shape</th><th>Sizes</th><th>Categories</th><th></th></tr>
        </thead>
        <tbody>
          {visibleShapes.map((s) => {
            const index = localShapes.findIndex((ls) => ls.id === s.id);
            const shapeSizes = sizes.filter((sz) => sz.shape_id === s.id && (!scoped || catSizes.some(link => link.category_id === categoryFilter && link.shape_size_id === sz.id)));
            const linkedCatIds = catShapes.filter((cs) => cs.shape_id === s.id).map((cs) => cs.category_id);
            const sizesOpen = expandedSizes === s.id;
            const catsOpen = expandedCats === s.id;
            const dragProps = canReorder ? dropTargetProps(index) : {};
            return (
              <Fragment key={s.id}>
                <tr
                  {...dragProps}
                  className={canReorder && overIndex === index ? 'drag-over-row' : ''}
                  style={{ opacity: canReorder && dragIndex === index ? 0.4 : 1 }}
                >
                  <td>{!scoped && <input type="checkbox" aria-label={`Select ${s.name}`} checked={selected.has(s.id)} onChange={() => toggleSelected(s.id)} />}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {canReorder && (
                      <>
                        <span {...dragHandleProps(index)} className="drag-handle" title="Drag to reorder">&#9776;</span>{' '}
                        <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => moveShape(s.id, 'up')} disabled={index === 0}>&uarr;</button>{' '}
                        <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => moveShape(s.id, 'down')} disabled={index === localShapes.length - 1}>&darr;</button>
                      </>
                    )}
                  </td>
                  <td>
                    {/* Vector always shows -- it's what customers actually see in every
                        dropdown/PDF when there's no real photo, so it's worth seeing here
                        even when a photo exists. The photo (when there is one) sits next
                        to it rather than replacing it, so it's obvious at a glance which
                        shapes are still running on the generic vector only. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span className="shape-vector-icon" aria-hidden="true" title="Vector icon (dropdown/PDF fallback)"><ShapeIcon iconKey={s.icon_key} size={26} /></span>
                      {s.ref_photo_url ? (
                        <img src={s.ref_photo_url} alt="" title="Real reference photo" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 3 }} />
                      ) : (
                        <span style={{ fontSize: 10.5, color: '#a3341f' }}>No photo yet</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      <label className="btn-ghost" style={{ fontSize: 10.5, cursor: 'pointer', padding: '2px 6px' }}>
                        {s.ref_photo_url ? 'Change' : 'Add'} photo
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => { uploadPhoto(s.id, e.target.files?.[0]); e.target.value = ''; }}
                        />
                      </label>
                      {s.ref_photo_url && (
                        <button className="btn-ghost" style={{ fontSize: 10.5, color: '#a3341f', padding: '2px 6px' }} onClick={() => removePhoto(s.id)}>
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                  <td><HotMark kind="shape" ids={[s.id]} name={s.name} /><ShapeNameCell shape={s} onRename={renameShape} /></td>
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
                  <td>{!scoped && <button className="btn-danger" onClick={() => deleteShape(s.id, s.name)}>Delete</button>}</td>
                </tr>
                {sizesOpen && (
                  <tr key={`${s.id}-sizes`}>
                    <td colSpan={7} style={{ background: '#faf8f3' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        {shapeSizes.map((sz) => (
                          <span key={sz.id} className="tag-chip">
                            <HotMark kind="size" ids={[sz.id]} name={`${s.name} ${sz.size_mm} mm`} />{sz.size_mm} mm{sz.weight_ct ? ` · ${sz.weight_ct}ct` : ''}
                            <button
                              type="button"
                              hidden={scoped}
                              aria-label={`Delete size ${sz.size_mm}mm`}
                              style={{ cursor: 'pointer', color: '#a3341f', background: 'none', border: 'none', padding: 0, font: 'inherit' }}
                              onClick={() => deleteSize(sz.id)}
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                        {shapeSizes.length === 0 && <span style={{ fontSize: 12, color: '#756e5c' }}>No sizes yet.</span>}
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
                    <td colSpan={7} style={{ background: '#faf8f3' }}>
                      <p style={{ fontSize: 12, color: '#756e5c', marginBottom: 8 }}>
                        Which categories should offer "{s.name}" as a shape option. This is the same link used on each
                        category's own page -- edit from whichever side is more convenient.
                      </p>
                      <CategoryLinkList
                        categories={categories}
                        linkedIds={linkedCatIds}
                        onToggle={(catId, active) => toggleCategory(s.id, catId, active)}
                        tab="shapes"
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {visibleShapes.length === 0 && (
            <tr><td colSpan={7} style={{ textAlign: 'center', color: '#756e5c', fontSize: 13 }}>No shapes match "{search}".</td></tr>
          )}
        </tbody>
      </table>
      {toast && <p className="po-toast" role="status" aria-live="polite">{toast}</p>}
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
      <button
        type="button"
        onDoubleClick={() => { setValue(shape.name); setEditing(true); }}
        style={{ cursor: 'text', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: '1px dashed var(--line)', padding: 0, font: 'inherit', textAlign: 'left' }}
        title="Double-click to rename"
        aria-label={`Rename shape ${shape.name}`}
      >
        {shape.name}
      </button>
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
