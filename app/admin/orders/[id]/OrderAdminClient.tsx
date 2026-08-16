'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { ORDER_MILESTONES, milestoneLabel } from '@/lib/order-milestones';

type Item = {
  id: number;
  categoryId: number;
  categoryName: string;
  shapeName: string;
  sizeMm: string;
  colorName: string;
  colorHex: string;
  quantity: number;
};
type CategoryOption = {
  shapes: { id: number; name: string }[];
  colors: { id: number; name: string; hex: string | null }[];
  sizes: { id: number; shapeId: number; sizeMm: string }[];
};
type NewLine = { tempId: string; categoryId: number; shapeId: number | ''; sizeId: number | ''; colorId: number | ''; quantity: string };
type HistoryEntry = { id: number; status: string; changed_at: string; message_sent: boolean };
type Note = { id: number; author_type: string; message: string; internal_only: boolean; created_at: string };
type Customer = { id: number; name: string | null; phone: string | null; email: string | null; phone_verified: boolean } | null;
type CustomerOrder = { id: number; status: string; created_at: string };

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
  customerOrderHistory,
  items,
  categoryOptions,
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
  customerOrderHistory: CustomerOrder[];
  items: Item[];
  categoryOptions: Record<number, CategoryOption>;
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

  const [editing, setEditing] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, number>>(Object.fromEntries(items.map((i) => [i.id, i.quantity])));
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());
  const [newLines, setNewLines] = useState<NewLine[]>([]);
  const [savingItems, setSavingItems] = useState(false);

  const orderCategories = [...new Map(items.map((i) => [i.categoryId, i.categoryName])).entries()];

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

  function addNewLine() {
    const firstCat = orderCategories[0];
    if (!firstCat) return;
    setNewLines([
      ...newLines,
      { tempId: `${Date.now()}-${Math.random().toString(16).slice(2)}`, categoryId: firstCat[0], shapeId: '', sizeId: '', colorId: '', quantity: '' }
    ]);
  }

  function updateNewLine(tempId: string, patch: Partial<NewLine>) {
    setNewLines(newLines.map((l) => (l.tempId === tempId ? { ...l, ...patch } : l)));
  }

  function removeNewLine(tempId: string) {
    setNewLines(newLines.filter((l) => l.tempId !== tempId));
  }

  async function saveItemEdits() {
    const updates = items
      .filter((i) => !removedIds.has(i.id) && quantities[i.id] !== i.quantity)
      .map((i) => ({ id: i.id, quantity: quantities[i.id] }));

    const validNewItems = newLines
      .filter((l) => l.shapeId && l.sizeId && l.colorId && parseInt(l.quantity, 10) > 0)
      .map((l) => ({ categoryId: l.categoryId, shapeId: l.shapeId, sizeId: l.sizeId, colorId: l.colorId, quantity: parseInt(l.quantity, 10) }));

    setSavingItems(true);
    const res = await fetch(`/api/admin/orders/${orderId}/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates, removedIds: Array.from(removedIds), newItems: validNewItems })
    });
    setSavingItems(false);

    if (res.ok) { setEditing(false); router.refresh(); }
    else { const d = await res.json().catch(() => ({})); setToast(d.error || 'Failed to save changes.'); }
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

        {customer && customerOrderHistory.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              This customer's other orders
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {customerOrderHistory.map((o) => (
                <Link key={o.id} href={`/admin/orders/${o.id}`} className="tag-chip">
                  #{o.id} · {milestoneLabel(o.status)}
                </Link>
              ))}
            </div>
          </div>
        )}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ fontSize: 14, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Line items</h3>
          {!editing && (
            <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>
              Edit (offline/phone request)
            </button>
          )}
        </div>
        <table>
          <thead>
            <tr><th>Category</th><th>Shape</th><th>Size</th><th>Color</th><th>Qty</th>{editing && <th></th>}</tr>
          </thead>
          <tbody>
            {items.filter((i) => !removedIds.has(i.id)).map((i) => (
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
                <td>
                  {editing ? (
                    <input
                      type="text"
                      inputMode="numeric"
                      value={quantities[i.id]}
                      onChange={(e) => setQuantities({ ...quantities, [i.id]: parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 })}
                      style={{ maxWidth: 80, fontSize: 13 }}
                    />
                  ) : (
                    i.quantity
                  )}
                </td>
                {editing && (
                  <td>
                    <button type="button" className="btn-danger" onClick={() => setRemovedIds(new Set([...removedIds, i.id]))}>Remove</button>
                  </td>
                )}
              </tr>
            ))}
            {editing && newLines.map((l) => {
              const opts = categoryOptions[l.categoryId];
              const sizesForShape = opts?.sizes.filter((s) => s.shapeId === l.shapeId) || [];
              return (
                <tr key={l.tempId}>
                  <td>{orderCategories.find(([id]) => id === l.categoryId)?.[1]}</td>
                  <td>
                    <select value={l.shapeId} onChange={(e) => updateNewLine(l.tempId, { shapeId: e.target.value ? Number(e.target.value) : '', sizeId: '' })} style={{ fontSize: 12 }}>
                      <option value="">Choose shape</option>
                      {opts?.shapes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={l.sizeId} onChange={(e) => updateNewLine(l.tempId, { sizeId: e.target.value ? Number(e.target.value) : '' })} disabled={!l.shapeId} style={{ fontSize: 12 }}>
                      <option value="">Choose size</option>
                      {sizesForShape.map((s) => <option key={s.id} value={s.id}>{s.sizeMm} mm</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={l.colorId} onChange={(e) => updateNewLine(l.tempId, { colorId: e.target.value ? Number(e.target.value) : '' })} style={{ fontSize: 12 }}>
                      <option value="">Choose color</option>
                      {opts?.colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Qty"
                      value={l.quantity}
                      onChange={(e) => updateNewLine(l.tempId, { quantity: e.target.value.replace(/\D/g, '') })}
                      style={{ maxWidth: 80, fontSize: 13 }}
                    />
                  </td>
                  <td>
                    <button type="button" className="btn-danger" onClick={() => removeNewLine(l.tempId)}>Remove</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {editing && (
          <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn-ghost" onClick={addNewLine} disabled={orderCategories.length === 0}>+ Add line</button>
            <button type="button" className="btn" onClick={saveItemEdits} disabled={savingItems}>{savingItems ? 'Saving…' : 'Save changes'}</button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => { setEditing(false); setQuantities(Object.fromEntries(items.map((i) => [i.id, i.quantity]))); setRemovedIds(new Set()); setNewLines([]); }}
            >
              Cancel
            </button>
          </div>
        )}
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
