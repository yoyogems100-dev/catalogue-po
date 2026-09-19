'use client';
import SpecialOrderComposer from '@/components/SpecialOrderComposer';
import {specialCategory,specKey,specText,quantityFactor,type OrderSpecs} from '@/lib/order-specs';
import IconSelect from '@/components/IconSelect';
import CustomerNameDisplay from '@/components/admin/CustomerNameDisplay';
import StatusTag from '@/components/admin/StatusTag';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { ORDER_MILESTONES, milestoneLabel } from '@/lib/order-milestones';
import WhatsAppIcon from '@/components/admin/WhatsAppIcon';

// Shown both as the disabled button's tooltip and as text beside it, so the
// reason is readable on touch devices too -- a title attribute never appears
// without a mouse to hover with.
const INVOICE_BLOCKED_HINT = 'Please enter all the prices to generate the invoice in the order list';

type Item = {
  orderSpecs?: OrderSpecs;
  id: number;
  categoryId: number;
  categoryName: string;
  shapeId: number | null;
  shapeName: string;
  sizeId: number | null;
  sizeMm: string;
  colorId: number | null;
  colorName: string;
  colorHex: string;
  quantity: number;
  unitPrice: number | null;
  costPrice: number | null;
  supplierId: number | null;
  requestType: string;
};
type CategoryOption = {
  shapes: { id: number; name: string }[];
  colors: { id: number; name: string; hex: string | null }[];
  sizes: { id: number; shapeId: number; sizeMm: string }[];
};
type NewLine = { orderSpecs?: OrderSpecs; tempId: string; categoryId: number; shapeId: number | ''; sizeId: number | ''; colorId: number | ''; quantity: string };
type HistoryEntry = { id: number; status: string; changed_at: string; message_sent: boolean };
type Note = { id: number; author_type: string; message: string; internal_only: boolean; created_at: string };
type Customer = { id: number; name: string | null; phone: string | null; email: string | null; company?: string | null; phone_verified: boolean; place?: string | null } | null;
type CustomerOrder = { id: number; status: string; created_at: string };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function money(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

// A little padding, not the cramped 3px/6px this started at -- too tight
// made the shared input/select border-radius and border color (both set
// globally, untouched here) look off rather than just compact.
const rowInputStyle = { fontSize: 12.5, padding: '6px 9px', borderRadius: 5, border: '1px solid var(--line)' };

export default function OrderAdminClient({
  orderId,
  status,
  paymentStatus,
  pdfUrl,
  invoiceUrl,
  createdAt,
  comment,
  requestType,
  contactName,
  customer,
  customerOrderHistory,
  items,
  categoryOptions,
  history,
  notes,
  suppliers
}: {
  orderId: number;
  status: string;
  paymentStatus: string;
  pdfUrl: string | null;
  invoiceUrl: string | null;
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
  suppliers: { id: number; name: string; categoryIds: number[] }[];
}) {
  const router = useRouter();
  const [statusValue, setStatusValue] = useState(status);
  const [paymentValue, setPaymentValue] = useState(paymentStatus);
  const [noteText, setNoteText] = useState('');
  const [internalOnly, setInternalOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [justUpdated, setJustUpdated] = useState(false);

  const [editingRowIds, setEditingRowIds] = useState<Set<number>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>('all');
  const [quantities, setQuantities] = useState<Record<number, number>>(Object.fromEntries(items.map((i) => [i.id, i.quantity])));
  const [shapeIds, setShapeIds] = useState<Record<number, number>>(Object.fromEntries(items.filter((i) => i.shapeId).map((i) => [i.id, i.shapeId as number])));
  const [sizeIds, setSizeIds] = useState<Record<number, number>>(Object.fromEntries(items.filter((i) => i.sizeId).map((i) => [i.id, i.sizeId as number])));
  const [colorIds, setColorIds] = useState<Record<number, number>>(Object.fromEntries(items.filter((i) => i.colorId).map((i) => [i.id, i.colorId as number])));
  const [newLines, setNewLines] = useState<NewLine[]>([]);
  const [savingItems, setSavingItems] = useState(false);
  const [savingRowId, setSavingRowId] = useState<number | null>(null);
  const [removingRowId, setRemovingRowId] = useState<number | null>(null);

  // `items` only changes after router.refresh() following a successful save
  // elsewhere in this component -- this component itself is never remounted for
  // that (same order id, same position in the tree), so without this, a
  // previously-saved new line stays sitting in `newLines` and gets re-inserted
  // as a duplicate on the next edit, and quantities[id] for that new item is
  // simply missing (renders the quantity input as NaN) since it was never in
  // the map this state was originally seeded from.
  useEffect(() => {
    setQuantities(Object.fromEntries(items.map((i) => [i.id, i.quantity])));
    setShapeIds(Object.fromEntries(items.filter((i) => i.shapeId).map((i) => [i.id, i.shapeId as number])));
    setSizeIds(Object.fromEntries(items.filter((i) => i.sizeId).map((i) => [i.id, i.sizeId as number])));
    setColorIds(Object.fromEntries(items.filter((i) => i.colorId).map((i) => [i.id, i.colorId as number])));
    setNewLines([]);
    setEditingRowIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const [prices, setPrices] = useState<Record<number, string>>(
    Object.fromEntries(items.map((i) => [i.id, i.unitPrice != null ? String(i.unitPrice) : '']))
  );
  const [costPrices, setCostPrices] = useState<Record<number, string>>(Object.fromEntries(items.map((i) => [i.id, i.costPrice != null ? String(i.costPrice) : ''])));
  const [supplierIds, setSupplierIds] = useState<Record<number, number | ''>>(Object.fromEntries(items.map((i) => [i.id, i.supplierId || ''])));
  useEffect(() => {
    setPrices(Object.fromEntries(items.map((i) => [i.id, i.unitPrice != null ? String(i.unitPrice) : ''])));
    setCostPrices(Object.fromEntries(items.map((i) => [i.id, i.costPrice != null ? String(i.costPrice) : ''])));
    setSupplierIds(Object.fromEntries(items.map((i) => [i.id, i.supplierId || ''])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
  const [currentPdfUrl, setCurrentPdfUrl] = useState(pdfUrl);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [currentInvoiceUrl, setCurrentInvoiceUrl] = useState(invoiceUrl);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const allItemsPriced = items.length > 0 && items.every((i) => i.unitPrice != null);

  const orderCategories = [...new Map(items.map((i) => [i.categoryId, i.categoryName])).entries()];
  const hasPricing = items.some((i) => prices[i.id]);
  const grandTotal = items.reduce((sum, i) => sum + (parseFloat(prices[i.id]) || 0) * i.quantity, 0);
  const visibleItems = items.filter((i) => categoryFilter === 'all' || i.categoryId === categoryFilter);
  const regularItems = visibleItems.filter((i) => i.requestType !== 'Request Quotation');
  const quotationItems = visibleItems.filter((i) => i.requestType === 'Request Quotation');

  async function updateStatus(next: string) {
    setStatusValue(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next })
      });
      if (res.ok) { setToast('Status updated.'); router.refresh(); }
      else { const d = await res.json().catch(() => ({})); setToast(d.error || 'Failed to update status.'); setStatusValue(status); }
    } catch { setToast('Connection failed. Please check the saved order before retrying.'); setStatusValue(status); }
    finally { setBusy(false); }
  }

  async function updatePayment(next: string) {
    setPaymentValue(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/payment-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: next })
      });
      if (res.ok) { setToast('Payment status updated.'); router.refresh(); }
      else { const d = await res.json().catch(() => ({})); setToast(d.error || 'Failed to update payment status.'); setPaymentValue(paymentStatus); }
    } catch { setToast('Connection failed. Please check the saved order before retrying.'); setPaymentValue(paymentStatus); }
    finally { setBusy(false); }
  }

  async function addNote() {
    if (!noteText.trim()) return;
    setBusy(true);
    try {
    const res = await fetch(`/api/admin/orders/${orderId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: noteText, internalOnly })
    });
    setBusy(false);
    if (res.ok) { setNoteText(''); setInternalOnly(false); router.refresh(); }
    else { const d = await res.json().catch(() => ({})); setToast(d.error || 'Failed to add note.'); }
    } catch { setToast('Connection failed. Please check the saved order before retrying.'); }
    finally { setBusy(false); }
  }

  // Notifying is a separate, manual action the admin triggers whenever they choose --
  // not tied to the moment the status is changed. Opens a pre-filled wa.me link for
  // the admin to send themselves, then marks it on record (best-effort; there's no
  // way to confirm the message was actually sent, only that this was clicked).
  function notifyViaWhatsApp() {
    if (!manualWaUrl) return;
    window.open(manualWaUrl, '_blank', 'noopener,noreferrer');
    fetch(`/api/admin/orders/${orderId}/mark-notified`, { method: 'POST' }).then(() => router.refresh());
  }

  // Same manual wa.me mechanism as the status notify above, but with a
  // message describing that the order's line items themselves changed --
  // used by the "send updated order to customer" prompt after a line-item
  // edit/removal/addition is saved.
  function sendUpdatedOrderViaWhatsApp() {
    if (!customer?.phone) return;
    const url = buildWhatsAppUrl(
      customer.phone,
      [
        `Hi ${customer.name || ''}, your YOYO GEMS ${isQuotation ? 'quotation' : 'order'} #${orderId} has been updated.`,
        currentPdfUrl ? `\n${isQuotation ? 'View your quotation' : 'View your order summary'}: ${currentPdfUrl}` : '',
        '\nLog in to your account to view full details.'
      ].join('')
    );
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
    fetch(`/api/admin/orders/${orderId}/mark-notified`, { method: 'POST' }).then(() => router.refresh());
    setJustUpdated(false);
  }

  async function generatePdf() {
    setGeneratingPdf(true);
    try {
    const res = await fetch(`/api/admin/orders/${orderId}/pdf`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setGeneratingPdf(false);
    if (res.ok && data.url) {
      setCurrentPdfUrl(data.url);
      window.open(data.url, '_blank', 'noopener,noreferrer');
      setJustUpdated(false);
    } else {
      setToast(data.error || 'Failed to generate PDF.');
    }
    } catch { setToast('Connection failed. Please check the saved order before retrying.'); }
    finally { setGeneratingPdf(false); }
  }

  async function generateInvoice() {
    setGeneratingInvoice(true);
    try {
    const res = await fetch(`/api/admin/orders/${orderId}/invoice`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setGeneratingInvoice(false);
    if (res.ok && data.url) {
      setCurrentInvoiceUrl(data.url);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } else {
      setToast(data.error || 'Failed to generate invoice.');
    }
    } catch { setToast('Connection failed. Please check the saved order before retrying.'); }
    finally { setGeneratingInvoice(false); }
  }

  function addNewLine() {
    const firstCat = orderCategories[0];
    if (!firstCat) return;
    setNewLines([
      ...newLines,
      { tempId: `${Date.now()}-${Math.random().toString(16).slice(2)}`, categoryId: firstCat[0], shapeId: '', sizeId: '', colorId: firstCat[0] === 34 ? categoryOptions[34]?.colors[0]?.id || '' : '', quantity: '' }
    ]);
  }

  function updateNewLine(tempId: string, patch: Partial<NewLine>) {
    setNewLines(newLines.map((l) => (l.tempId === tempId ? { ...l, ...patch, ...((patch.categoryId ?? l.categoryId) === 34 ? { colorId: categoryOptions[34]?.colors[0]?.id || '' } : {}) } : l)));
  }

  function removeNewLine(tempId: string) {
    setNewLines(newLines.filter((l) => l.tempId !== tempId));
  }

  async function saveNewLines() {
    const validNewItems = newLines
      .filter((l) => l.shapeId && l.sizeId && (l.colorId || l.orderSpecs?.kind==='rainbow') && parseInt(l.quantity, 10) > 0)
      .map((l) => ({ orderSpecs:l.orderSpecs, categoryId: l.categoryId, shapeId: l.shapeId, sizeId: l.sizeId, colorId: l.colorId, quantity: parseInt(l.quantity, 10) }));

    if (validNewItems.length !== newLines.length) { setToast('Complete the options and quantity for each new line, or remove the unfinished line.'); return; }
    setSavingItems(true);
    try {
    const res = await fetch(`/api/admin/orders/${orderId}/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: [], removedIds: [], newItems: validNewItems })
    });
    if (res.ok) { setNewLines([]); setJustUpdated(true); router.refresh(); }
    else { const d = await res.json().catch(() => ({})); setToast(d.error || 'Failed to save new lines.'); }
    } catch { setToast('Connection failed. Please check the saved order before retrying.'); }
    finally { setSavingItems(false); }
  }

  // One row's full edit -- shape/size/color/quantity (order_items core fields,
  // via /edit) and supplier/CP/SP (pricing fields, via /prices) used to be two
  // separate save flows on this page; this combines them into the one save
  // icon a row's edit mode now shows, since from the admin's point of view
  // it's just "save this row".
  async function saveRow(item: Item) {
    setSavingRowId(item.id);
    try {
      const quantityChanged = quantities[item.id] !== item.quantity;
      const shapeChanged = item.shapeId != null && shapeIds[item.id] !== item.shapeId;
      const sizeChanged = item.sizeId != null && sizeIds[item.id] !== item.sizeId;
      const colorChanged = item.colorId != null && colorIds[item.id] !== item.colorId;
      const requests: Promise<Response>[] = [];
      if (quantityChanged || shapeChanged || sizeChanged || colorChanged) {
        requests.push(fetch(`/api/admin/orders/${orderId}/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updates: [{
              id: item.id,
              quantity: quantities[item.id],
              ...(shapeChanged ? { shapeId: shapeIds[item.id] } : {}),
              ...(sizeChanged ? { sizeId: sizeIds[item.id] } : {}),
              ...(colorChanged ? { colorId: colorIds[item.id] } : {})
            }],
            removedIds: [],
            newItems: []
          })
        }));
      }
      requests.push(fetch(`/api/admin/orders/${orderId}/prices`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prices: [{ itemId: item.id, unitPrice: prices[item.id], costPrice: costPrices[item.id], supplierId: supplierIds[item.id] || null }] })
      }));
      const results = await Promise.all(requests);
      if (results.some((r) => !r.ok)) throw new Error('Some changes could not be saved. Please review and retry.');
      setEditingRowIds((cur) => { const next = new Set(cur); next.delete(item.id); return next; });
      setJustUpdated(true);
      setToast('Line saved. Generate a fresh PDF to include the changes.');
      router.refresh();
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not save this line. Please retry.');
    } finally {
      setSavingRowId(null);
    }
  }

  async function removeRow(item: Item) {
    if (!confirm(`Remove ${item.shapeName} ${item.sizeMm}mm ${item.colorName} from this order?`)) return;
    setRemovingRowId(item.id);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [], removedIds: [item.id], newItems: [] })
      });
      if (res.ok) { setJustUpdated(true); router.refresh(); }
      else { const d = await res.json().catch(() => ({})); setToast(d.error || 'Failed to remove line.'); }
    } catch { setToast('Connection failed. Please check the saved order before retrying.'); }
    finally { setRemovingRowId(null); }
  }

  // Uses the saved status, not the (possibly unsaved) dropdown selection --
  // notifying should always reflect what's actually on record. When a PDF has been
  // generated, its link is included so the customer can view/download it -- no manual
  // file attachment needed, since wa.me only supports pre-filled text.
  const isQuotation = requestType === 'Request Quotation';
  const manualWaUrl = customer?.phone
    ? buildWhatsAppUrl(
        customer.phone,
        [
          `Hi ${customer.name || ''}, your YOYO GEMS ${isQuotation ? 'quotation' : 'order'} #${orderId} status has been updated to: ${milestoneLabel(status)}.`,
          ...notes.filter(note => !note.internal_only && note.author_type === 'admin').slice(-3).map(note => `\nUpdate: ${note.message}\n`),
          currentPdfUrl ? `\n${isQuotation ? 'View your quotation' : 'View your order summary'}: ${currentPdfUrl}` : '',
          '\nLog in to your account to view full details.'
        ].join('')
      )
    : null;

  const timeline = [
    ...history.map((h) => ({ type: 'status' as const, at: h.changed_at, label: milestoneLabel(h.status), messageSent: h.message_sent })),
    ...notes.map((n) => ({ type: 'note' as const, at: n.created_at, author: n.author_type, message: n.message, internalOnly: n.internal_only }))
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div style={{ marginTop: 16 }}>
      {/* Order # and PDF controls share one row -- side by side on desktop,
          wraps to stacked on mobile (flex-wrap, no fixed widths). */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Order #{orderId}</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn-ghost" onClick={generatePdf} disabled={generatingPdf}>
            {generatingPdf ? 'Generating…' : `Generate ${isQuotation ? 'quotation' : 'order'} PDF`}
          </button>
          <button
            className="btn-ghost"
            onClick={generateInvoice}
            disabled={generatingInvoice || !allItemsPriced}
            title={allItemsPriced ? undefined : INVOICE_BLOCKED_HINT}
          >
            {generatingInvoice ? 'Generating…' : 'Generate invoice'}
          </button>
          {!allItemsPriced && <span style={{ fontSize: 11, color: '#756e5c' }}>{INVOICE_BLOCKED_HINT}</span>}
          {currentInvoiceUrl && <a className="btn-ghost" href={currentInvoiceUrl} target="_blank" rel="noopener noreferrer">View last invoice</a>}
        </div>
      </div>

      <section style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: '#756e5c' }}>
          Placed {fmtDate(createdAt)} · <strong style={{ color: isQuotation ? 'var(--gold)' : undefined }}>{requestType === 'Place Order' || !requestType ? 'Purchase' : requestType}</strong>
          {customer && <> · <Link href={`/admin/customers/${customer.id}`} className="admin-table-link"><CustomerNameDisplay name={customer.name} company={customer.company} fallback={contactName || 'No name'} /></Link> · {customer.phone}{customer.phone_verified ? ' ✓' : ''}{customer.place ? ` · ${customer.place}` : ''}</>}
        </p>
        {comment && <p style={{ fontSize: 13, marginTop: 6 }}><strong>Comment:</strong> {comment}</p>}

        {customer && customerOrderHistory.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              This customer's last {customerOrderHistory.length} order{customerOrderHistory.length === 1 ? '' : 's'}
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {customerOrderHistory.map((o) => (
                <Link key={o.id} href={`/admin/orders/${o.id}`} className="tag-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  #{o.id} <StatusTag status={o.status} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Status, payment and notify consolidated into one row (was 3 separate
          sections with their own "Update" buttons) -- both selects auto-save
          on change, and the old Update-button slot is now the manual
          WhatsApp notify with its preview tucked directly below. */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end' }}>
          <div>
            <h3 className="section-label">Status</h3>
            <select value={statusValue} onChange={(e) => updateStatus(e.target.value)} disabled={busy} style={{ fontSize: 13 }}>
              {ORDER_MILESTONES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <h3 className="section-label">Payment status</h3>
            <select value={paymentValue} onChange={(e) => updatePayment(e.target.value)} disabled={busy} style={{ fontSize: 13 }}>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div>
            <button className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={notifyViaWhatsApp} disabled={!manualWaUrl} title={manualWaUrl ? undefined : 'No phone number on file for this order'}>
              <WhatsAppIcon size={14} /> Notify
            </button>
            {/* Silently doing nothing here read as "Notify is broken" -- this is
                the actual reason: a guest order with no linked customer phone
                has nothing to send a WhatsApp message to. */}
            {!manualWaUrl && <p style={{ fontSize: 11, color: '#756e5c', margin: '4px 0 0' }}>No phone number on file -- can't notify via WhatsApp.</p>}
          </div>
        </div>
        {manualWaUrl && (
          <details style={{ marginTop: 10 }}>
            <summary style={{ fontSize: 12, color: '#756e5c', cursor: 'pointer' }}>Preview WhatsApp update</summary>
            <p style={{ fontSize: 12 }}>To: {customer?.phone}</p>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12.5 }}>{new URL(manualWaUrl).searchParams.get('text')}</pre>
          </details>
        )}
      </section>

      {toast && <p role="status" aria-live="polite" style={{ fontSize: 12.5, color: 'var(--gold)', marginBottom: 16 }}>{toast}</p>}

      <section style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Line items</h3>
        <p style={{ fontSize: 11.5, color: '#756e5c', marginBottom: 8 }}>Supplier and cost price (CP) stay internal. Selling price (SP) is the customer price used in the PDF.</p>
        {orderCategories.length > 1 && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, marginBottom: 10 }}>
            Category
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))} style={rowInputStyle}>
              <option value="all">All categories</option>
              {orderCategories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
        )}
        {(() => {
          const renderRow = (i: Item) => {
            const rowEditing = editingRowIds.has(i.id);
            const rowSpecial = specialCategory(i.categoryId);
            const opts = categoryOptions[i.categoryId];
            const sizesForShape = opts?.sizes.filter((s) => s.shapeId === shapeIds[i.id]) || [];
            return (
              <tr key={i.id}>
                <td>
                  <button
                    type="button"
                    className="btn-ghost"
                    aria-label={rowEditing ? `Save ${i.shapeName} ${i.sizeMm}mm ${i.colorName}` : `Edit ${i.shapeName} ${i.sizeMm}mm ${i.colorName}`}
                    style={{ padding: '3px 7px', fontSize: 13 }}
                    disabled={savingRowId === i.id}
                    onClick={() => rowEditing ? saveRow(i) : setEditingRowIds((cur) => new Set(cur).add(i.id))}
                  >
                    {savingRowId === i.id ? '…' : rowEditing ? '💾' : '✏️'}
                  </button>
                </td>
                <td>{i.categoryName}</td>
                <td>
                  {rowEditing && !rowSpecial && opts ? (
                    <select value={shapeIds[i.id] ?? ''} onChange={(e) => setShapeIds({ ...shapeIds, [i.id]: Number(e.target.value) })} style={rowInputStyle}>
                      {opts.shapes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  ) : i.shapeName}
                </td>
                <td>
                  {rowEditing && !rowSpecial && opts ? (
                    <select value={sizeIds[i.id] ?? ''} onChange={(e) => setSizeIds({ ...sizeIds, [i.id]: Number(e.target.value) })} style={rowInputStyle}>
                      {sizesForShape.map((s) => <option key={s.id} value={s.id}>{s.sizeMm} mm</option>)}
                    </select>
                  ) : `${i.sizeMm} mm`}
                </td>
                <td>
                  {rowEditing && !rowSpecial && opts && i.categoryId !== 34 ? (
                    <select value={colorIds[i.id] ?? ''} onChange={(e) => setColorIds({ ...colorIds, [i.id]: Number(e.target.value) })} style={rowInputStyle}>
                      {opts.colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: i.colorHex }} />
                      {i.colorName}{i.orderSpecs && <small style={{display:"block"}}>{specText(i.orderSpecs,quantities[i.id] ?? i.quantity)}</small>}
                    </span>
                  )}
                </td>
                <td>
                  {rowEditing ? (
                    <label>{i.orderSpecs?.kind==='rainbow'?'Strips':'Pieces'}<input
                      type="text"
                      inputMode="numeric"
                      aria-label={i.orderSpecs?.kind==='rainbow'?'Number of strips':'Quantity in pieces'} value={quantities[i.id] / quantityFactor(i.orderSpecs)}
                      onChange={(e) => setQuantities({ ...quantities, [i.id]: (parseInt(e.target.value.replace(/\D/g, ''), 10) || 0) * quantityFactor(i.orderSpecs) })}
                      style={{ maxWidth: 70, ...rowInputStyle }}
                    /></label>
                  ) : (
                    i.quantity
                  )}
                </td>
                <td>
                  {rowEditing ? (
                    <IconSelect
                      options={suppliers.filter((supplier) => supplier.categoryIds.length === 0 || supplier.categoryIds.includes(i.categoryId)).map((s) => ({ id: s.id, name: s.name }))}
                      value={supplierIds[i.id] || 'all'}
                      onChange={(v) => setSupplierIds({ ...supplierIds, [i.id]: v === 'all' ? '' : v })}
                      allLabel="Not assigned"
                    />
                  ) : (
                    suppliers.find((s) => s.id === supplierIds[i.id])?.name || 'Not assigned'
                  )}
                </td>
                <td>
                  {rowEditing ? (
                    <input type="text" inputMode="decimal" placeholder="Optional" value={costPrices[i.id] ?? ''} onChange={(event) => setCostPrices({ ...costPrices, [i.id]: event.target.value.replace(/[^\d.]/g, '') })} aria-label={`Cost price for ${i.categoryName} ${i.shapeName}`} style={{ maxWidth: 70, ...rowInputStyle }} />
                  ) : (
                    costPrices[i.id] ? `₹${costPrices[i.id]}` : '—'
                  )}
                </td>
                <td>
                  {rowEditing ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Optional"
                      value={prices[i.id] ?? ''}
                      onChange={(e) => setPrices({ ...prices, [i.id]: e.target.value.replace(/[^\d.]/g, '') })}
                      aria-label={`Selling price in INR for ${i.categoryName} ${i.shapeName} ${i.sizeMm} mm ${i.colorName}`}
                      style={{ maxWidth: 80, ...rowInputStyle }}
                    />
                  ) : (
                    prices[i.id] ? money(Number(prices[i.id])) : '—'
                  )}
                </td>
                {hasPricing && (
                  <td>{prices[i.id] ? money((parseFloat(prices[i.id]) || 0) * i.quantity) : '—'}</td>
                )}
                <td>
                  <button type="button" className="btn-danger" style={{ padding: '3px 7px', fontSize: 11 }} disabled={removingRowId === i.id} onClick={() => removeRow(i)}>
                    {removingRowId === i.id ? '…' : '🗑'}
                  </button>
                </td>
              </tr>
            );
          };

          const renderTable = (rowItems: Item[], includeNewLines: boolean) => (
            <>
            <p className="admin-order-lines-hint">Scroll the table sideways for supplier, CP and SP. Category stays pinned.</p>
            <div className="admin-order-lines-table" tabIndex={0} role="region" aria-label="Order line items">
              <table>
                <thead>
                  <tr><th></th><th>Category</th><th>Shape</th><th>Size</th><th>Color</th><th>Qty</th><th>Supplier</th><th>CP (₹)</th><th>SP</th>{hasPricing && <th>Line total</th>}<th></th></tr>
                </thead>
                <tbody>
                  {rowItems.map(renderRow)}
                  {includeNewLines && newLines.map((l) => {
                    const opts = categoryOptions[l.categoryId];
                    const sizesForShape = opts?.sizes.filter((s) => s.shapeId === l.shapeId) || [];
                    if(specialCategory(l.categoryId)&&opts)return <tr key={l.tempId}><td colSpan={10 + (hasPricing ? 1 : 0)}>
                      <select aria-label="New line category" value={l.categoryId} onChange={e=>updateNewLine(l.tempId,{categoryId:Number(e.target.value),orderSpecs:undefined,shapeId:'',sizeId:'',colorId:'',quantity:''})}>{orderCategories.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
                      {l.orderSpecs?<p>{specText(l.orderSpecs,Number(l.quantity))} · {l.quantity} pcs <button onClick={()=>updateNewLine(l.tempId,{orderSpecs:undefined})}>Change options</button></p>:<SpecialOrderComposer showRequestType={false} key={l.categoryId} categoryId={l.categoryId} categoryName={orderCategories.find(([id])=>id===l.categoryId)?.[1]||''} shapes={opts.shapes} sizes={opts.sizes} colors={opts.colors} onAdd={line=>updateNewLine(l.tempId,{shapeId:line.shapeId,sizeId:line.sizeId,colorId:line.colorId,quantity:String(line.qty),orderSpecs:line.orderSpecs})}/>}
                      <button type="button" onClick={()=>removeNewLine(l.tempId)}>Remove new line</button>
                    </td></tr>;
                    return (
                      <tr key={l.tempId}>
                        <td />
                        <td><select aria-label="New line category" value={l.categoryId} onChange={e=>updateNewLine(l.tempId,{categoryId:Number(e.target.value),shapeId:'',sizeId:'',colorId:'',quantity:'',orderSpecs:undefined})}>{orderCategories.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></td>
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
                          <select disabled={l.categoryId === 34} value={l.colorId} onChange={(e) => updateNewLine(l.tempId, { colorId: e.target.value ? Number(e.target.value) : '' })} style={{ fontSize: 12 }}>
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
                        <td /><td /><td />
                        {hasPricing && <td />}
                        <td>
                          <button type="button" className="btn-danger" onClick={() => removeNewLine(l.tempId)}>Remove</button>
                        </td>
                      </tr>
                    );
                  })}
                  {rowItems.length === 0 && !(includeNewLines && newLines.length > 0) && (
                    <tr><td colSpan={10 + (hasPricing ? 1 : 0)} style={{ textAlign: 'center', color: '#756e5c', padding: 20 }}>No lines in this category.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            </>
          );

          return (
            <>
              {renderTable(regularItems, true)}
              {quotationItems.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <h4 style={{ fontSize: 13, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Provide quotation</h4>
                  {renderTable(quotationItems, false)}
                </div>
              )}
              {hasPricing && (
                <p style={{ textAlign: 'right', fontSize: 13, marginTop: 10 }}>
                  <strong>{items.every(item => prices[item.id]?.trim()) ? 'Total' : 'Priced lines subtotal'}: {money(grandTotal)}</strong>
                </p>
              )}
            </>
          );
        })()}

        <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn-ghost" onClick={addNewLine} disabled={orderCategories.length === 0}>+ Add line</button>
          {newLines.length > 0 && (
            <>
              <button type="button" className="btn" onClick={saveNewLines} disabled={savingItems}>{savingItems ? 'Saving…' : 'Save new lines'}</button>
              <button type="button" className="btn-ghost" onClick={() => setNewLines([])}>Cancel</button>
            </>
          )}
        </div>

        {justUpdated && (
          <div className="card" style={{ marginTop: 16, padding: 14 }}>
            <p style={{ fontSize: 13, marginBottom: 8 }}>This order was just updated. Send the customer the latest version?</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={sendUpdatedOrderViaWhatsApp} disabled={!manualWaUrl}><WhatsAppIcon size={14} /> Send via WhatsApp</button>
              <button className="btn-ghost" onClick={generatePdf} disabled={generatingPdf}>{generatingPdf ? 'Generating…' : 'Send PDF'}</button>
              <button className="btn-ghost" onClick={() => setJustUpdated(false)}>Dismiss</button>
            </div>
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
          {timeline.length === 0 && <p style={{ fontSize: 12.5, color: '#756e5c' }}>No history yet.</p>}
          {timeline.map((t, i) => (
            <div key={i} className="card" style={{ padding: '10px 14px', fontSize: 13 }}>
              {t.type === 'status' ? (
                <span><strong>Status updated:</strong> {t.label} {t.messageSent && <span style={{ fontSize: 11, color: '#756e5c' }}>(WhatsApp action recorded; delivery unverified)</span>}</span>
              ) : (
                <span>
                  <strong>{t.author === 'admin' ? 'Admin' : t.author === 'customer' ? 'Customer' : 'System'}:</strong> {t.message}
                  {t.internalOnly && <span className="tag-chip" style={{ marginLeft: 8, fontSize: 10 }}>Internal only</span>}
                </span>
              )}
              <div style={{ fontSize: 11, color: '#756e5c', marginTop: 3 }}>{fmtDate(t.at)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
