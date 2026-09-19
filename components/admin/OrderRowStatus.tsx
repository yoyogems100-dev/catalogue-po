'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import StatusTag from './StatusTag';
import { ORDER_MILESTONES, milestoneLabel } from '@/lib/order-milestones';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import WhatsAppIcon from './WhatsAppIcon';

// Lets the admin change status and notify the customer straight from the
// orders list, instead of having to open each order to do either. Same
// status values and WhatsApp mechanism as the single-order page -- the
// notify message here is a shorter version since the list doesn't load an
// order's notes/PDF per row (would mean an extra fetch for every row shown).
export default function OrderRowStatus({
  orderId,
  status,
  isQuotation,
  customerName,
  customerPhone
}: {
  orderId: number;
  status: string;
  isQuotation: boolean;
  customerName: string | null;
  customerPhone: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const selectRef = useRef<HTMLSelectElement>(null);

  async function updateStatus(next: string) {
    const prev = value;
    setValue(next);
    setBusy(true);
    setToast('');
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next })
      });
      if (res.ok) { setEditing(false); router.refresh(); }
      else { setValue(prev); setToast('Failed to update status.'); }
    } catch {
      setValue(prev);
      setToast('Connection failed.');
    } finally {
      setBusy(false);
    }
  }

  function notify() {
    if (!customerPhone) { setToast("No phone on file -- can't notify."); return; }
    const url = buildWhatsAppUrl(
      customerPhone,
      `Hi ${customerName || ''}, your YOYO GEMS ${isQuotation ? 'quotation' : 'order'} #${orderId} status has been updated to: ${milestoneLabel(value)}.\nLog in to your account to view full details.`
    );
    window.open(url, '_blank', 'noopener,noreferrer');
    fetch(`/api/admin/orders/${orderId}/mark-notified`, { method: 'POST' }).then(() => router.refresh());
  }

  return (
    <span className="admin-order-row-status" style={{ display: 'inline-flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {editing ? (
          <select
            ref={selectRef}
            autoFocus
            value={value}
            disabled={busy}
            onChange={(e) => updateStatus(e.target.value)}
            onBlur={() => setEditing(false)}
            style={{ fontSize: 11.5, padding: '2px 4px' }}
          >
            {ORDER_MILESTONES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            title="Click to change status"
            aria-label={`Change status, currently ${milestoneLabel(value)}`}
          >
            <StatusTag status={value} />
          </button>
        )}
        {/* Was a bare green circle emoji, which said nothing about what it
            did. A WhatsApp glyph plus the word carries its own meaning, and
            the 28px-tall button is a realistic tap target in a list row. */}
        <button
          type="button"
          className="admin-notify-btn"
          onClick={notify}
          disabled={!customerPhone}
          title={customerPhone ? 'Notify the customer on WhatsApp' : 'No phone number on file -- nothing to notify'}
        >
          <WhatsAppIcon />
          <span>Notify</span>
        </button>
      </span>
      {toast && <span role="status" style={{ fontSize: 10, color: '#a3341f' }}>{toast}</span>}
    </span>
  );
}
