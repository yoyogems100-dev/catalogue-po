'use client';

import { useEffect, useMemo, useState } from 'react';
import IconSelect from '@/components/IconSelect';
import { categoryIconUrl } from '@/lib/category-icons';
import { DEFAULT_PRICE_UNIT, PRICE_UNIT_PRESETS, PRICE_UNIT_MAX, priceUnitLabel } from '@/lib/price-unit';

type Category = { id: number; name: string; slug: string | null };
type Shape = { id: number; name: string };
type Size = { id: number; shapeId: number; sizeMm: string };
import type { PriceColumn } from '@/lib/price-columns';
type Price = { shapeId: number; shapeSizeId: number; groupId: number; priceInr: number };

export default function PricingClient({ categories, initialCategoryId }: { categories: Category[]; initialCategoryId?: number }) {
  const defaultCat = categories.find(c => c.id === initialCategoryId) || categories.find((c) => c.name.toLowerCase().includes('crushed ice')) || categories[0];
  const [categoryId, setCategoryId] = useState<number | null>(defaultCat?.id ?? null);
  const [savingPrice, setSavingPrice] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [shapes, setShapes] = useState<Shape[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [columns, setColumns] = useState<PriceColumn[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [priceUnit, setPriceUnit] = useState<string>(DEFAULT_PRICE_UNIT);
  const [customUnit, setCustomUnit] = useState('');
  // Whether the free-text box is open. Derived state was wrong here: picking
  // "Other..." while the saved unit is still a preset left nothing to type in.
  const [otherUnit, setOtherUnit] = useState(false);
  const [activeShapeId, setActiveShapeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

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
        setColumns(data.columns || []);
        setPrices(data.prices || []);
        setActiveShapeId(data.shapes?.[0]?.id ?? null);
        const unit = priceUnitLabel(data.priceUnit);
        setPriceUnit(unit);
        // A unit the owner typed themselves has to survive the round trip, so
        // the select lands on "Other" with the word still in the box.
        const preset = (PRICE_UNIT_PRESETS as readonly string[]).includes(unit);
        setCustomUnit(preset ? '' : unit);
        setOtherUnit(!preset);
      })
      .catch(error => { if (error.name !== 'AbortError') { setLoadError('Prices could not be loaded. Please reload.'); setShapes([]); setPrices([]); setColumns([]); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [categoryId]);

  const activeSizes = useMemo(
    () => sizes.filter((s) => s.shapeId === activeShapeId).sort((a, b) => a.sizeMm.localeCompare(b.sizeMm, undefined, { numeric: true })),
    [sizes, activeShapeId]
  );

  function priceAt(shapeSizeId: number, groupId: number): number | null {
    const p = prices.find((p) => p.shapeSizeId === shapeSizeId && p.groupId === groupId);
    return p ? p.priceInr : null;
  }

  async function savePrice(shapeSizeId: number, groupId: number, rawValue: string) {
    if (!categoryId || !activeShapeId) return;
    const value = rawValue.trim();
    const priceInr = value === '' ? null : Number(value);
    if (value !== '' && (!Number.isFinite(priceInr!) || priceInr! < 0)) { setToast('Enter a valid non-negative price.'); return; }
    if (priceInr === priceAt(shapeSizeId, groupId)) return;
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
        price_inr: priceInr
      })
    });
    if (!res.ok) throw new Error();
    setPrices((cur) => {
      const without = cur.filter((p) => !(p.shapeSizeId === shapeSizeId && p.groupId === groupId));
      return priceInr === null ? without : [...without, { shapeId: activeShapeId, shapeSizeId, groupId, priceInr: priceInr! }];
    });

    setToast('Saved.');
    } catch { setToast('Price could not be saved. Please retry the edit before exporting.'); }
    finally { setSavingPrice(false); }
  }

  async function saveUnit(unit: string) {
    if (!categoryId) return;
    const previous = priceUnit;
    setPriceUnit(unit);
    try {
      const res = await fetch('/api/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: categoryId, price_unit: unit })
      });
      if (!res.ok) throw new Error();
      setToast(`Prices are now per ${unit}.`);
    } catch {
      // Put the old word back rather than leave the screen claiming a unit
      // the price list will not print.
      setPriceUnit(previous);
      setToast('The unit could not be saved. Please retry.');
    }
  }

  function exportCsv() {
    const rows = [['Shape', 'Size (mm)', 'Color', 'Price column', `Price (₹ per ${priceUnit})`]];
    for (const shape of shapes) {
      const shapeSizes = sizes.filter((s) => s.shapeId === shape.id);
      for (const size of shapeSizes) {
        for (const column of columns) {
          const price = priceAt(size.id, column.groupId);
          if (price === null) continue;
          // One row per colour the column covers. A column covering every
          // colour in the category still gets a row each, so the sheet reads
          // the same whether or not the category prices by colour.
          const colors = column.colors.length ? column.colors : [''];
          for (const color of colors) {
            rows.push([shape.name, size.sizeMm, color, column.label, price.toFixed(2)]);
          }
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
          <div style={{ width: '100%', minWidth: 180, maxWidth: 220 }}>
            <IconSelect
              options={categories.map((c) => ({ id: c.id, name: c.name, refPhotoUrl: categoryIconUrl(c.slug) }))}
              value={categoryId ?? 'all'}
              onChange={(v) => { if (v !== 'all') setCategoryId(Number(v)); }}
              allLabel="Choose category"
              leading="photo"
              searchable
            />
          </div>
        </div>
        <button className="btn-ghost" onClick={exportCsv} disabled={!shapes.length || loading || savingPrice}>Export CSV (English)</button>
        <a
          className="btn"
          href={categoryId && !savingPrice && !loading ? `/api/admin/pricing/pdf?category_id=${categoryId}` : undefined}
          aria-disabled={!categoryId || savingPrice || loading}
          style={!categoryId ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
        >
          Download price list
        </a>
        <a
          className="btn-ghost"
          href={categoryId && !savingPrice && !loading ? `/api/categories/${categoryId}/size-chart` : undefined}
          aria-disabled={!categoryId || savingPrice || loading}
          style={!categoryId ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
        >
          Download shape &amp; size chart
        </a>
      </div>

      <div className="price-unit-row">
        <label htmlFor="price-unit">Price per</label>
        <select
          id="price-unit"
          value={otherUnit ? 'other' : priceUnit}
          disabled={!categoryId || loading || savingPrice}
          onChange={(e) => {
            if (e.target.value === 'other') { setOtherUnit(true); return; }
            setOtherUnit(false);
            setCustomUnit('');
            saveUnit(e.target.value);
          }}
        >
          {PRICE_UNIT_PRESETS.map((u) => <option key={u} value={u}>{u}</option>)}
          <option value="other">Other...</option>
        </select>
        {otherUnit ? (
          <input
            aria-label="Custom price unit"
            placeholder="e.g. strip"
            maxLength={PRICE_UNIT_MAX}
            value={customUnit}
            disabled={!categoryId || loading || savingPrice}
            onChange={(e) => setCustomUnit(e.target.value)}
            autoFocus
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== priceUnit) saveUnit(v); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
        ) : null}
        <span className="price-unit-hint">₹ prices below are per {priceUnit}.</span>
      </div>
      {loadError && <p role="alert">{loadError}</p>}
      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Loading...</p>
      ) : shapes.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>This category has no shapes linked yet.</p>
      ) : (
        <>
          {/* One shape is not a choice, and a row holding a single lit button
              reads as a filter the reader has to understand before they can
              type a price. */}
          {shapes.length > 1 && <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
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
          </div>}

          {columns.length > 1 && (
            <p className="pricing-scroll-hint" style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
              &#8592; Swipe to see all {columns.length} price columns &#8594;
            </p>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Size (mm)</th>
                  {columns.map((c) => <th key={c.groupId}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {activeSizes.map((size) => (
                  <tr key={size.id}>
                    <td className="mono" style={{ fontWeight: 600 }}>{size.sizeMm}</td>
                    {columns.map((g) => {
                      const price = priceAt(size.id, g.groupId);
                      return (
                        <td key={g.groupId} style={{ minWidth: 100 }}>
                          <input
                            key={`${categoryId}:${activeShapeId}:${size.id}:${g.groupId}:${price}`}
                            aria-label={`${size.sizeMm} mm ${g.label} INR price`}
                            disabled={savingPrice}
                            type="number"
                            step="0.01"
                            defaultValue={price ?? ''}
                            placeholder="--"
                            className="mono"
                            style={{ width: 80, padding: '5px 6px', fontSize: 12.5 }}
                            onBlur={(e) => savePrice(size.id, g.groupId, e.target.value)}
                          />
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
