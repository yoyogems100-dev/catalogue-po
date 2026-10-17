import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import { hasFulfilmentColumns } from '@/lib/line-fulfilment';
import { pendingByBuyer, type PendingItemRow, type PendingOrder } from '@/lib/pending-lines';
import DebouncedSearchField from '@/components/admin/DebouncedSearchField';
import AutoSubmitField from '@/components/admin/AutoSubmitField';
import CustomerNameDisplay from '@/components/admin/CustomerNameDisplay';
import LineFulfilment from '@/components/admin/LineFulfilment';

export const dynamic = 'force-dynamic';

const CLOSED = ['delivered', 'cancelled'];
const fmt = (n: number) => n.toLocaleString('en-IN');
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// Every line still to send, buyer by buyer -- the team's "Pending Order"
// sheet, kept from the orders themselves. Change "Sent" as stock goes out;
// a line leaves this page once all of it has been sent.
export default async function PendingLinesPage({ searchParams: sp }: { searchParams: Promise<{ q?: string; check?: string }> }) {
  const searchParams = await sp;
  const search = (searchParams.q || '').trim().slice(0, 80);
  const checkOnly = searchParams.check === '1';

  const { data: orders, error: ordersError } = await fetchAllRows<PendingOrder>((from, to) =>
    supabaseAdmin.from('orders').select('id, customer_id, contact_name, created_at, status', { count: 'exact' })
      .is('deleted_at', null).not('status', 'in', `(${CLOSED.join(',')})`).order('id').range(from, to));
  if (ordersError) return <p role="alert">Orders could not be loaded. Please retry.</p>;
  const orderIds = (orders || []).map((o) => o.id);

  const items: PendingItemRow[] = [];
  for (let i = 0; i < orderIds.length; i += 200) {
    const chunk = orderIds.slice(i, i + 200);
    const { data, error } = await fetchAllRows<PendingItemRow>((from, to) =>
      supabaseAdmin.from('order_items').select('*', { count: 'exact' }).in('order_id', chunk).order('id').range(from, to));
    if (error) return <p role="alert">Order lines could not be loaded. Please retry.</p>;
    items.push(...(data || []));
  }
  const tracking = items.length === 0 || hasFulfilmentColumns(items[0]);

  const ids = (key: keyof PendingItemRow) => [...new Set(items.map((it) => it[key]).filter((v): v is number => typeof v === 'number'))];
  const customerIds = [...new Set((orders || []).map((o) => o.customer_id).filter((v): v is number => !!v))];
  const [cats, shapes, sizes, colors, customers] = await Promise.all([
    ids('category_id').length ? supabaseAdmin.from('categories').select('id, name').in('id', ids('category_id')) : { data: [] },
    ids('shape_id').length ? supabaseAdmin.from('shapes').select('id, name').in('id', ids('shape_id')) : { data: [] },
    ids('shape_size_id').length ? supabaseAdmin.from('shape_sizes').select('id, size_mm').in('id', ids('shape_size_id')) : { data: [] },
    ids('color_id').length ? supabaseAdmin.from('colors').select('id, name').in('id', ids('color_id')) : { data: [] },
    customerIds.length ? supabaseAdmin.from('customers').select('id, name, company').in('id', customerIds) : { data: [] },
  ]);
  const byId = <T extends { id: number }, V>(rows: T[] | null, f: (r: T) => V) => Object.fromEntries((rows || []).map((r) => [r.id, f(r)]));
  const groups = pendingByBuyer(orders || [], items, {
    category: byId(cats.data as { id: number; name: string }[], (r) => r.name),
    shape: byId(shapes.data as { id: number; name: string }[], (r) => r.name),
    size: byId(sizes.data as { id: number; size_mm: string }[], (r) => r.size_mm),
    color: byId(colors.data as { id: number; name: string }[], (r) => r.name),
    customer: byId(customers.data as { id: number; name: string | null; company: string | null }[], (r) => ({ name: r.name, company: r.company })),
  }, { search, checkOnly });
  const lineCount = groups.reduce((n, g) => n + g.lines.length, 0);
  const flagged = groups.reduce((n, g) => n + g.lines.filter((l) => l.needsCheck).length, 0);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 4 }}>
        <h1>Pending lines</h1>
        <Link href="/admin/orders" className="btn-ghost">All orders</Link>
      </div>
      <p className="pending-intro">
        Every line still to send on open orders, buyer by buyer. Type what went out in <b>Sent</b>; a line leaves this list once all of it is sent.
      </p>
      {!tracking && (
        <p className="pending-warn" role="status">Delivery tracking switches on after the database update. Until then every line shows as not sent and Sent can&rsquo;t be saved.</p>
      )}
      <form method="get" className="admin-order-search">
        <label>Search<DebouncedSearchField name="q" defaultValue={search} placeholder="Buyer, stone, colour, size or #order" /></label>
        <AutoSubmitField>
          <label className="pending-check-filter">
            <input type="checkbox" name="check" value="1" defaultChecked={checkOnly} /> Only lines flagged to check
          </label>
        </AutoSubmitField>
      </form>
      <p className="pending-summary">
        <b>{fmt(lineCount)}</b> {lineCount === 1 ? 'line' : 'lines'} for <b>{fmt(groups.length)}</b> {groups.length === 1 ? 'buyer' : 'buyers'}
        {flagged > 0 && !checkOnly && <> · <Link href="/admin/pending?check=1">{fmt(flagged)} flagged to check</Link></>}
      </p>
      {groups.length === 0 && <p className="po-empty">{search || checkOnly ? 'Nothing matches.' : 'Nothing left to send. 🎉'}</p>}
      <div className="pending-buyers">
        {groups.map((g) => (
          <section key={g.key} className="pending-buyer">
            <header className="pending-buyer-head">
              <h2>
                {g.customerId
                  ? <Link href={`/admin/customers/${g.customerId}`}><CustomerNameDisplay name={g.name} company={g.company} /></Link>
                  : <CustomerNameDisplay name={g.name} company={g.company} />}
              </h2>
              <span>
                {g.lines.length} {g.lines.length === 1 ? 'line' : 'lines'} · {fmt(g.left)} left · waiting since {day(g.oldest)}
              </span>
            </header>
            <ul className="pending-lines">
              {g.lines.map((l, i) => (
                <li key={l.id} className="pending-line">
                  {(i === 0 || g.lines[i - 1].orderId !== l.orderId) && (
                    <Link className="pending-order-link" href={`/admin/orders/${l.orderId}`}>Order #{l.orderId} · {day(l.orderDate)}</Link>
                  )}
                  <div className="pending-line-main">
                    <strong>{l.colour} · {l.shape} {l.size}{/\d$/.test(l.size) ? ' mm' : ''}</strong>
                    <span>{l.stone} · ordered {fmt(l.quantity)}</span>
                    {l.note && <em>Note: {l.note}</em>}
                  </div>
                  {tracking && <LineFulfilment itemId={l.id} quantity={l.quantity} initialSent={l.sent} initialCheck={l.needsCheck} />}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
