'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import IconSelect from '@/components/IconSelect';

type RequestType = 'Place Order' | 'Request Quotation';

type Item = {
  id: number;
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  shapeId: number;
  shapeName: string;
  sizeId: number | null;
  sizeMm: string;
  colorId: number;
  colorName: string;
  colorHex: string;
  quantity: number;
  requestType: string;
};

type CategoryOption = { id: number; name: string; slug: string };

type CategoryOptionsData = {
  shapes: { id: number; name: string; iconKey?: string | null }[];
  colors: { id: number; name: string; hex?: string | null }[];
  sizes: { id: number; shapeId: number; sizeMm: string }[];
};

type PendingLine = {
  tempId: string;
  categoryId: number;
  categoryName: string;
  shapeId: number;
  shapeName: string;
  sizeId: number;
  sizeMm: string;
  colorId: number;
  colorName: string;
  colorHex: string;
  quantity: number;
  requestType: RequestType;
};

type TimelineEntry =
  | { type: 'status'; at: string; label: string }
  | { type: 'note'; at: string; author: string; message: string };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function strictSizeNum(s: string): number {
  return /^\d+(\.\d+)?$/.test(s.trim()) ? parseFloat(s) : NaN;
}

export default function OrderDetailClient({
  orderId,
  canEdit,
  items,
  allCategories,
  timeline
}: {
  orderId: number;
  status: string;
  canEdit: boolean;
  items: Item[];
  allCategories: CategoryOption[];
  timeline: TimelineEntry[];
}) {
  const router = useRouter();
  // Read-only by default -- an explicit "Edit order" click reveals the
  // editable qty/remove controls and the Add to Order builder.
  const [editing, setEditing] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, number>>(Object.fromEntries(items.map((i) => [i.id, i.quantity])));
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());
  const [pendingLines, setPendingLines] = useState<PendingLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function cancelEditing() {
    setEditing(false);
    setQuantities(Object.fromEntries(items.map((i) => [i.id, i.quantity])));
    setRemovedIds(new Set());
    setPendingLines([]);
  }

  // ---------- Add to order: category-first builder, any category ----------
  const [pickCategoryId, setPickCategoryId] = useState<number | ''>('');
  const [optionsCache, setOptionsCache] = useState<Record<number, CategoryOptionsData>>({});
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [pickShapeIds, setPickShapeIds] = useState<number[]>([]);
  const [pickColorIds, setPickColorIds] = useState<number[]>([]);
  const [pickSizeIdxs, setPickSizeIdxs] = useState<number[]>([]);
  const [rangeMin, setRangeMin] = useState('');
  const [rangeMax, setRangeMax] = useState('');
  const [pickQty, setPickQty] = useState('');
  const [pickRequestType, setPickRequestType] = useState<RequestType>('Place Order');

  async function handleCategoryChange(idStr: string) {
    const id = idStr ? Number(idStr) : '';
    setPickCategoryId(id);
    setPickShapeIds([]);
    setPickColorIds([]);
    setPickSizeIdxs([]);
    if (!id || optionsCache[id]) return;
    const cat = allCategories.find((c) => c.id === id);
    if (!cat) return;
    setLoadingOptions(true);
    try {
      const res = await fetch(`/api/app/categories/${cat.slug}`);
      const data = await res.json();
      setOptionsCache((cur) => ({ ...cur, [id]: { shapes: data.shapes || [], colors: data.colors || [], sizes: data.sizes || [] } }));
    } finally {
      setLoadingOptions(false);
    }
  }

  const currentOptions = typeof pickCategoryId === 'number' ? optionsCache[pickCategoryId] : null;
  const currentCategory = typeof pickCategoryId === 'number' ? allCategories.find((c) => c.id === pickCategoryId) : null;

  const sizesForShapes = useMemo(() => {
    if (!currentOptions || pickShapeIds.length === 0) return [];
    const bySizeMm = new Map<string, typeof currentOptions.sizes>();
    currentOptions.sizes.forEach((sz) => {
      if (!pickShapeIds.includes(sz.shapeId)) return;
      if (!bySizeMm.has(sz.sizeMm)) bySizeMm.set(sz.sizeMm, []);
      bySizeMm.get(sz.sizeMm)!.push(sz);
    });
    const common: { sizeMm: string; rows: typeof currentOptions.sizes }[] = [];
    bySizeMm.forEach((rows, sizeMm) => {
      const shapeIdsCovered = new Set(rows.map((r) => r.shapeId));
      if (pickShapeIds.every((id) => shapeIdsCovered.has(id))) common.push({ sizeMm, rows });
    });
    return common.sort((a, b) => {
      const na = strictSizeNum(a.sizeMm);
      const nb = strictSizeNum(b.sizeMm);
      if (Number.isNaN(na) && Number.isNaN(nb)) return a.sizeMm.localeCompare(b.sizeMm);
      if (Number.isNaN(na)) return 1;
      if (Number.isNaN(nb)) return -1;
      return na - nb;
    });
  }, [currentOptions, pickShapeIds]);

  const sizeOptions = useMemo(() => sizesForShapes.map((g, i) => ({ id: i, name: `${g.sizeMm} mm` })), [sizesForShapes]);

  function applyRange() {
    const min = parseFloat(rangeMin);
    const max = parseFloat(rangeMax);
    if (Number.isNaN(min) || Number.isNaN(max)) {
      setToast('Enter both a min and max size in mm.');
      return;
    }
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    const matchIdxs = sizesForShapes
      .map((g, i) => ({ i, val: strictSizeNum(g.sizeMm) }))
      .filter((g) => !Number.isNaN(g.val) && g.val >= lo && g.val <= hi)
      .map((g) => g.i);
    if (matchIdxs.length === 0) {
      setToast(`No existing sizes between ${lo}-${hi}mm for these shapes.`);
      return;
    }
    setPickSizeIdxs((cur) => [...new Set([...cur, ...matchIdxs])]);
    setRangeMin('');
    setRangeMax('');
  }

  const qtyNum = parseInt(pickQty, 10) || 0;
  const canAddPending = !!currentOptions && pickShapeIds.length > 0 && pickColorIds.length > 0 && pickSizeIdxs.length > 0 && qtyNum > 0;
  const comboCount = pickShapeIds.length * pickColorIds.length * pickSizeIdxs.length;

  function addPendingLines() {
    if (!canAddPending || !currentOptions || !currentCategory) {
      setToast('Pick a category, shape, color and size, and enter quantity first.');
      return;
    }
    const added: PendingLine[] = [];
    for (const shapeId of pickShapeIds) {
      const shape = currentOptions.shapes.find((s) => s.id === shapeId);
      if (!shape) continue;
      for (const colorId of pickColorIds) {
        const color = currentOptions.colors.find((c) => c.id === colorId);
        if (!color) continue;
        for (const sizeIdx of pickSizeIdxs) {
          const group = sizesForShapes[sizeIdx];
          const match = group?.rows.find((r) => r.shapeId === shapeId);
          if (!match) continue;
          added.push({
            tempId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            categoryId: currentCategory.id,
            categoryName: currentCategory.name,
            shapeId: shape.id,
            shapeName: shape.name,
            sizeId: match.id,
            sizeMm: match.sizeMm,
            colorId: color.id,
            colorName: color.name,
            colorHex: color.hex || '#ccc',
            quantity: qtyNum,
            requestType: pickRequestType
          });
        }
      }
    }
    setPendingLines((cur) => [...cur, ...added]);
    setToast(added.length > 1 ? `Staged ${added.length} lines -- Save changes to add them` : 'Staged 1 line -- Save changes to add it');
    setPickSizeIdxs([]);
    setPickQty('');
  }

  function removePendingLine(tempId: string) {
    setPendingLines(pendingLines.filter((l) => l.tempId !== tempId));
  }

  function updatePendingQty(tempId: string, qty: number) {
    setPendingLines(pendingLines.map((l) => (l.tempId === tempId ? { ...l, quantity: Math.max(1, qty) } : l)));
  }

  async function saveEdits() {
    const updates = items
      .filter((i) => !removedIds.has(i.id) && quantities[i.id] !== i.quantity)
      .map((i) => ({ id: i.id, quantity: quantities[i.id] }));

    const newItems = pendingLines.map((l) => ({
      categoryId: l.categoryId,
      shapeId: l.shapeId,
      sizeId: l.sizeId,
      colorId: l.colorId,
      quantity: l.quantity,
      requestType: l.requestType
    }));

    if (updates.length === 0 && removedIds.size === 0 && newItems.length === 0) {
      setToast('No changes to save.');
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/account/orders/${orderId}/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates, removedIds: Array.from(removedIds), newItems })
    });
    setSaving(false);

    if (res.ok) {
      setPendingLines([]);
      setRemovedIds(new Set());
      setEditing(false);
      setToast('Modification request sent.');
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setToast(data.error || 'Failed to save changes.');
    }
  }

  function reorder() {
    // The new-order page fetches this order's items itself server-side --
    // no client-side cart staging needed, and it works reliably regardless
    // of localStorage state.
    router.push(`/account/orders/new?from=${orderId}`);
  }

  return (
    <>
      <section style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, color: 'var(--ink)' }}>Line items</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn-ghost" onClick={reorder}>Reorder as new</button>
            {canEdit && !editing && (
              <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>Edit order</button>
            )}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr><th>Category</th><th>Shape</th><th>Size</th><th>Color</th><th>Qty</th>{editing && <th></th>}</tr>
            </thead>
            <tbody>
              {items.filter((i) => !removedIds.has(i.id)).map((i) => (
                <tr key={i.id}>
                  <td>{i.categoryName}</td>
                  <td>{i.shapeName}</td>
                  <td>{i.sizeMm} mm</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: i.colorHex }} />
                      {i.colorName}
                    </span>
                  </td>
                  <td>
                    {editing ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={quantities[i.id]}
                        onChange={(e) => setQuantities({ ...quantities, [i.id]: parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 })}
                        style={{ maxWidth: 80, fontSize: 13 }}
                      />
                    ) : (
                      i.quantity
                    )}
                  </td>
                  {editing && (
                    <td>
                      <button type="button" className="btn-danger" onClick={() => setRemovedIds(new Set([...removedIds, i.id]))}>Remove</button>
                    </td>
                  )}
                </tr>
              ))}
              {editing && pendingLines.map((l) => (
                <tr key={l.tempId} style={{ background: '#faf8f3' }}>
                  <td>{l.categoryName}</td>
                  <td>{l.shapeName}</td>
                  <td>{l.sizeMm} mm</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: l.colorHex }} />
                      {l.colorName}
                    </span>
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={l.quantity}
                      onChange={(e) => updatePendingQty(l.tempId, parseInt(e.target.value.replace(/\D/g, ''), 10) || 1)}
                      style={{ maxWidth: 80, fontSize: 13 }}
                    />
                  </td>
                  <td>
                    <button type="button" className="btn-danger" onClick={() => removePendingLine(l.tempId)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editing && (
          <>
            <div className="po-card" style={{ marginTop: 18 }}>
              <h3 className="po-heading" style={{ fontSize: 14 }}>Add to Order</h3>
              <div className="po-add-form">
                <div>
                  <label className="po-label">Category</label>
                  <select value={pickCategoryId} onChange={(e) => handleCategoryChange(e.target.value)}>
                    <option value="">Choose category</option>
                    {allCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="po-label">Shape{pickShapeIds.length > 1 ? 's' : ''}</label>
                  <IconSelect
                    multiple
                    options={currentOptions?.shapes || []}
                    values={pickShapeIds}
                    onChange={(v) => { setPickShapeIds(v); setPickSizeIdxs([]); }}
                    placeholder={!currentOptions ? 'Pick a category first' : 'Choose shape(s)'}
                    leading="icon"
                  />
                </div>
                <div>
                  <label className="po-label">Color{pickColorIds.length > 1 ? 's' : ''}</label>
                  <IconSelect
                    multiple
                    options={currentOptions?.colors || []}
                    values={pickColorIds}
                    onChange={setPickColorIds}
                    placeholder={!currentOptions ? 'Pick a category first' : 'Choose color(s)'}
                    leading="swatch"
                  />
                </div>
                <div>
                  <label className="po-label">Size{pickSizeIdxs.length > 1 ? 's' : ''} (mm)</label>
                  <IconSelect
                    multiple
                    options={sizeOptions}
                    values={pickSizeIdxs}
                    onChange={setPickSizeIdxs}
                    placeholder={
                      pickShapeIds.length === 0 ? 'Pick a shape first' : sizeOptions.length === 0 ? 'No common size for these shapes' : 'Choose size(s)'
                    }
                  />
                  {pickShapeIds.length > 0 && (
                    <div className="po-range-row">
                      <input type="text" inputMode="decimal" placeholder="Min mm" value={rangeMin} onChange={(e) => setRangeMin(e.target.value)} />
                      <span>to</span>
                      <input type="text" inputMode="decimal" placeholder="Max mm" value={rangeMax} onChange={(e) => setRangeMax(e.target.value)} />
                      <button type="button" className="po-inline-link" onClick={applyRange}>Select range</button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="po-label">Qty (pcs)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="po-qty-input"
                    placeholder="e.g. 5000"
                    value={pickQty}
                    onChange={(e) => setPickQty(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>

              {loadingOptions && <p style={{ fontSize: 12, color: '#8a8370' }}>Loading category options...</p>}

              <div className="po-type-toggle">
                <button type="button" className={pickRequestType === 'Place Order' ? 'active' : ''} onClick={() => setPickRequestType('Place Order')}>
                  Place Order
                </button>
                <button
                  type="button"
                  className={pickRequestType === 'Request Quotation' ? 'active' : ''}
                  onClick={() => setPickRequestType('Request Quotation')}
                >
                  Request Quotation
                </button>
              </div>

              <button type="button" className="po-add-line-btn" onClick={addPendingLines} disabled={!canAddPending}>
                + Add {comboCount > 1 ? `${comboCount} lines` : 'line'} to order
              </button>
            </div>

            <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
              <button type="button" className="btn" onClick={saveEdits} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
              <button type="button" className="btn-ghost" onClick={cancelEditing} disabled={saving}>Cancel</button>
            </div>
          </>
        )}
        {toast && <p style={{ fontSize: 12.5, color: toast.startsWith('Modification') ? '#1a6b3a' : '#a3341f', marginTop: 10 }}>{toast}</p>}
      </section>

      <section>
        <h2 style={{ fontSize: 16, color: 'var(--ink)', marginBottom: 12 }}>Order timeline</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {timeline.length === 0 && <p style={{ fontSize: 12.5, color: '#8a8370' }}>No updates yet.</p>}
          {timeline.map((t, i) => (
            <div key={i} className="card" style={{ padding: '10px 14px', fontSize: 13 }}>
              {t.type === 'status' ? (
                <span><strong>Status updated:</strong> {t.label}</span>
              ) : (
                <span><strong>{t.author === 'admin' ? 'YOYO GEMS' : t.author === 'customer' ? 'You' : 'System'}:</strong> {t.message}</span>
              )}
              <div style={{ fontSize: 11, color: '#8a8370', marginTop: 3 }}>{fmtDate(t.at)}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
