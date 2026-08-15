'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { ORDER_MILESTONES, milestoneLabel } from '@/lib/order-milestones';

type Item = { id: number; categoryName: string; shapeName: string; sizeMm: string; colorName: string; colorHex: string; quantity: number };
type HistoryEntry = { id: number; status: string; changed_at: string; message_sent: boolean };
type Note = { id: number; author_type: string; message: string; internal_only: boolean; created_at: string };
type Customer = { id: number; name: string | null; phone: string | null; email: string | null; phone_verified: boolean } | null;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function OrderAdminClient({
  orderId,
  status,
  paymentStatus,
  createdAt,
  comment,
  requestType,
  contactName,
  customer,
  items,
  history,
  notes
}: {
  orderId: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  comment: string | null;
  requestType: string | null;
  contactName: string | null;
  customer: Customer;
  items: Item[];
  history: HistoryEntry[];
  notes: Note[];
}) {
  const router = useRouter();
  const [statusValue, setStatusValue] = useState(status);
  const [paymentValue, setPaymentValue] = useState(paymentStatus);
  const [noteText, setNoteText] = useState('');
  const [internalOnly, setInternalOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  async function updateStatus() {
    setBusy(true);
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: statusValue })
    });
    setBusy(false);
    if (res.ok) { setToast('Status updated.'); router.refresh(); }
    else { const d = await res.json().catch(() => ({})); setToast(d.error || 'Failed to update status.'); }
  }

  async function updatePayment() {
    setBusy(true);
    const res = await fetch(`/api/admin/orders/${orderId}/payment-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus: paymentValue })
    });
    setBusy(false);
    if (res.ok) { setToast('Payment status updated.'); router.refresh(); }
    else { const d = await res.json().catch(() => ({})); setToast(d.error || 'Failed to update payment status.'); }
  }

  async function addNote() {
    if (!noteText.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/admin/orders/${orderId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: noteText, internalOnly })
    });
    setBusy(false);
    if (res.ok) { setNoteText(''); setInternalOnly(false); router.refresh(); }
    else { const d = await res.json().catch(() => ({})); setToast(d.error || 'Failed to add note.'); }
  }

  async function notifyAuto() {
    setBusy(true);
    const res = await fetch(`/api/admin/orders/${orderId}/notify`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setToast(data.error || 'Failed to notify customer.');
    else if (data.stubbed) setToast('WhatsApp API not live yet -- code was logged server-side instead of sent.');
    else if (data.ok) { setToast('Customer notified via WhatsApp.'); router.refresh(); }
    else setToast(data.error || 'WhatsApp send failed.');
  }

  const manualWaUrl = customer?.phone
    ? buildWhatsAppUrl(customer.phone, `Hi ${customer.name || ''}, your YOYO GEMS order #${orderId} status has been updated to: ${milestoneLabel(statusValue)}. Log in to your account to view full details.`)
    : null;

  const timeline = [
    ...history.map((h) => ({ type: 'status' as const, at: h.changed_at, label: milestoneLabel(h.status), messageSent: h.message_sent })),
    ...notes.map((n) => ({ type: 'note' as const, at: n.created_at, author: n.author_type, message: n.message, internalOnly: n.internal_only }))
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div style={{ marginTop: 16 }}>
      <section style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: '#8a8370' }}>
          Placed {fmtDate(createdAt)} · {requestType || 'Place Order'}
          {customer && <> · {customer.name || contactName || 'No name'} · {customer.phone}{customer.phone_verified ? ' ✓' : ''}</>}
        </p>
        {comment && <p style={{ fontSize: 13, marginTop: 6 }}><strong>Comment:</strong> {comment}</p>}
      </section>

      <section className="link-row" style={{ marginBottom: 24 }}>
        <div>
          <h3 className="section-label">Status</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={statusValue} onChange={(e) => setStatusValue(e.target.value)} style={{ fontSize: 13 }}>
              {ORDER_MILESTONES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
            <button className="btn" onClick={updateStatus} disabled={busy || statusValue === status}>Update</button>
          </div>
        </div>
        <div>
          <h3 className="section-label">Payment status</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={paymentValue} onChange={(e) => setPaymentValue(e.target.value)} style={{ fontSize: 13 }}>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
            <button className="btn" onClick={updatePayment} disabled={busy || paymentValue === paymentStatus}>Update</button>
          </div>
        </div>
        <div>
          <h3 className="section-label">Notify customer</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-ghost" onClick={notifyAuto} disabled={busy || !customer?.phone}>Notify via WhatsApp</button>
            {manualWaUrl && (
              <a href={manualWaUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ display: 'inline-block' }}>
                Open WhatsApp manually
              </a>
            )}
          </div>
        </div>
      </section>

      {toast && <p style={{ fontSize: 12.5, color: 'var(--gold)', marginBottom: 16 }}>{toast}</p>}

      <section style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Line items</h3>
        <table>
          <thead><tr><th>Category</th><th>Shape</th><th>Size</th><th>Color</th><th>Qty</th></tr></thead>
          <tbody>
            {items.map((i) => (
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
                <td>{i.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3 style={{ fontSize: 14, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Notes &amp; timeline</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, maxWidth: 520 }}>
          <textarea rows={2} placeholder="Add a note..." value={noteText} onChange={(e) => setNoteText(e.target.value)} style={{ flex: 1, fontSize: 13 }} />
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
            <input type="checkbox" checked={internalOnly} onChange={(e) => setInternalOnly(e.target.checked)} />
            Internal only (hidden from customer)
          </label>
          <button className="btn" onClick={addNote} disabled={busy || !noteText.trim()}>Add note</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {timeline.length === 0 && <p style={{ fontSize: 12.5, color: '#8a8370' }}>No history yet.</p>}
          {timeline.map((t, i) => (
            <div key={i} className="card" style={{ padding: '10px 14px', fontSize: 13 }}>
              {t.type === 'status' ? (
                <span><strong>Status updated:</strong> {t.label} {t.messageSent && <span style={{ fontSize: 11, color: '#8a8370' }}>(customer notified)</span>}</span>
              ) : (
                <span>
                  <strong>{t.author === 'admin' ? 'Admin' : t.author === 'customer' ? 'Customer' : 'System'}:</strong> {t.message}
                  {t.internalOnly && <span className="tag-chip" style={{ marginLeft: 8, fontSize: 10 }}>Internal only</span>}
                </span>
              )}
              <div style={{ fontSize: 11, color: '#8a8370', marginTop: 3 }}>{fmtDate(t.at)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
