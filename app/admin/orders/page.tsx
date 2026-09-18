import { supabaseAdmin } from '@/lib/supabase-admin';
import { ORDER_STATUS_OPTIONS } from '@/lib/order-milestones';
import { CUSTOMER_PLACES } from '@/lib/customer-places';
import OrderRowStatus from '@/components/admin/OrderRowStatus';
import Link from 'next/link';
import CustomerNameDisplay from '@/components/admin/CustomerNameDisplay';
import CategoryChips from '@/components/admin/CategoryChips';
import AutoSubmitField from '@/components/admin/AutoSubmitField';
import DebouncedSearchField from '@/components/admin/DebouncedSearchField';
import MultiSelectFilter from '@/components/admin/MultiSelectFilter';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
// (searchParams usage likely already forces this dynamic, but making it
// explicit removes any doubt.)
export const dynamic = 'force-dynamic';

const PURCHASE_TYPES = ['Place Order'];
// A "Mixed" order has at least one quotation line in it, so it still needs
// quotation follow-up -- it belongs in the RQ table, not just the purchase one.
const RQ_TYPES = ['Request Quotation', 'Mixed'];
const PAGE_SIZE = 50;

export default async function AdminOrdersPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ status?: string; page?: string; rqPage?: string; q?: string; from?: string; to?: string; sort?: string; place?: string }> }) {
  const searchParams = await searchParamsPromise;
  const statusFilter = ORDER_STATUS_OPTIONS.some((m) => m.key === searchParams.status) ? searchParams.status : undefined;
  const search = (searchParams.q || '').replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 80);
  const places = (searchParams.place || '').split(',').map((v) => v.trim()).filter((v) => (CUSTOMER_PLACES as readonly string[]).includes(v));
  const validDate = (value?: string) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? value : undefined;
  const from = validDate(searchParams.from), to = validDate(searchParams.to);
  const filtersActive = Boolean(statusFilter || search || places.length || from || to);
  const oldest = searchParams.sort === 'oldest';
  const parsePage = (raw: string | undefined) => {
    const n = Number(raw || 1);
    return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 100000) : 1;
  };
  const page = parsePage(searchParams.page);
  const rqPage = parsePage(searchParams.rqPage);
  function filterUrl(status: string | undefined, targetPage = 1, targetRqPage = 1, sortOldest = oldest) {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (places.length) params.set('place', places.join(','));
    if (sortOldest) params.set('sort', 'oldest');
    if (status) params.set('status', status);
    if (targetPage > 1) params.set('page', String(targetPage));
    if (targetRqPage > 1) params.set('rqPage', String(targetRqPage));
    return `/admin/orders${params.size ? `?${params}` : ''}`;
  }

  let searchFilters: string[] | null = null;
  if (search) {
    const { data: matches, error: customerError } = await supabaseAdmin.from('customers').select('id')
      .or(`name.ilike.%${search}%,phone.ilike.%${search}%`).limit(1000);
    if (customerError) return <p role="alert">Customer search could not be loaded. Please retry.</p>;
    if ((matches || []).length >= 1000) return <p role="alert">This search matches too many customers. <Link href="/admin/orders">Return to orders</Link> and enter a more specific name or number.</p>;
    searchFilters = [`contact_name.ilike.%${search}%`];
    if (/^\d+$/.test(search) && Number.isSafeInteger(Number(search))) searchFilters.push(`id.eq.${Number(search)}`);
    if (matches?.length) searchFilters.push(`customer_id.in.(${matches.map(row => row.id).join(',')})`);
  }

  let placeCustomerIds: number[] | null = null;
  if (places.length) {
    const { data: matches } = await supabaseAdmin.from('customers').select('id').in('place', places).limit(1000);
    placeCustomerIds = (matches || []).map((row: any) => row.id);
  }

  function baseQuery() {
    let q = supabaseAdmin
      .from('orders')
      .select('id, customer_id, status, payment_status, created_at, contact_name, request_type', { count: 'exact' })
      .order('created_at', { ascending: oldest }).order('id', { ascending: oldest });
    if (statusFilter) q = q.eq('status', statusFilter);
    if (from) q = q.gte('created_at', `${from}T00:00:00+05:30`);
    if (to) q = q.lte('created_at', `${to}T23:59:59.999+05:30`);
    if (searchFilters) q = q.or(searchFilters.join(','));
    if (placeCustomerIds) q = q.in('customer_id', placeCustomerIds.length ? placeCustomerIds : [-1]);
    return q;
  }

  const [{ data: purchaseOrders, error: purchaseError, count: purchaseCount }, { data: rqOrders, error: rqError, count: rqCount }] = await Promise.all([
    baseQuery().in('request_type', PURCHASE_TYPES).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    baseQuery().in('request_type', RQ_TYPES).range((rqPage - 1) * PAGE_SIZE, rqPage * PAGE_SIZE - 1)
  ]);
  if (purchaseError || rqError) return <p role="alert">Orders could not be loaded. Please refresh and try again.</p>;

  const allOrders = [...(purchaseOrders || []), ...(rqOrders || [])];
  const customerIds = [...new Set(allOrders.map((o: any) => o.customer_id).filter(Boolean))];
  const { data: customers } = customerIds.length
    ? await supabaseAdmin.from('customers').select('id, name, company, phone').in('id', customerIds)
    : { data: [] };
  const custMap: Record<number, any> = Object.fromEntries((customers || []).map((c: any) => [c.id, c]));

  const orderIds = allOrders.map((o: any) => o.id);
  const [{ data: items }, { data: categories }] = await Promise.all([
    orderIds.length
      ? supabaseAdmin.from('order_items').select('order_id, quantity, unit_price, request_type, category_id').in('order_id', orderIds)
      : Promise.resolve({ data: [] as any[] }),
    supabaseAdmin.from('categories').select('id, name')
  ]);
  const categoryNameById: Record<number, string> = Object.fromEntries((categories || []).map((c: any) => [c.id, c.name]));
  const stats: Record<number, { unpricedQuotes: number; categoryNames: string[] }> = {};
  (items || []).forEach((it: any) => {
    if (!stats[it.order_id]) stats[it.order_id] = { unpricedQuotes: 0, categoryNames: [] };
    if (it.request_type === 'Request Quotation' && it.unit_price == null) stats[it.order_id].unpricedQuotes += 1;
    const name = categoryNameById[it.category_id];
    if (name && !stats[it.order_id].categoryNames.includes(name)) stats[it.order_id].categoryNames.push(name);
  });

  function OrdersTable({ orders, count, currentPage, pageParam, title, emptyText, anchorId, headerExtra }: { orders: any[]; count: number; currentPage: number; pageParam: 'page' | 'rqPage'; title: string; emptyText: string; anchorId?: string; headerExtra?: React.ReactNode }) {
    return (
      <section id={anchorId} style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <h2 style={{ fontSize: 15, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>{title}{filtersActive && <span style={{ color: '#756e5c', textTransform: 'none', letterSpacing: 0, fontSize: 12.5 }}> ({count} matching)</span>}</h2>
          {headerExtra}
        </div>
        {/* Card grid is the mobile layout (table is display:none under 700px,
            see globals.css) -- kept in sync here in one component instead of
            two hand-duplicated blocks. */}
        <div className="admin-order-cards">
          {orders.map((o: any) => {
            const cust = custMap[o.customer_id];
            const s = stats[o.id] || { unpricedQuotes: 0, categoryNames: [] };
            return (
              <article key={o.id} className="card admin-order-card">
                <Link href={`/admin/orders/${o.id}`} className="admin-order-card-hit" aria-label={`Open order ${o.id}`} />
                <h2>Order #{o.id}</h2>
                <p>
                  {cust ? <Link className="admin-card-customer-link" href={`/admin/customers/${cust.id}`}><CustomerNameDisplay name={cust.name} company={cust.company} /></Link> : (o.contact_name || 'No contact name')}
                </p>
                <dl>
                  <div><dt>Placed</dt><dd>{new Date(o.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</dd></div>
                  <div><dt>Status</dt><dd><OrderRowStatus orderId={o.id} status={o.status} isQuotation={o.request_type === 'Request Quotation' || o.request_type === 'Mixed'} customerName={cust?.name || o.contact_name || null} customerPhone={cust?.phone || null} /></dd></div>
                  <div><dt>Category</dt><dd><CategoryChips names={s.categoryNames} /></dd></div>
                </dl>
                {!!s.unpricedQuotes && <p>{s.unpricedQuotes} quotation lines need pricing</p>}
                <span className="admin-card-open-label">Open order →</span>
              </article>
            );
          })}
          {orders.length === 0 && <p>{emptyText}</p>}
        </div>
        <div className="admin-orders-table-wrap" tabIndex={0} role="region" aria-label={`${title} table`}>
          <table>
            <thead>
              <tr><th>#</th><th>Customer</th><th>Date</th><th>Category</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {orders.map((o: any) => {
                const cust = custMap[o.customer_id];
                const s = stats[o.id] || { unpricedQuotes: 0, categoryNames: [] };
                return (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>
                      {cust ? <Link className="admin-table-link" href={`/admin/customers/${cust.id}`}><CustomerNameDisplay name={cust.name} company={cust.company} /></Link> : (o.contact_name || '—')}
                    </td>
                    <td>{new Date(o.created_at).toLocaleDateString('en-IN')}</td>
                    <td><CategoryChips names={s.categoryNames} />{s.unpricedQuotes > 0 && <p className="admin-coverage-note">{s.unpricedQuotes} quote {s.unpricedQuotes === 1 ? 'line needs' : 'lines need'} pricing</p>}</td>
                    <td><OrderRowStatus orderId={o.id} status={o.status} isQuotation={o.request_type === 'Request Quotation' || o.request_type === 'Mixed'} customerName={cust?.name || o.contact_name || null} customerPhone={cust?.phone || null} /></td>
                    <td><Link href={`/admin/orders/${o.id}`} aria-label={`Manage order ${o.id}`} className="btn-ghost" style={{ display: 'inline-block' }}>Manage &rarr;</Link></td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#756e5c', padding: 30 }}>{emptyText}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <nav className="admin-coverage-filters" aria-label={`${title} pages`}>
          {currentPage > 1 && <Link className="btn-ghost" href={pageParam === 'page' ? filterUrl(statusFilter, currentPage - 1, rqPage) : filterUrl(statusFilter, page, currentPage - 1)}>← Previous</Link>}
          {currentPage * PAGE_SIZE < count && <Link className="btn-ghost" href={pageParam === 'page' ? filterUrl(statusFilter, currentPage + 1, rqPage) : filterUrl(statusFilter, page, currentPage + 1)}>Next →</Link>}
        </nav>
      </section>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 4 }}>
        <h1>Orders</h1>
        <Link href="/admin/orders/new" className="btn" style={{ display: 'inline-block' }}>+ New order</Link>
      </div>
      <form method="get" id="admin-order-search-form" className="admin-order-search">
        {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
        <label>Search<DebouncedSearchField name="q" defaultValue={search} placeholder="Search orders" /></label>
        <AutoSubmitField>
          <label style={{ flex: '0 1 200px' }}>
            Date range
            <span style={{ display: 'flex', gap: 4 }}>
              <input type="date" name="from" defaultValue={from} aria-label="From date" style={{ minHeight: 44 }} />
              <input type="date" name="to" defaultValue={to} aria-label="To date" style={{ minHeight: 44 }} />
            </span>
          </label>
        </AutoSubmitField>
        <MultiSelectFilter name="place" label="Place" options={[...CUSTOMER_PLACES]} selected={places} />
        {filtersActive && <Link href="/admin/orders" style={{ fontSize: 12.5, color: '#756e5c', textDecoration: 'underline', alignSelf: 'center', marginLeft: 'auto' }}>Clear filters</Link>}
      </form>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        <Link href={filterUrl(undefined)} className={`tag-chip ${!statusFilter ? 'active' : ''}`} aria-current={!statusFilter ? 'page' : undefined}>All statuses</Link>
        {ORDER_STATUS_OPTIONS.map((m) => (
          <Link
            key={m.key}
            href={filterUrl(m.key)}
            className={`tag-chip ${statusFilter === m.key ? 'active' : ''}`}
            aria-current={statusFilter === m.key ? 'page' : undefined}
          >
            {m.label}
          </Link>
        ))}
      </div>
      <OrdersTable
        orders={purchaseOrders || []} count={purchaseCount || 0} currentPage={page} pageParam="page" title="Orders" emptyText="No orders match this filter."
        headerExtra={
          <div className="cat-view-toggle" role="group" aria-label="Sort">
            <Link href={filterUrl(statusFilter, 1, 1, false)} className={!oldest ? 'active' : ''} aria-current={!oldest ? 'true' : undefined} title="Newest first">↓ Newest</Link>
            <Link href={filterUrl(statusFilter, 1, 1, true)} className={oldest ? 'active' : ''} aria-current={oldest ? 'true' : undefined} title="Oldest first">↑ Oldest</Link>
          </div>
        }
      />
      <OrdersTable orders={rqOrders || []} count={rqCount || 0} currentPage={rqPage} pageParam="rqPage" title="Request quotations" emptyText="No quotation requests match this filter." anchorId="request-quotations" />
    </>
  );
}
