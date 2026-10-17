'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import IconSelect from '@/components/IconSelect';
import PriceListDownloadButton from '@/components/admin/PriceListDownloadButton';
import CustomerNamesInput from '@/components/admin/CustomerNamesInput';
import { todayIso } from '@/lib/price-list-options';
import GSeriesPricing from '@/components/admin/GSeriesPricing';
import { categoryIconUrl } from '@/lib/category-icons';
import { DEFAULT_PRICE_UNIT, PRICE_UNIT_PRESETS, PRICE_UNIT_MAX, priceUnitLabel } from '@/lib/price-unit';
import { QUANTITY_LABEL_MAX, QUANTITY_UNIT_MAX } from '@/lib/quantity-field';

type Category = { id: number; name: string; slug: string | null };
type Shape = { id: number; name: string };
type Size = { id: number; shapeId: number; sizeMm: string };
import type { PriceColumn } from '@/lib/price-columns';
type Price = { shapeId: number; shapeSizeId: number; groupId: number; priceInr: number };
type SavedCustomerList = { id: number; customerName: string; priceDate: string; updatedAt: string };
const shortDate = (iso: string) => new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

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
  // The order form's quantity field for this category: its name and starting value.
  const [qtyLabel, setQtyLabel] = useState('');
  const [defaultQty, setDefaultQty] = useState('');
  const [qtyUnitWord, setQtyUnitWord] = useState('');
  const [weightUnit, setWeightUnit] = useState<'g' | 'ct'>('g');
  const [savedQty, setSavedQty] = useState({ label: '', defaultQty: '', unit: '', weightUnit: 'g' });
  const [savingQty, setSavingQty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  // Customer prices (customer_price_lists): a buyer's own copy of this
  // category's prices. null = the default prices are on screen.
  const [custLists, setCustLists] = useState<SavedCustomerList[]>([]);
  const [buyerNames, setBuyerNames] = useState<string[]>([]);
  const [custListId, setCustListId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [custNames, setCustNames] = useState<string[]>([]);
  const [custDate, setCustDate] = useState(todayIso());
  const [custCells, setCustCells] = useState<Record<string, string>>({});
  const [custSaved, setCustSaved] = useState<{ cells: Record<string, string>; names: string[]; date: string }>({ cells: {}, names: [], date: '' });
  const [custBusy, setCustBusy] = useState(false);
  const [custError, setCustError] = useState('');

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
        const q = { label: data.quantityField?.label || '', defaultQty: data.quantityField?.defaultQty ? String(data.quantityField.defaultQty) : '', unit: data.quantityField?.unit || '', weightUnit: data.quantityField?.weightUnit === 'ct' ? 'ct' : 'g' };
        setQtyLabel(q.label);
        setDefaultQty(q.defaultQty);
        setQtyUnitWord(q.unit);
        setWeightUnit(q.weightUnit as 'g' | 'ct');
        setSavedQty(q);
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

  // Crushed Ice prices by G-Series column get the price-list workspace
  // (default and per-customer prices, laid out like the printed list).
  const gSeries = columns.some((c) => c.label.startsWith('G-Series '));

  const isCustomer = custListId !== null || creating;
  const custChanged = Object.keys({ ...custCells, ...custSaved.cells }).filter((k) => (custCells[k] || '') !== (custSaved.cells[k] || '')).length;
  const custDirty = isCustomer && (creating || custChanged > 0 || custNames.join('|') !== custSaved.names.join('|') || custDate !== custSaved.date);
  const custBad = Object.values(custCells).some((v) => v.trim() !== '' && !(Number(v) >= 0));

  const loadCustomerLists = useCallback(async (catId: number) => {
    const res = await fetch(`/api/admin/pricing/customer?category_id=${catId}`).catch(() => null);
    const body = res && res.ok ? await res.json() : null;
    setCustLists(body?.lists || []);
    setBuyerNames(body?.buyers || []);
  }, []);

  // A category change goes back to its default prices.
  useEffect(() => {
    setCustListId(null); setCreating(false); setCustCells({}); setCustSaved({ cells: {}, names: [], date: '' }); setCustError('');
    if (categoryId) loadCustomerLists(categoryId);
  }, [categoryId, loadCustomerLists]);

  const asCells = (entries: { shapeSizeId: number; groupId: number; price: number }[]) =>
    Object.fromEntries(entries.map((e) => [`${e.shapeSizeId}:${e.groupId}`, String(e.price)]));

  function confirmLeaveCustomer() {
    return !custDirty || window.confirm('You have unsaved customer prices. Leave without saving?');
  }

  async function openCustomer(id: number | null) {
    if (!categoryId || !confirmLeaveCustomer()) return;
    setCustError('');
    setCreating(false);
    if (id === null) { setCustListId(null); setCustCells({}); setCustSaved({ cells: {}, names: [], date: '' }); return; }
    setCustBusy(true);
    try {
      const res = await fetch(`/api/admin/pricing/customer?category_id=${categoryId}&list_id=${id}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Customer prices could not be loaded.');
      const cells = asCells((body.entries || []).map((e: { s: number; g: number; p: number }) => ({ shapeSizeId: e.s, groupId: e.g, price: e.p })));
      setCustListId(id);
      setCustCells(cells);
      setCustNames([body.list.customerName]);
      setCustDate(body.list.priceDate);
      setCustSaved({ cells, names: [body.list.customerName], date: body.list.priceDate });
    } catch (e) {
      setCustError((e as Error).message);
    } finally {
      setCustBusy(false);
    }
  }

  // Starts from the default prices; nothing is stored until Save.
  function startCustomer() {
    if (!confirmLeaveCustomer()) return;
    const cells = asCells(prices.map((p) => ({ shapeSizeId: p.shapeSizeId, groupId: p.groupId, price: p.priceInr })));
    setCustListId(null);
    setCreating(true);
    setCustCells(cells);
    setCustNames([]);
    setCustDate(todayIso());
    setCustSaved({ cells, names: [], date: '' });
    setCustError('');
  }

  async function saveCustomer() {
    if (!categoryId) return;
    if (custBad) { setCustError('Check the highlighted prices: each should be a number, or empty.'); return; }
    if (!custNames.length) { setCustError('Choose a buyer or type the customer’s name.'); return; }
    setCustBusy(true);
    setCustError('');
    try {
      const entries = Object.entries(custCells).filter(([, v]) => v.trim() !== '').map(([k, v]) => { const [s, g] = k.split(':').map(Number); return { s, g, p: Number(v) }; });
      const res = await fetch('/api/admin/pricing/customer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: categoryId, list_id: custListId, customer_names: custNames, date: custDate, entries })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'The prices could not be saved. Please retry.');
      await loadCustomerLists(categoryId);
      setToast(custNames.length > 1 ? `Saved for ${custNames.length} customers.` : `Saved ${custNames[0]}’s prices.`);
      setCreating(false);
      setCustBusy(false);
      // Back on the first customer's copy, as saved.
      const firstId = body.listIds?.[0];
      if (firstId) { setCustSaved({ cells: custCells, names: [custNames[0]], date: custDate }); setCustNames([custNames[0]]); setCustListId(firstId); }
    } catch (e) {
      setCustError((e as Error).message);
      setCustBusy(false);
    }
  }

  async function removeCustomer() {
    if (!categoryId || !custListId) return;
    const name = custSaved.names[0] || 'this customer';
    if (!window.confirm(`Remove ${name}’s saved prices? The default prices stay.`)) return;
    setCustBusy(true);
    try {
      const res = await fetch(`/api/admin/pricing/grid?category_id=${categoryId}&list_id=${custListId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setCustListId(null); setCustCells({}); setCustSaved({ cells: {}, names: [], date: '' });
      await loadCustomerLists(categoryId);
      setToast('Customer prices removed.');
    } catch {
      setCustError('The customer’s prices could not be removed. Please retry.');
    } finally {
      setCustBusy(false);
    }
  }

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

  async function saveQuantityField() {
    if (!categoryId) return;
    setSavingQty(true);
    try {
      const res = await fetch(`/api/admin/categories/${categoryId}/quantity-field`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: qtyLabel, defaultQty: defaultQty.trim() || null, unit: qtyUnitWord, weightUnit })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'The quantity field could not be saved. Please retry.');
      setSavedQty({ label: qtyLabel.trim(), defaultQty: defaultQty.trim(), unit: body.field?.unit || '', weightUnit });
      setQtyUnitWord(body.field?.unit || '');
      setToast('Saved. The order form now uses this.');
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setSavingQty(false);
    }
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
    const rows = [['Shape/Cut', 'Size (mm)', 'Color', 'Price column', `Price (₹ per ${priceUnit})`]];
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
              onChange={(v) => { if (v !== 'all' && confirmLeaveCustomer()) setCategoryId(Number(v)); }}
              allLabel="Choose category"
              leading="photo"
              searchable
            />
          </div>
        </div>
        <button className="btn-ghost" onClick={exportCsv} disabled={!shapes.length || loading || savingPrice}>Export CSV (English)</button>
        {gSeries ? null : categoryId ? (
          <PriceListDownloadButton
            key={`${categoryId}:${custListId ?? 0}`}
            categoryId={categoryId}
            className="btn"
            disabled={savingPrice || loading || custBusy || custDirty}
            current={isCustomer ? { sourceListId: custListId, customerName: custNames[0] || '', date: custDate } : undefined}
            onSaved={() => { if (categoryId) loadCustomerLists(categoryId); setToast('Downloaded, and saved as the customer’s prices.'); }}
          />
        ) : (
          <button type="button" className="btn" disabled>Download price list</button>
        )}
        <a
          className="btn-ghost"
          href={categoryId && !savingPrice && !loading ? `/api/categories/${categoryId}/size-chart` : undefined}
          aria-disabled={!categoryId || savingPrice || loading}
          style={!categoryId ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
        >
          Download shape &amp; size chart
        </a>
      </div>

      {!gSeries && categoryId && (
        <>
          <div className="gs-toolbar cp-toolbar">
            <div className="gs-picker">
              <label>Prices for</label>
              <IconSelect
                options={custLists.map((l) => ({ id: l.id, name: `${l.customerName} · ${shortDate(l.priceDate)}` }))}
                value={creating ? 'all' : custListId ?? 'all'}
                onChange={(v) => openCustomer(v === 'all' ? null : Number(v))}
                allLabel="Default prices"
                leading="none"
                searchable
              />
            </div>
            <button type="button" className="btn-ghost" onClick={startCustomer} disabled={custBusy || loading || savingPrice}>+ Customer prices</button>
          </div>
          {isCustomer ? (
            <div className="gs-customer">
              <label>
                <span>{custNames.length > 1 ? `Customers (${custNames.length})` : 'Customer'}</span>
                <CustomerNamesInput names={custNames} onChange={setCustNames} suggestions={[...new Set([...buyerNames, ...custLists.map((l) => l.customerName)])]} autoFocus={creating} disabled={custBusy} />
              </label>
              <label>
                <span>Prices dated</span>
                <input type="date" value={custDate} onChange={(e) => setCustDate(e.target.value)} disabled={custBusy} />
              </label>
              {custListId && !creating && <button type="button" className="btn-link gs-remove" onClick={removeCustomer} disabled={custBusy}>Remove customer prices</button>}
              <p className="gs-dim">
                {creating
                  ? 'Starts from the default prices. Change what these customers pay, then Save. Add several buyers to give them all the same prices.'
                  : `Only ${custSaved.names[0] || 'this customer'}’s prices change here; the default prices stay as they are. Faded numbers are the defaults. Add more names to copy these prices to other buyers.`}
              </p>
            </div>
          ) : (
            <p className="gs-dim gs-default-note">Default prices: the starting point for every customer. {custLists.length ? `${custLists.length} customer${custLists.length === 1 ? ' has' : 's have'} their own prices; pick one above.` : 'Use “+ Customer prices” to keep different prices for one or more buyers.'}</p>
          )}
          {custError && <p className="price-list-error" role="alert">{custError}</p>}
          {isCustomer && custDirty && <p className="gs-dim">Save before downloading this customer’s price list.</p>}
        </>
      )}

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
      <div className="price-unit-row qty-field-row">
        <label htmlFor="qty-field-label">Quantity field</label>
        <input
          id="qty-field-label"
          placeholder="Qty (pcs)"
          maxLength={QUANTITY_LABEL_MAX}
          value={qtyLabel}
          disabled={!categoryId || loading || savingQty}
          onChange={(e) => setQtyLabel(e.target.value)}
        />
        <label htmlFor="qty-field-default">starts at</label>
        <input
          id="qty-field-default"
          inputMode="numeric"
          placeholder="empty"
          className="qty-field-default"
          value={defaultQty}
          disabled={!categoryId || loading || savingQty}
          onChange={(e) => setDefaultQty(e.target.value.replace(/\D/g, ''))}
        />
        <label htmlFor="qty-field-unit">counted in</label>
        <input
          id="qty-field-unit"
          placeholder="pcs"
          maxLength={QUANTITY_UNIT_MAX}
          value={qtyUnitWord}
          disabled={!categoryId || loading || savingQty}
          onChange={(e) => setQtyUnitWord(e.target.value)}
        />
        <label htmlFor="qty-field-weight">weighed in</label>
        <select id="qty-field-weight" value={weightUnit} disabled={!categoryId || loading || savingQty} onChange={(e) => setWeightUnit(e.target.value as 'g' | 'ct')}>
          <option value="g">g</option>
          <option value="ct">ct</option>
        </select>
        <button
          type="button"
          className="btn-ghost"
          disabled={!categoryId || loading || savingQty || (qtyLabel.trim() === savedQty.label && defaultQty.trim() === savedQty.defaultQty && qtyUnitWord.trim().toLowerCase() === savedQty.unit && weightUnit === savedQty.weightUnit)}
          onClick={saveQuantityField}
        >
          {savingQty ? 'Saving…' : 'Save'}
        </button>
        <span className="price-unit-hint">Buyers start on this number and keep their own once they change it. “Counted in” shows as “8 lines” on orders and PDFs; “weighed in” is where packet weights start.</span>
      </div>
      {loadError && <p role="alert">{loadError}</p>}
      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Loading...</p>
      ) : gSeries && categoryId ? (
        <GSeriesPricing key={categoryId} categoryId={categoryId} />
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
                      if (isCustomer) {
                        const key = `${size.id}:${g.groupId}`;
                        const v = custCells[key] ?? '';
                        const changed = v !== (custSaved.cells[key] ?? '');
                        const bad = v.trim() !== '' && !(Number(v) >= 0);
                        return (
                          <td key={g.groupId} style={{ minWidth: 100 }}>
                            <input
                              aria-label={`${size.sizeMm} mm ${g.label} INR price for ${custNames[0] || 'this customer'}`}
                              inputMode="decimal"
                              value={v}
                              placeholder={price !== null ? String(price) : '--'}
                              title={price !== null ? `Default ${price}` : undefined}
                              disabled={custBusy}
                              className={`mono cp-cell${bad ? ' bad' : changed ? ' changed' : ''}`}
                              style={{ width: 80, padding: '5px 6px', fontSize: 12.5 }}
                              onChange={(e) => { const val = e.target.value.replace(/[^\d.]/g, ''); setCustCells((cur) => ({ ...cur, [key]: val })); }}
                            />
                          </td>
                        );
                      }
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
      {isCustomer && custDirty && !gSeries && (
        <div className="gs-savebar" role="region" aria-label="Unsaved changes">
          <span>{creating ? 'New customer prices' : custChanged ? `${custChanged} price${custChanged === 1 ? '' : 's'} changed` : 'Details changed'}</span>
          <button type="button" className="btn-ghost" onClick={() => (creating ? openCustomer(null) : custListId && openCustomer(custListId))} disabled={custBusy}>Discard</button>
          <button type="button" className="btn" onClick={saveCustomer} disabled={custBusy || custBad}>{custBusy ? 'Saving…' : custNames.length > 1 ? `Save for ${custNames.length} customers` : 'Save customer prices'}</button>
        </div>
      )}
      {toast && <p className="po-toast" role="status" aria-live="polite">{toast}</p>}
    </>
  );
}
