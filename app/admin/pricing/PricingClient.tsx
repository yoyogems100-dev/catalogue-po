'use client';

import { useEffect, useMemo, useState } from 'react';

type Category = { id: number; name: string };
type Shape = { id: number; name: string };
type Size = { id: number; shapeId: number; sizeMm: string };
type Group = { id: number; name: string; sort_order: number };
type Price = { shapeId: number; shapeSizeId: number; groupId: number; priceRmb: number };

export default function PricingClient({ categories, initialMultiplier }: { categories: Category[]; initialMultiplier: string }) {
  const defaultCat = categories.find((c) => c.name.toLowerCase().includes('crushed ice')) || categories[0];
  const [categoryId, setCategoryId] = useState<number | null>(defaultCat?.id ?? null);
  const [multiplier, setMultiplier] = useState(initialMultiplier);
  const [savingMultiplier, setSavingMultiplier] = useState(false);

  const [shapes, setShapes] = useState<Shape[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [activeShapeId, setActiveShapeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!categoryId) return;
    setLoading(true);
    fetch(`/api/pricing?category_id=${categoryId}`)
      .then((r) => r.json())
      .then((data) => {
        setShapes(data.shapes || []);
        setSizes(data.sizes || []);
        setGroups(data.groups || []);
        setPrices(data.prices || []);
        setActiveShapeId(data.shapes?.[0]?.id ?? null);
      })
      .finally(() => setLoading(false));
  }, [categoryId]);

  async function saveMultiplier() {
    setSavingMultiplier(true);
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'rmb_inr_multiplier', value: multiplier })
    });
    setSavingMultiplier(false);
  }

  const activeSizes = useMemo(
    () => sizes.filter((s) => s.shapeId === activeShapeId).sort((a, b) => a.sizeMm.localeCompare(b.sizeMm, undefined, { numeric: true })),
    [sizes, activeShapeId]
  );

  function priceAt(shapeSizeId: number, groupId: number): number | null {
    const p = prices.find((p) => p.shapeSizeId === shapeSizeId && p.groupId === groupId);
    return p ? p.priceRmb : null;
  }

  async function savePrice(shapeSizeId: number, groupId: number, rawValue: string) {
    if (!categoryId || !activeShapeId) return;
    const value = rawValue.trim();
    const priceRmb = value === '' ? null : Number(value);
    if (value !== '' && (Number.isNaN(priceRmb!) || priceRmb! < 0)) return;

    setPrices((cur) => {
      const without = cur.filter((p) => !(p.shapeSizeId === shapeSizeId && p.groupId === groupId));
      return priceRmb === null ? without : [...without, { shapeId: activeShapeId, shapeSizeId, groupId, priceRmb: priceRmb! }];
    });

    await fetch('/api/pricing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_id: categoryId,
        shape_id: activeShapeId,
        shape_size_id: shapeSizeId,
        price_group_id: groupId,
        price_rmb: priceRmb
      })
    });
  }

  function exportCsv() {
    const mult = Number(multiplier) || 1;
    const rows = [['Shape', 'Size (mm)', 'Color Group', 'Price (RMB)', 'Price (INR)']];
    for (const shape of shapes) {
      const shapeSizes = sizes.filter((s) => s.shapeId === shape.id);
      for (const size of shapeSizes) {
        for (const group of groups) {
          const price = priceAt(size.id, group.id);
          if (price === null) continue;
          rows.push([shape.name, size.sizeMm, group.name, price.toFixed(2), (price * mult).toFixed(2)]);
        }
      }
    }
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pricing-${categories.find((c) => c.id === categoryId)?.name || 'export'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="card" style={{ padding: 16, marginBottom: 20, display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, fontWeight: 500 }}>
            Category
          </label>
          <select value={categoryId ?? ''} onChange={(e) => setCategoryId(Number(e.target.value))} style={{ width: 220 }}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, fontWeight: 500 }}>
            RMB &rarr; INR multiplier
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              step="0.01"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
              style={{ width: 100 }}
            />
            <button className="btn" onClick={saveMultiplier} disabled={savingMultiplier}>
              {savingMultiplier ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        <button className="btn-ghost" onClick={exportCsv} disabled={!shapes.length}>Export CSV (English)</button>
        <a
          className="btn"
          href={categoryId ? `/api/admin/pricing/pdf?category_id=${categoryId}` : undefined}
          style={!categoryId ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
        >
          Export PDF (branded)
        </a>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Loading...</p>
      ) : shapes.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>This category has no shapes linked yet.</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {shapes.map((s) => (
              <button
                key={s.id}
                className="btn-ghost"
                onClick={() => setActiveShapeId(s.id)}
                style={activeShapeId === s.id ? { background: 'var(--navy)', color: '#fff', borderColor: 'var(--navy)' } : {}}
              >
                {s.name}
              </button>
            ))}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Size (mm)</th>
                  {groups.map((g) => <th key={g.id}>{g.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {activeSizes.map((size) => (
                  <tr key={size.id}>
                    <td className="mono" style={{ fontWeight: 600 }}>{size.sizeMm}</td>
                    {groups.map((g) => {
                      const price = priceAt(size.id, g.id);
                      const mult = Number(multiplier) || 1;
                      return (
                        <td key={g.id} style={{ minWidth: 100 }}>
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={price ?? ''}
                            placeholder="--"
                            className="mono"
                            style={{ width: 72, padding: '5px 6px', fontSize: 12.5 }}
                            onBlur={(e) => savePrice(size.id, g.id, e.target.value)}
                          />
                          {price !== null && (
                            <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                              &#8377;{(price * mult).toFixed(0)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
