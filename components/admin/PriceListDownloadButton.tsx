'use client';

import { useId, useRef, useState } from 'react';
import { CUSTOMER_NAME_MAX, todayIso } from '@/lib/price-list-options';

type SavedList = { id: number; customerName: string; priceDate: string };

/**
 * "Download price list". First asks who the copy is for (a saved customer,
 * any buyer account, or a typed name; optional) and the date to print, and
 * can keep those prices as that customer's saved copy for next time.
 *
 * On the Pricing page it is handed what is on screen (`current`). Elsewhere
 * it prints the saved prices: the customer's own when their name matches a
 * saved copy, else the defaults. Moissanite downloads its own chart.
 */
export default function PriceListDownloadButton({ categoryId, className = 'btn-ghost', disabled = false, current, onSaved }: {
  categoryId: number;
  className?: string;
  disabled?: boolean;
  /** What is on screen: which list it came from, the grid's prices (Crushed
      Ice only) and who it's for. */
  current?: { sourceListId: number | null; prices?: (number | null)[][]; customerName: string; date: string };
  /** Called with the saved list's id after a download that saved the customer's prices. */
  onSaved?: (listId: number) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameListId = useId();
  const [lists, setLists] = useState<SavedList[]>([]);
  // Buyer account names, offered alongside the customers with saved prices.
  const [buyers, setBuyers] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [save, setSave] = useState(true);
  const [opening, setOpening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const plainUrl = `/api/admin/pricing/pdf?category_id=${categoryId}`;
  const match = lists.find((l) => l.customerName.trim().toLowerCase() === name.trim().toLowerCase()) || null;

  async function open() {
    setOpening(true);
    setError('');
    try {
      // Moissanite's price list is its own illustrated chart.
      if (categoryId === 34) { window.location.href = plainUrl; return; }
      const res = await fetch(`/api/admin/pricing/grid?category_id=${categoryId}`);
      if (!res.ok) throw new Error();
      let data = await res.json();
      // Every other category: its saved customers and the buyer accounts.
      if (!data.grid) {
        const plain = await fetch(`/api/admin/pricing/customer?category_id=${categoryId}`);
        if (!plain.ok) throw new Error();
        data = await plain.json();
      }
      setLists(data.lists || []);
      setBuyers(data.buyers || []);
      setName(current?.customerName || '');
      setDate(current?.date || todayIso());
      setSave(true);
      dialogRef.current?.showModal();
    } catch {
      // The dialog is a convenience; the saved list must still be one click away.
      window.location.href = plainUrl;
    } finally {
      setOpening(false);
    }
  }

  async function download() {
    setBusy(true);
    setError('');
    try {
      // Off the Pricing page, a known customer's copy prints their own saved prices.
      const body = current
        ? { source_list_id: current.sourceListId, ...(current.prices ? { prices: current.prices } : {}) }
        : { source_list_id: match?.id ?? null };
      const res = await fetch('/api/admin/pricing/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: categoryId, customer_name: name, date, save_for_customer: save && name.trim() !== '', ...body })
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
      const savedId = Number(res.headers.get('X-Price-List-Id'));
      if (savedId) onSaved?.(savedId);
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
      <dialog ref={dialogRef} className="price-list-dialog" aria-labelledby={`${nameListId}-title`}>
        <header className="price-list-dialog-head">
          <h2 id={`${nameListId}-title`}>Download price list</h2>
          <button type="button" aria-label="Close" onClick={() => dialogRef.current?.close()}>×</button>
        </header>
        <div className="price-list-dialog-body">
          <div className="price-list-fields">
            <label>
              <span>Customer name <em>optional</em></span>
              <input value={name} maxLength={CUSTOMER_NAME_MAX} placeholder="e.g. Sharma Jewellers" list={`${nameListId}-names`}
                onChange={(e) => setName(e.target.value)} autoComplete="off" />
              <datalist id={`${nameListId}-names`}>
                {lists.map((l) => <option key={l.id} value={l.customerName} />)}
                {buyers.filter((b) => !lists.some((l) => l.customerName.trim().toLowerCase() === b.toLowerCase())).map((b) => <option key={`b-${b}`} value={b} />)}
              </datalist>
            </label>
            <label>
              <span>Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
          </div>
          <p className="price-list-note">
            {current?.prices
              ? 'The PDF uses the prices on screen, including changes you haven’t saved.'
              : current?.sourceListId
                ? 'The PDF uses the saved prices on screen.'
              : match
                ? `Uses ${match.customerName}’s saved prices (last updated ${new Date(match.priceDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}).`
                : 'Uses the default prices. To change prices first, open Pricing.'}
          </p>
          {name.trim() !== '' && (
            <label className="price-list-save">
              <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
              <span>Save these prices as <b>{name.trim()}</b>’s prices, so they open next time</span>
            </label>
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
