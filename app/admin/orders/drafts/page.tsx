import Link from 'next/link';
import { listOrderDrafts } from '@/lib/order-drafts';
import DeleteDraftButton from './DeleteDraftButton';

// See app/admin/categories/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// Orders started in Admin > New order and saved to finish later. Drafts are
// not orders: no number, not in any order list or count, and the customer is
// never told. Continue reopens the builder; placing it there deletes the draft.
export default async function DraftOrdersPage() {
  let drafts: Awaited<ReturnType<typeof listOrderDrafts>>;
  try {
    drafts = await listOrderDrafts();
  } catch {
    return <p role="alert">Draft orders could not be loaded. Please retry.</p>;
  }

  return (
    <>
      <Link href="/admin/orders" className="back-link">&larr; All orders</Link>
      <div className="drafts-head">
        <h1>Draft orders</h1>
        <Link href="/admin/orders/new" className="btn">+ New order</Link>
      </div>
      <p className="drafts-intro">
        Orders saved half-way with &ldquo;Save as draft&rdquo;. A draft is not an order yet: the customer is not told and it has no order number. Continue to finish it and press Create order.
      </p>

      {drafts === null ? (
        <p className="drafts-empty" role="status">Draft orders need a one-time database update before they can be used. Orders can still be created as usual.</p>
      ) : drafts.length === 0 ? (
        <p className="drafts-empty">No draft orders. Use &ldquo;Save as draft&rdquo; on a new order to keep it for later.</p>
      ) : (
        <ul className="drafts-list">
          {drafts.map((d) => (
            <li key={d.id} className="drafts-card">
              <div className="drafts-main">
                <strong>{d.customerLabel}</strong>
                <span className="drafts-meta">
                  {d.lineCount} {d.lineCount === 1 ? 'line' : 'lines'}
                  {d.pieces > 0 && <> &middot; {d.pieces.toLocaleString('en-IN')} pcs</>}
                  {d.categories.length > 0 && <> &middot; {d.categories.slice(0, 3).join(', ')}{d.categories.length > 3 ? ` +${d.categories.length - 3}` : ''}</>}
                </span>
                {d.note && <span className="drafts-note">{d.note.length > 120 ? `${d.note.slice(0, 120)}…` : d.note}</span>}
                <span className="drafts-time">#D{d.id} &middot; last edited {when(d.updatedAt)}</span>
              </div>
              <div className="drafts-actions">
                <Link href={`/admin/orders/new?draft=${d.id}`} className="btn">Continue</Link>
                <DeleteDraftButton id={d.id} label={d.customerLabel} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
