'use client';

import { useEffect, useMemo, useState } from 'react';

type Category = { id: number; name: string };
type Shape = { id: number; name: string };
type Size = { id: number; shapeId: number; sizeMm: string };
type Group = { id: number; name: string; sort_order: number };
type Price = { shapeId: number; shapeSizeId: number; groupId: number; priceRmb: number };

export default function PricingClient({ categories, initialMultiplier, initialCategoryId }: { categories: Category[]; initialMultiplier: string; initialCategoryId?: number }) {
  const defaultCat = categories.find(c => c.id === initialCategoryId) || categories.find((c) => c.name.toLowerCase().includes('crushed ice')) || categories[0];
  const [categoryId, setCategoryId] = useState<number | null>(defaultCat?.id ?? null);
  const [multiplier, setMultiplier] = useState(initialMultiplier);
  const [currency, setCurrency] = useState<'RMB' | 'INR'>('RMB');
  const [savedMultiplier, setSavedMultiplier] = useState(initialMultiplier);
  const conversionRate = Number(savedMultiplier);
  const validRate = Number.isFinite(conversionRate) && conversionRate > 0;
  const [savingPrice, setSavingPrice] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [savingMultiplier, setSavingMultiplier] = useState(false);

  const [shapes, setShapes] = useState<Shape[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [activeShapeId, setActiveShapeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  // UI/UX audit ("visible saved-state feedback"): a price edit or multiplier
  // change previously saved (or silently failed) with no acknowledgement.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!categoryId) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    fetch(`/api/pricing?category_id=${categoryId}`, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error('Unable to load prices.'); return r.json(); })
      .then((data) => {
        setShapes(data.shapes || []);
        setSizes(data.sizes || []);
        setGroups(data.groups || []);
        setPrices(data.prices || []);
        setActiveShapeId(data.shapes?.[0]?.id ?? null);
      })
      .catch(error => { if (error.name !== 'AbortError') { setLoadError('Prices could not be loaded. Please reload.'); setShapes([]); setPrices([]); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [categoryId]);

  async function saveMultiplier() {
    const value = Number(multiplier);
    if (!Number.isFinite(value) || value <= 0) { setToast('Enter a positive multiplier.'); return; }
    setSavingMultiplier(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'rmb_inr_multiplier', value })
      });
      if (!res.ok) throw new Error();
      setSavedMultiplier(String(value)); setMultiplier(String(value));
      setToast('Multiplier saved.');
    } catch { setToast('Multiplier could not be saved. Please retry.'); }
    finally { setSavingMultiplier(false); }
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
    if (!categoryId || !activeShapeId || currency !== 'RMB') return;
    const value = rawValue.trim();
    const priceRmb = value === '' ? null : Number(value);
    if (value !== '' && (!Number.isFinite(priceRmb!) || priceRmb! < 0)) { setToast('Enter a valid non-negative price.'); return; }
    if (priceRmb === priceAt(shapeSizeId, groupId)) return;
    setSavingPrice(true);
    try {

    const res = await fetch('/api/pricing', {
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
    if (!res.ok) throw new Error();
    setPrices((cur) => {
      const without = cur.filter((p) => !(p.shapeSizeId === shapeSizeId && p.groupId === groupId));
      return priceRmb === null ? without : [...without, { shapeId: activeShapeId, shapeSizeId, groupId, priceRmb: priceRmb! }];
    });

    setToast('Saved.');
    } catch { setToast('Price could not be saved. Please retry the edit before exporting.'); }
    finally { setSavingPrice(false); }
  }

  function exportCsv() {
    const mult = conversionRate;
    const rows = [currency === 'INR' ? ['Shape', 'Size (mm)', 'Color Group', 'Price (INR)'] : ['Shape', 'Size (mm)', 'Color Group', 'Price (RMB)', 'Price (INR)']];
    for (const shape of shapes) {
      const shapeSizes = sizes.filter((s) => s.shapeId === shape.id);
      for (const size of shapeSizes) {
        for (const group of groups) {
          const price = priceAt(size.id, group.id);
          if (price === null) continue;
          rows.push(currency === 'INR' ? [shape.name, size.sizeMm, group.name, (price * mult).toFixed(2)] : [shape.name, size.sizeMm, group.name, price.toFixed(2), validRate ? (price * mult).toFixed(2) : '']);
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
          <select aria-label="Pricing category" disabled={savingPrice || savingMultiplier} value={categoryId ?? ''} onChange={(e) => setCategoryId(Number(e.target.value))} style={{ width: '100%', minWidth: 180, maxWidth: 220 }}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <label>Currency
          <select aria-label="Pricing currency" value={currency} disabled={savingPrice || savingMultiplier} onChange={e => setCurrency(e.target.value as 'RMB' | 'INR')}>
            <option value="RMB">RMB</option><option value="INR">INR</option>
          </select>
        </label>
        {currency === 'RMB' && <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, fontWeight: 500 }}>
            RMB &rarr; INR multiplier
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              aria-label="RMB to INR multiplier"
              type="number"
              step="0.01"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
              style={{ width: 100 }}
            />
            <button className="btn" onClick={saveMultiplier} disabled={savingMultiplier || savingPrice || multiplier === savedMultiplier}>
              {savingMultiplier ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>}
        <button className="btn-ghost" onClick={exportCsv} disabled={!shapes.length || loading || savingPrice || savingMultiplier || (currency === 'INR' && !validRate)}>Export CSV (English)</button>
        <a
          className="btn"
          href={categoryId && validRate && !savingPrice && !savingMultiplier && !loading ? `/api/admin/pricing/pdf?category_id=${categoryId}` : undefined}
          aria-disabled={!categoryId || !validRate || savingPrice || savingMultiplier || loading}
          style={!categoryId ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
        >
          Export PDF (INR only)
        </a>
      </div>

      <p>{currency === 'INR' ? 'INR prices per piece. Switch currency to edit supplier prices.' : 'Edit RMB prices per piece. Converted amounts use the saved multiplier.'}</p>
      {currency === 'RMB' && multiplier !== savedMultiplier && <p role="status">Multiplier changes are not saved yet. Converted prices and exports use the saved value.</p>}
      {!validRate && <p role="alert">Set and save a valid conversion rate before viewing or exporting INR prices.</p>}
      {loadError && <p role="alert">{loadError}</p>}
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
                disabled={savingPrice}
                aria-pressed={activeShapeId === s.id}
                onClick={() => setActiveShapeId(s.id)}
                style={activeShapeId === s.id ? { background: 'var(--navy)', color: '#fff', borderColor: 'var(--navy)' } : {}}
              >
                {s.name}
              </button>
            ))}
          </div>

          <p className="pricing-scroll-hint" style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
            &#8592; Swipe to see all {groups.length} color groups &#8594;
          </p>
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
                      const mult = conversionRate;
                      return (
                        <td key={g.id} style={{ minWidth: 100 }}>
                          {currency === 'INR' ? <span className="mono" aria-label={`${size.sizeMm} mm ${g.name} INR price`}>{price !== null && validRate ? `₹${(price * mult).toFixed(2)}` : '—'}</span> : <>
                          <input
                            key={`${categoryId}:${activeShapeId}:${size.id}:${g.id}:${price}`}
                            aria-label={`${size.sizeMm} mm ${g.name} RMB price`}
                            disabled={savingPrice}
                            type="number"
                            step="0.01"
                            defaultValue={price ?? ''}
                            placeholder="--"
                            className="mono"
                            style={{ width: 72, padding: '5px 6px', fontSize: 12.5 }}
                            onBlur={(e) => savePrice(size.id, g.id, e.target.value)}
                          />
                          {price !== null && validRate && (
                            <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                              &#8377;{(price * mult).toFixed(2)}
                            </div>
                          )}
                          </>}
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
      {toast && <p className="po-toast" role="status" aria-live="polite">{toast}</p>}
    </>
  );
}
