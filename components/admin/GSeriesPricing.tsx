'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import IconSelect from '@/components/IconSelect';
import PriceListDownloadButton from '@/components/admin/PriceListDownloadButton';
import type { GSeriesGrid } from '@/lib/g-series-grid';
import { topView } from '@/lib/three-view';
import { CUSTOMER_NAME_MAX, todayIso } from '@/lib/price-list-options';

type SavedList = { id: number; customerName: string; priceDate: string; updatedAt: string };
type Colour = { code: string; name: string; url: string | null };
type Loaded = { grid: GSeriesGrid; list: { id: number; customerName: string; priceDate: string } | null; lists: SavedList[]; photos: Record<number, Colour[]> };

const shortDate = (iso: string) => new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const asCells = (g: GSeriesGrid) => g.rows.map((r) => r.prices.map((p) => (p === null ? '' : String(p))));
const toPrices = (cells: string[][]) => cells.map((row) => row.map((v) => (v.trim() === '' ? null : Number(v))));

function ShapeMark({ name, iconKey }: { name: string; iconKey: string | null }) {
  const view = topView(iconKey);
  return (
    <span className="gs-shape">
      <svg width={(20 * view.width) / view.height} height={20} viewBox={`0 0 ${view.width} ${view.height}`} fill="none" stroke="currentColor" strokeWidth={0.8} strokeLinejoin="round" aria-hidden="true">
        <path d={view.d} />
      </svg>
      <span>{name}</span>
    </span>
  );
}

/**
 * Crushed Ice G-Series prices, laid out like the printed price list: size
 * rows, one column per colour group A..E. Shows the default prices or a
 * customer's own saved prices (picked at the top, newest first); edit any
 * cell and Save. "Download price list" prints what is on screen.
 */
export default function GSeriesPricing({ categoryId }: { categoryId: number }) {
  const [listId, setListId] = useState<number | null>(null);
  const [data, setData] = useState<Loaded | null>(null);
  const [cells, setCells] = useState<string[][]>([]);
  const [customerName, setCustomerName] = useState('');
  const [priceDate, setPriceDate] = useState(todayIso());
  const [creating, setCreating] = useState(false); // a new customer's prices, not saved yet
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2500); return () => clearTimeout(t); }, [toast]);

  const load = useCallback(async (id: number | null) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/pricing/grid?category_id=${categoryId}${id ? `&list_id=${id}` : ''}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.grid) throw new Error(body.error || 'Prices could not be loaded. Please reload.');
      setData(body);
      setListId(id);
      setCells(asCells(body.grid));
      setCustomerName(body.list?.customerName || '');
      setPriceDate(body.list?.priceDate || todayIso());
      setCreating(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => { load(null); }, [load]);

  const savedCells = useMemo(() => (data ? asCells(data.grid) : []), [data]);
  const changedCount = cells.reduce((n, row, ri) => n + row.filter((v, ci) => v !== savedCells[ri]?.[ci]).length, 0);
  const isCustomer = listId !== null || creating;
  const detailsChanged = listId !== null && data?.list && (customerName.trim() !== data.list.customerName || priceDate !== data.list.priceDate);
  const dirty = changedCount > 0 || creating || Boolean(detailsChanged);
  const badCell = cells.some((row) => row.some((v) => v.trim() !== '' && !(Number(v) >= 0)));

  function confirmLeave() {
    return !dirty || window.confirm('You have unsaved price changes. Leave without saving?');
  }

  function choose(v: number | 'all') {
    if (!confirmLeave()) return;
    load(v === 'all' ? null : v);
  }

  function startNewCustomer() {
    if (!confirmLeave()) return;
    // Starts from the defaults on screen; nothing is stored until Save.
    if (listId !== null) { load(null).then(() => { setCreating(true); setCustomerName(''); setPriceDate(todayIso()); }); return; }
    setCreating(true);
    setCustomerName('');
    setPriceDate(todayIso());
  }

  function setCell(ri: number, ci: number, value: string) {
    setCells((cur) => cur.map((row, r) => (r !== ri ? row : row.map((v, c) => (c === ci ? value.replace(/[^\d.]/g, '') : v)))));
  }

  async function save() {
    if (!data) return;
    if (badCell) { setError('Check the highlighted prices: each should be a number, or empty for “–”.'); return; }
    if (isCustomer && !customerName.trim()) { setError('Enter the customer’s name.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/pricing/grid', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isCustomer
          ? { category_id: categoryId, source_list_id: listId, prices: toPrices(cells), target: 'customer', target_list_id: listId, customer_name: customerName, date: priceDate }
          : { category_id: categoryId, source_list_id: null, prices: toPrices(cells), target: 'default' })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'The prices could not be saved. Please retry.');
      await load(body.listId ?? null);
      setToast(isCustomer ? `Saved ${customerName.trim()}’s prices.` : 'Default prices saved.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!data?.list || !window.confirm(`Remove ${data.list.customerName}’s saved prices? The default prices stay.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/pricing/grid?category_id=${categoryId}&list_id=${data.list.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await load(null);
      setToast('Customer prices removed.');
    } catch {
      setError('The customer’s prices could not be removed. Please retry.');
    } finally {
      setSaving(false);
    }
  }

  if (!data) return loading ? <p className="gs-dim">Loading prices…</p> : <p role="alert">{error}</p>;
  const { grid, lists, photos } = data;

  return (
    <section className="gs-pricing">
      <div className="gs-toolbar">
        <div className="gs-picker">
          <label>Prices for</label>
          <IconSelect
            options={lists.map((l) => ({ id: l.id, name: `${l.customerName} · ${shortDate(l.priceDate)}` }))}
            value={creating ? 'all' : listId ?? 'all'}
            onChange={choose}
            allLabel="Default prices"
            leading="none"
            searchable
          />
        </div>
        <button type="button" className="btn-ghost" onClick={startNewCustomer} disabled={saving || loading}>+ Customer prices</button>
        <PriceListDownloadButton
          categoryId={categoryId}
          className="btn"
          disabled={saving || loading || badCell}
          current={{ sourceListId: listId, prices: toPrices(cells), customerName: customerName.trim(), date: priceDate }}
          onSaved={(id) => { load(id); setToast('Downloaded, and saved as the customer’s prices.'); }}
        />
      </div>

      {isCustomer ? (
        <div className="gs-customer">
          <label>
            <span>Customer</span>
            <input value={customerName} maxLength={CUSTOMER_NAME_MAX} placeholder="Customer name" onChange={(e) => setCustomerName(e.target.value)} autoFocus={creating} />
          </label>
          <label>
            <span>Prices dated</span>
            <input type="date" value={priceDate} onChange={(e) => setPriceDate(e.target.value)} />
          </label>
          {data.list && !creating && <button type="button" className="btn-link gs-remove" onClick={remove} disabled={saving}>Remove customer prices</button>}
          <p className="gs-dim">{creating ? 'Starts from the default prices. Change what this customer pays, then Save.' : `Only ${data.list?.customerName}’s prices change here. Last saved ${shortDate(lists.find((l) => l.id === listId)?.updatedAt || priceDate)}.`}</p>
        </div>
      ) : (
        <p className="gs-dim gs-default-note">Default prices — the starting point for every customer. {lists.length ? `${lists.length} customer${lists.length === 1 ? ' has' : 's have'} their own prices; pick one above.` : 'Use “+ Customer prices” to keep different prices for one buyer.'}</p>
      )}

      <div className="gs-scroll">
        <table className="gs-grid">
          <thead>
            <tr>
              {grid.families.map((f, i) => (
                <th key={i} className="gs-family">
                  <span className="gs-shapes">{f.shapes.map((s) => <ShapeMark key={s.name} name={s.name} iconKey={s.iconKey} />)}</span>
                </th>
              ))}
              {grid.columns.map((c) => (
                <th key={c.id} className={`gs-col gs-col-${c.letter}`}>
                  <b>{c.letter}</b>
                  <small>{c.title || `${photos[c.id]?.length || 0} colours`}</small>
                  <span className="gs-thumbs">{(photos[c.id] || []).filter((p) => p.url).slice(0, 5).map((p) => <img key={p.code} src={p.url!} alt="" title={p.code} />)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row, ri) => (
              <tr key={ri}>
                {row.sizes.map((list, fi) => <td key={fi} className="gs-size">{list.length ? list.map((k) => k.replace(/x/g, '×')).join(', ') : '–'}</td>)}
                {grid.columns.map((c, ci) => {
                  const v = cells[ri]?.[ci] ?? '';
                  const changed = v !== savedCells[ri]?.[ci];
                  const bad = v.trim() !== '' && !(Number(v) >= 0);
                  return (
                    <td key={c.id} className={`gs-cell gs-col-${c.letter}`}>
                      <input
                        inputMode="decimal"
                        value={v}
                        placeholder="–"
                        aria-label={`${row.sizes.flat().join(', ')} mm, column ${c.letter}`}
                        className={bad ? 'bad' : changed ? 'changed' : undefined}
                        onChange={(e) => setCell(ri, ci, e.target.value)}
                        disabled={saving}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="gs-key">
        <summary>Colour codes in each column</summary>
        {grid.columns.map((c) => (
          <div key={c.id} className={`gs-key-row gs-col-${c.letter}`}>
            <b>{c.letter}</b>
            <span>{(photos[c.id] || []).map((p) => <span key={p.code} className="gs-chip">{p.url && <img src={p.url} alt="" />}{p.code} <small>{p.name}</small></span>)}</span>
          </div>
        ))}
      </details>

      {error && <p className="price-list-error" role="alert">{error}</p>}
      {dirty && (
        <div className="gs-savebar" role="region" aria-label="Unsaved changes">
          <span>{creating ? 'New customer prices' : changedCount ? `${changedCount} price${changedCount === 1 ? '' : 's'} changed` : 'Details changed'}</span>
          <button type="button" className="btn-ghost" onClick={() => load(listId)} disabled={saving}>Discard</button>
          <button type="button" className="btn" onClick={save} disabled={saving || badCell}>{saving ? 'Saving…' : isCustomer ? 'Save customer prices' : 'Save default prices'}</button>
        </div>
      )}
      {toast && <p className="po-toast" role="status" aria-live="polite">{toast}</p>}
    </section>
  );
}
