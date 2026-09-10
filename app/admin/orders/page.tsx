import { supabaseAdmin } from '@/lib/supabase-admin';
import { ORDER_MILESTONES, milestoneLabel } from '@/lib/order-milestones';
import { maskPhone } from '@/lib/mask';
import Link from 'next/link';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
// (searchParams usage likely already forces this dynamic, but making it
// explicit removes any doubt.)
export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ status?: string; type?: string; page?: string; q?: string; payment?: string; from?: string; to?: string; sort?: string }> }) {
  const searchParams = await searchParamsPromise;
  const statusFilter = ORDER_MILESTONES.some((m) => m.key === searchParams.status) ? searchParams.status : undefined;
  const typeFilter = ['quotations', 'purchases'].includes(searchParams.type || '') ? searchParams.type : undefined;
  const search = (searchParams.q || '').replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 80);
  const payment = ['pending', 'partial', 'paid'].includes(searchParams.payment || '') ? searchParams.payment : undefined;
  const validDate = (value?: string) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? value : undefined;
  const from = validDate(searchParams.from), to = validDate(searchParams.to);
  const oldest = searchParams.sort === 'oldest';
  const requestedPage = Number(searchParams.page || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
  const pageSize = 50;
  function filterUrl(status: string | undefined, type: string | undefined, targetPage = 1) {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (payment) params.set('payment', payment);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (oldest) params.set('sort', 'oldest');
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    if (targetPage > 1) params.set('page', String(targetPage));
    return `/admin/orders${params.size ? `?${params}` : ''}`;
  }

  let query = supabaseAdmin
    .from('orders')
    .select('id, customer_id, status, payment_status, created_at, contact_name, request_type', { count: 'exact' })
    .order('created_at', { ascending: oldest }).order('id', { ascending: oldest });
  if (statusFilter) query = query.eq('status', statusFilter);
  if (typeFilter) query = query.in('request_type', [typeFilter === 'quotations' ? 'Request Quotation' : 'Place Order', 'Mixed']);
  if (payment) query = query.eq('payment_status', payment);
  if (from) query = query.gte('created_at', `${from}T00:00:00+05:30`);
  if (to) query = query.lte('created_at', `${to}T23:59:59.999+05:30`);
  if (search) {
    const { data: matches, error: customerError } = await supabaseAdmin.from('customers').select('id')
      .or(`name.ilike.%${search}%,phone.ilike.%${search}%`).limit(1000);
    if (customerError) return <p role="alert">Customer search could not be loaded. Please retry.</p>;
    if ((matches || []).length >= 1000) return <p role="alert">This search matches too many customers. <Link href="/admin/orders">Return to orders</Link> and enter a more specific name or number.</p>;
    const filters = [`contact_name.ilike.%${search}%`];
    if (/^\d+$/.test(search) && Number.isSafeInteger(Number(search))) filters.push(`id.eq.${Number(search)}`);
    if (matches?.length) filters.push(`customer_id.in.(${matches.map(row => row.id).join(',')})`);
    query = query.or(filters.join(','));
  }
  const { data: orders, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) return <p role="alert">Orders could not be loaded. Please refresh and try again.</p>;

  const customerIds = [...new Set((orders || []).map((o: any) => o.customer_id).filter(Boolean))];
  const { data: customers } = customerIds.length
    ? await supabaseAdmin.from('customers').select('id, name, phone').in('id', customerIds)
    : { data: [] };
  const custMap: Record<number, any> = Object.fromEntries((customers || []).map((c: any) => [c.id, c]));

  const orderIds = (orders || []).map((o: any) => o.id);
  const { data: items } = orderIds.length
    ? await supabaseAdmin.from('order_items').select('order_id, quantity, unit_price, request_type').in('order_id', orderIds)
    : { data: [] };
  const stats: Record<number, { lines: number; pieces: number; unpricedQuotes: number }> = {};
  (items || []).forEach((it: any) => {
    if (!stats[it.order_id]) stats[it.order_id] = { lines: 0, pieces: 0, unpricedQuotes: 0 };
    stats[it.order_id].lines += 1;
    stats[it.order_id].pieces += it.quantity;
    if (it.request_type === 'Request Quotation' && it.unit_price == null) stats[it.order_id].unpricedQuotes += 1;
  });

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 4 }}>
        <h1>Orders</h1>
        <Link href="/admin/orders/new" className="btn" style={{ display: 'inline-block' }}>+ New order</Link>
      </div>
      <form method="get" className="admin-order-search">
        {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
        {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
        <label>Order / customer / phone<input name="q" defaultValue={search} placeholder="Search orders" /></label>
        <label>Payment<select name="payment" defaultValue={payment || ''}><option value="">All payments</option><option value="pending">Pending</option><option value="partial">Partial</option><option value="paid">Paid</option></select></label>
        <label>From (India time)<input type="date" name="from" defaultValue={from} /></label>
        <label>To (India time)<input type="date" name="to" defaultValue={to} /></label>
        <label>Sort<select name="sort" defaultValue={oldest ? 'oldest' : 'newest'}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
        <button className="btn" type="submit">Apply filters</button><Link className="btn-ghost" href="/admin/orders">Clear filters</Link>
      </form>
      <nav className="admin-coverage-filters" aria-label="Request type">
        {[{ key: undefined, label: 'All requests' }, { key: 'quotations', label: 'Quotations' }, { key: 'purchases', label: 'Purchases' }].map((filter) => (
          <Link key={filter.key || 'all'} href={filterUrl(statusFilter, filter.key)} className={`tag-chip ${typeFilter === filter.key ? 'active' : ''}`} aria-current={typeFilter === filter.key ? 'page' : undefined}>{filter.label}</Link>
        ))}
      </nav>
      {typeFilter && <p className="admin-results-summary">Mixed requirements appear in both lists. Quotation lines without a price are marked for follow-up.</p>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        <Link href={filterUrl(undefined, typeFilter)} className={`tag-chip ${!statusFilter ? 'active' : ''}`} aria-current={!statusFilter ? 'page' : undefined}>All statuses</Link>
        {ORDER_MILESTONES.map((m) => (
          <Link
            key={m.key}
            href={filterUrl(m.key, typeFilter)}
            className={`tag-chip ${statusFilter === m.key ? 'active' : ''}`}
            aria-current={statusFilter === m.key ? 'page' : undefined}
          >
            {m.label}
          </Link>
        ))}
      </div>
      <p className="admin-results-summary">{count || 0} matching requests · page {page}</p>
      <div className="admin-order-cards">
        {(orders || []).map(order => {
          const customer = custMap[order.customer_id];
          const summary = stats[order.id];
          return <article key={order.id} className="card admin-order-card">
            <h2><Link href={`/admin/orders/${order.id}`}>Order #{order.id}</Link></h2>
            <p>{customer?.name || order.contact_name || 'No contact name'} {customer?.phone && `· ${maskPhone(customer.phone)}`}</p>
            <dl><div><dt>Placed</dt><dd>{new Date(order.created_at).toLocaleDateString('en-IN', {timeZone:'Asia/Kolkata'})}</dd></div>
            <div><dt>Status</dt><dd>{milestoneLabel(order.status)}</dd></div><div><dt>Payment</dt><dd>{order.payment_status || 'pending'}</dd></div>
            <div><dt>Request</dt><dd>{order.request_type === 'Place Order' ? 'Purchase' : order.request_type || 'Purchase'}</dd></div>
            <div><dt>Contents</dt><dd>{summary?.lines || 0} lines · {(summary?.pieces || 0).toLocaleString('en-IN')} pieces</dd></div></dl>
            {!!summary?.unpricedQuotes && <p>{summary.unpricedQuotes} quotation lines need pricing</p>}
            <Link className="btn-ghost" href={`/admin/orders/${order.id}`}>Manage order #{order.id}</Link>
          </article>;
        })}
        {!orders?.length && <p>No orders match these filters.</p>}
      </div>
      <div className="admin-orders-table-wrap" tabIndex={0} role="region" aria-label="Orders table">
      <table>
        <thead>
          <tr><th>#</th><th>Customer</th><th>Date</th><th>Request</th><th>Status</th><th>Payment</th><th>Lines</th><th>Pieces</th><th></th></tr>
        </thead>
        <tbody>
          {(orders || []).map((o: any) => {
            const cust = custMap[o.customer_id];
            const s = stats[o.id] || { lines: 0, pieces: 0, unpricedQuotes: 0 };
            return (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>
                  {cust ? (cust.name || maskPhone(cust.phone) || '—') : (o.contact_name || '—')}
                  {cust?.name && cust?.phone ? ` · ${maskPhone(cust.phone)}` : ''}
                </td>
                <td>{new Date(o.created_at).toLocaleDateString('en-IN')}</td>
                <td>{o.request_type === 'Place Order' ? 'Purchase' : o.request_type || 'Purchase'}{s.unpricedQuotes > 0 && <p className="admin-coverage-note">{s.unpricedQuotes} quote {s.unpricedQuotes === 1 ? 'line needs' : 'lines need'} pricing</p>}</td>
                <td>{milestoneLabel(o.status)}</td>
                <td><span className={`payment-badge payment-${o.payment_status}`}>{o.payment_status}</span></td>
                <td>{s.lines}</td>
                <td>{s.pieces.toLocaleString('en-IN')}</td>
                <td><Link href={`/admin/orders/${o.id}`} aria-label={`Manage order ${o.id}`} className="btn-ghost" style={{ display: 'inline-block' }}>Manage &rarr;</Link></td>
              </tr>
            );
          })}
          {(orders || []).length === 0 && (
            <tr><td colSpan={9} style={{ textAlign: 'center', color: '#756e5c', padding: 30 }}>No orders match this filter.</td></tr>
          )}
        </tbody>
      </table>
      </div>
      <nav className="admin-coverage-filters" aria-label="Order pages">
        {page > 1 && <Link className="btn-ghost" href={filterUrl(statusFilter, typeFilter, page - 1)}>← Previous</Link>}
        {page * pageSize < (count || 0) && <Link className="btn-ghost" href={filterUrl(statusFilter, typeFilter, page + 1)}>Next →</Link>}
      </nav>
    </>
  );
}
