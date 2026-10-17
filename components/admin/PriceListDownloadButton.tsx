'use client';

import { useRef, useState } from 'react';
import type { GSeriesGrid } from '@/lib/g-series-grid';
import { CUSTOMER_NAME_MAX, todayIso } from '@/lib/price-list-options';

/**
 * "Download price list". For a category with a customer price list (Crushed
 * Ice G-Series) it first asks who the copy is for, the date to print, and
 * lets the team change any price for that customer -- prices differ by buyer
 * and by day. Nothing typed here is saved; the stored prices stay the
 * starting point every time. Other categories download straight away.
 */
export default function PriceListDownloadButton({ categoryId, className = 'btn-ghost', disabled = false }: { categoryId: number; className?: string; disabled?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [grid, setGrid] = useState<GSeriesGrid | null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [cells, setCells] = useState<string[][]>([]);
  const [opening, setOpening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const plainUrl = `/api/admin/pricing/pdf?category_id=${categoryId}`;
  const savedCells = (g: GSeriesGrid) => g.rows.map((r) => r.prices.map((p) => (p === null ? '' : String(p))));
  const edited = grid !== null && JSON.stringify(cells) !== JSON.stringify(savedCells(grid));

  async function open() {
    setOpening(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/pricing/grid?category_id=${categoryId}`);
      if (!res.ok) throw new Error();
      const { grid: g } = (await res.json()) as { grid: GSeriesGrid | null };
      if (!g) { window.location.href = plainUrl; return; }
      setGrid(g);
      setCells(savedCells(g));
      setDate(todayIso());
      dialogRef.current?.showModal();
    } catch {
      // The dialog is a convenience; the saved list must still be one click away.
      window.location.href = plainUrl;
    } finally {
      setOpening(false);
    }
  }

  function setCell(ri: number, ci: number, value: string) {
    setCells((cur) => cur.map((row, r) => (r !== ri ? row : row.map((v, c) => (c === ci ? value.replace(/[^\d.]/g, '') : v)))));
  }

  async function download() {
    if (!grid) return;
    const bad = cells.some((row) => row.some((v) => v !== '' && !Number.isFinite(Number(v))));
    if (bad) { setError('Check the prices: each one should be a number, or empty for "–".'); return; }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/pricing/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: categoryId,
          customer_name: name,
          date,
          prices: cells.map((row) => row.map((v) => (v === '' ? null : Number(v))))
        })
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'The price list could not be made. Please retry.');
      const blob = await res.blob();
      const fileName = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'price-list.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      dialogRef.current?.close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={open} disabled={disabled || opening}>
        {opening ? 'Opening…' : 'Download price list'}
      </button>
      <dialog ref={dialogRef} className="price-list-dialog" aria-labelledby={`price-list-title-${categoryId}`}>
        <header className="price-list-dialog-head">
          <h2 id={`price-list-title-${categoryId}`}>Price list for a customer</h2>
          <button type="button" aria-label="Close" onClick={() => dialogRef.current?.close()}>×</button>
        </header>
        <div className="price-list-dialog-body">
          <div className="price-list-fields">
            <label>
              <span>Customer name <em>optional</em></span>
              <input value={name} maxLength={CUSTOMER_NAME_MAX} placeholder="e.g. Sharma Jewellers" onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </label>
            <label>
              <span>Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
          </div>
          {grid && (
            <>
              <div className="price-list-grid-head">
                <p>Prices per piece. Change any for this customer — saved prices stay as they are.</p>
                {edited && <button type="button" className="btn-link" onClick={() => setCells(savedCells(grid))}>Reset to saved prices</button>}
              </div>
              <div className="price-list-grid-scroll">
                <table className="price-list-grid">
                  <thead>
                    <tr>
                      {grid.families.map((f, i) => <th key={i} className="size">{f.shapes.map((s) => s.name).join(' · ')}</th>)}
                      {grid.columns.map((c) => <th key={c.id} className={`col col-${c.letter}`}><b>{c.letter}</b>{c.title && <small>{c.title}</small>}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {grid.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.sizes.map((list, fi) => <td key={fi} className="size">{list.length ? list.map((k) => k.replace(/x/g, '×')).join(', ') : '–'}</td>)}
                        {grid.columns.map((c, ci) => {
                          const changed = cells[ri]?.[ci] !== (row.prices[ci] === null ? '' : String(row.prices[ci]));
                          return (
                            <td key={c.id}>
                              <input
                                inputMode="decimal"
                                aria-label={`${row.sizes.flat().join(', ')} column ${c.letter} price`}
                                value={cells[ri]?.[ci] ?? ''}
                                placeholder="–"
                                className={changed ? 'changed' : undefined}
                                onChange={(e) => setCell(ri, ci, e.target.value)}
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
          {error && <p className="price-list-error" role="alert">{error}</p>}
        </div>
        <footer className="price-list-dialog-foot">
          <button type="button" className="btn-ghost" onClick={() => dialogRef.current?.close()}>Cancel</button>
          <button type="button" className="btn" onClick={download} disabled={busy || !date}>{busy ? 'Making PDF…' : 'Download PDF'}</button>
        </footer>
      </dialog>
    </>
  );
}
