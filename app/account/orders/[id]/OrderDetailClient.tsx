'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
};

type CategoryOption = {
  shapes: { id: number; name: string }[];
  colors: { id: number; name: string; hex: string | null }[];
  sizes: { id: number; shapeId: number; sizeMm: string }[];
};

type TimelineEntry =
  | { type: 'status'; at: string; label: string }
  | { type: 'note'; at: string; author: string; message: string };

type NewLine = {
  tempId: string;
  categoryId: number;
  shapeId: number | '';
  sizeId: number | '';
  colorId: number | '';
  quantity: string;
};

const CART_KEY = 'yoyo_po_cart_v2';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function OrderDetailClient({
  orderId,
  canEdit,
  items,
  categoryOptions,
  timeline
}: {
  orderId: number;
  status: string;
  canEdit: boolean;
  items: Item[];
  categoryOptions: Record<number, CategoryOption>;
  timeline: TimelineEntry[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, number>>(Object.fromEntries(items.map((i) => [i.id, i.quantity])));
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());
  const [newLines, setNewLines] = useState<NewLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const orderCategories = [...new Map(items.map((i) => [i.categoryId, i.categoryName])).entries()];

  function addNewLine() {
    const firstCat = orderCategories[0];
    if (!firstCat) return;
    setNewLines([
      ...newLines,
      { tempId: `${Date.now()}-${Math.random().toString(16).slice(2)}`, categoryId: firstCat[0], shapeId: '', sizeId: '', colorId: '', quantity: '' }
    ]);
  }

  function updateNewLine(tempId: string, patch: Partial<NewLine>) {
    setNewLines(newLines.map((l) => (l.tempId === tempId ? { ...l, ...patch } : l)));
  }

  function removeNewLine(tempId: string) {
    setNewLines(newLines.filter((l) => l.tempId !== tempId));
  }

  async function saveEdits() {
    const updates = items
      .filter((i) => !removedIds.has(i.id) && quantities[i.id] !== i.quantity)
      .map((i) => ({ id: i.id, quantity: quantities[i.id] }));

    const validNewItems = newLines
      .filter((l) => l.shapeId && l.sizeId && l.colorId && parseInt(l.quantity, 10) > 0)
      .map((l) => ({
        categoryId: l.categoryId,
        shapeId: l.shapeId,
        sizeId: l.sizeId,
        colorId: l.colorId,
        quantity: parseInt(l.quantity, 10)
      }));

    setSaving(true);
    const res = await fetch(`/api/account/orders/${orderId}/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates, removedIds: Array.from(removedIds), newItems: validNewItems })
    });
    setSaving(false);

    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setToast(data.error || 'Failed to save changes.');
    }
  }

  function reorder() {
    let cart: any[] = [];
    try {
      const raw = window.localStorage.getItem(CART_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      cart = Array.isArray(parsed) ? parsed : [];
    } catch {
      cart = [];
    }

    items.forEach((item) => {
      const existing = cart.find(
        (c) => c.categoryId === item.categoryId && c.shapeId === item.shapeId && c.sizeId === item.sizeId && c.colorId === item.colorId
      );
      if (existing) {
        existing.qty += item.quantity;
      } else {
        cart.push({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          shapeId: item.shapeId,
          shapeName: item.shapeName,
          sizeId: item.sizeId,
          sizeMm: item.sizeMm,
          colorId: item.colorId,
          colorName: item.colorName,
          colorHex: item.colorHex,
          qty: item.quantity
        });
      }
    });

    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      // storage full/disabled -- nothing we can do, cart just won't persist
    }

    const firstSlug = items[0]?.categorySlug;
    if (firstSlug) router.push(`/category/${firstSlug}`);
  }

  return (
    <>
      <section style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, color: 'var(--ink)' }}>Line items</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn-ghost" onClick={reorder}>Reorder</button>
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
            {editing && newLines.map((l) => {
              const opts = categoryOptions[l.categoryId];
              const sizesForShape = opts?.sizes.filter((s) => s.shapeId === l.shapeId) || [];
              return (
                <tr key={l.tempId}>
                  <td>{orderCategories.find(([id]) => id === l.categoryId)?.[1]}</td>
                  <td>
                    <select
                      value={l.shapeId}
                      onChange={(e) => updateNewLine(l.tempId, { shapeId: e.target.value ? Number(e.target.value) : '', sizeId: '' })}
                      style={{ fontSize: 12 }}
                    >
                      <option value="">Choose shape</option>
                      {opts?.shapes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select
                      value={l.sizeId}
                      onChange={(e) => updateNewLine(l.tempId, { sizeId: e.target.value ? Number(e.target.value) : '' })}
                      disabled={!l.shapeId}
                      style={{ fontSize: 12 }}
                    >
                      <option value="">Choose size</option>
                      {sizesForShape.map((s) => <option key={s.id} value={s.id}>{s.sizeMm} mm</option>)}
                    </select>
                  </td>
                  <td>
                    <select
                      value={l.colorId}
                      onChange={(e) => updateNewLine(l.tempId, { colorId: e.target.value ? Number(e.target.value) : '' })}
                      style={{ fontSize: 12 }}
                    >
                      <option value="">Choose color</option>
                      {opts?.colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Qty"
                      value={l.quantity}
                      onChange={(e) => updateNewLine(l.tempId, { quantity: e.target.value.replace(/\D/g, '') })}
                      style={{ maxWidth: 80, fontSize: 13 }}
                    />
                  </td>
                  <td>
                    <button type="button" className="btn-danger" onClick={() => removeNewLine(l.tempId)}>Remove</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        {editing && (
          <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button type="button" className="btn-ghost" onClick={addNewLine}>+ Add line</button>
            <button type="button" className="btn" onClick={saveEdits} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => { setEditing(false); setQuantities(Object.fromEntries(items.map((i) => [i.id, i.quantity]))); setRemovedIds(new Set()); setNewLines([]); }}
            >
              Cancel
            </button>
            {toast && <span style={{ color: '#a3341f', fontSize: 12.5 }}>{toast}</span>}
          </div>
        )}
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
