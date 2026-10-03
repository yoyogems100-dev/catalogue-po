'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Buyer = { id: number; name: string | null; company: string | null; place: string | null; phone: string | null };

const label = (b: Buyer) => b.name?.trim() || b.company?.trim() || b.phone || `Customer ${b.id}`;

/** Switch the session to another buyer (or back to yourself), then reload so every page shows their account. */
export async function switchCustomer(customerId: number | null) {
  const res = await fetch('/api/account/act-as', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId })
  }).catch(() => null);
  if (!res?.ok) {
    const data = await res?.json().catch(() => null);
    alert(data?.error || 'Could not switch. Please retry.');
    return;
  }
  window.location.reload();
}

/**
 * "Switch customer": every buyer, searchable by name, company, city or phone.
 * Only shown to accounts allowed to order for others.
 */
export default function CustomerSwitcher({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [buyers, setBuyers] = useState<Buyer[] | null>(null);
  const [current, setCurrent] = useState<number | null>(null);
  const [self, setSelf] = useState<number | null>(null);
  const [failed, setFailed] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
    fetch('/api/account/act-as')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Could not load customers. Please retry.');
        setBuyers(data.customers || []);
        setCurrent(data.current);
        setSelf(data.self);
      })
      .catch((e) => setFailed(e.message));
  }, []);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const digits = q.replace(/\D/g, '');
    return (buyers || [])
      .filter((b) => b.id !== self)
      .filter((b) => {
        const hay = `${b.name || ''} ${b.company || ''} ${b.place || ''}`.toLowerCase();
        return words.every((w) => hay.includes(w) || (digits.length >= 3 && (b.phone || '').includes(digits)));
      });
  }, [buyers, q, self]);

  async function pick(id: number | null) {
    setBusy(id ?? 0);
    await switchCustomer(id);
    setBusy(null);
  }

  return (
    <dialog
      ref={dialog}
      className="login-dialog switch-dialog"
      aria-labelledby="switch-title"
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}
    >
      <button type="button" className="login-dialog-close" aria-label="Close" onClick={() => dialog.current?.close()}>&#10005;</button>
      <h2 id="switch-title" className="switch-title">Order for a customer</h2>
      <p className="switch-note">You&rsquo;ll see the catalogue and orders as them, and anything you send is placed in their name, marked as entered by you.</p>
      <input
        type="search"
        className="switch-search"
        placeholder="Search name, company, city or phone"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
        aria-label="Search customers"
      />
      {failed ? <p className="switch-empty" role="alert">{failed}</p>
        : buyers === null ? <p className="switch-empty">Loading customers…</p>
        : (
          <ul className="switch-list">
            {current !== self && self != null && (
              <li><button type="button" className="switch-row switch-back" onClick={() => pick(null)} disabled={busy !== null}>Back to my own account</button></li>
            )}
            {shown.map((b) => (
              <li key={b.id}>
                <button type="button" className={`switch-row${b.id === current ? ' is-current' : ''}`} onClick={() => pick(b.id)} disabled={busy !== null} aria-current={b.id === current ? 'true' : undefined}>
                  <strong>{label(b)}</strong>
                  <span>{[b.name?.trim() ? b.company : null, b.place, b.phone].filter(Boolean).join(' · ')}</span>
                  {b.id === current && <em>Current</em>}
                </button>
              </li>
            ))}
            {!shown.length && <li className="switch-empty">No customer matches “{q}”.</li>}
          </ul>
        )}
    </dialog>
  );
}
