import Link from 'next/link';
import Form from 'next/form';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import StatusTag from '@/components/admin/StatusTag';
import { CUSTOMER_PLACES } from '@/lib/customer-places';
import CustomerCreateForm from './CustomerCreateForm';
import DebouncedSearchField from '@/components/admin/DebouncedSearchField';
import CategoryFilterField from '@/components/admin/CategoryFilterField';
import MultiSelectFilter from '@/components/admin/MultiSelectFilter';
import BulkImportButton from '@/components/admin/BulkImportButton';
import DeleteRowButton from '@/components/admin/DeleteRowButton';

export const dynamic = 'force-dynamic';

const WORK_STREAMS = ['Silver jewellery', 'Gold jewellery', 'Commercial jewellery', 'Fashion jewellery', 'Gemstone trader', 'Manufacturer', 'Retailer', 'Other'];

function parseMulti(raw: string | undefined, allowed: readonly string[]) {
  return (raw || '').split(',').map((v) => v.trim()).filter((v) => allowed.includes(v));
}

// Buyers who have ordered from any of these categories: one paged read of the
// matching order lines with their order's buyer embedded (it was two reads in
// a row, and stopped silently at 1000 order lines).
async function customerIdsOrderedFromCategories(categoryIds: number[]) {
  if (!categoryIds.length) return [];
  const { data } = await fetchAllRows<{ orders: { customer_id: number | null } | { customer_id: number | null }[] | null }>((from, to) =>
    supabaseAdmin.from('order_items').select('id, orders(customer_id)', { count: 'exact' }).in('category_id', categoryIds).order('id').range(from, to));
  // A line has one order; the untyped client just can't tell it's not a list.
  return [...new Set((data || []).flatMap((i) => [i.orders].flat()).map((o) => o?.customer_id).filter(Boolean))] as number[];
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; place?: string; category?: string; workStream?: string }> }) {
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 80) || '';
  const places = parseMulti(params.place, CUSTOMER_PLACES);
  const workStreams = parseMulti(params.workStream, WORK_STREAMS);
  const categoryIds = (params.category || '').split(',').map((v) => v.trim()).filter((v) => /^\d+$/.test(v)).map(Number);
  const safeQ = q.replace(/[,()%]/g, '');
  // Everything the customer query depends on is looked up side by side.
  const [{ data: allCategories }, categoryCustomerIds, filterCustomerIds] = await Promise.all([
    supabaseAdmin.from('categories').select('id,name,slug').order('name'),
    // A search also finds buyers of any category whose name matches.
    safeQ
      ? supabaseAdmin.from('categories').select('id').ilike('name', `%${safeQ}%`)
          .then(({ data }) => customerIdsOrderedFromCategories((data || []).map((c: any) => c.id)))
      : Promise.resolve([] as number[]),
    categoryIds.length ? customerIdsOrderedFromCategories(categoryIds) : Promise.resolve(null)
  ]);

  let query = supabaseAdmin.from('customers').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(250);
  if (safeQ) {
    const orClauses = [`name.ilike.%${safeQ}%`, `company.ilike.%${safeQ}%`, `phone.ilike.%${safeQ}%`];
    if (categoryCustomerIds.length) orClauses.push(`id.in.(${categoryCustomerIds.join(',')})`);
    query = query.or(orClauses.join(','));
  }
  if (places.length) query = query.in('place', places);
  if (workStreams.length) query = query.in('work_stream', workStreams);
  if (filterCustomerIds) query = query.in('id', filterCustomerIds.length ? filterCustomerIds : [-1]);
  const { data: customers, error } = await query;
  const customerIds = (customers || []).map((customer: any) => customer.id);
  const { data: orders } = customerIds.length
    ? await fetchAllRows<{ id: number; customer_id: number; status: string; created_at: string }>((from, to) =>
        supabaseAdmin.from('orders').select('id,customer_id,status,created_at', { count: 'exact' }).in('customer_id', customerIds).order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to))
    : { data: [] };
  const stats = new Map<number, { count: number; latest?: any }>();
  for (const order of orders || []) {
    const current = stats.get(order.customer_id) || { count: 0 };
    current.count += 1;
    if (!current.latest) current.latest = order;
    stats.set(order.customer_id, current);
  }

  const filtersActive = Boolean(q || places.length || workStreams.length || categoryIds.length);
  const exportParams = new URLSearchParams();
  if (q) exportParams.set('q', q);
  if (places.length) exportParams.set('place', places.join(','));
  if (workStreams.length) exportParams.set('workStream', workStreams.join(','));
  if (categoryIds.length) exportParams.set('category', categoryIds.join(','));

  return <>
    <div className="admin-page-head"><div><h1>Customers</h1><p>Customer profiles, buying preferences and complete order history.</p></div><div className="admin-head-actions"><BulkImportButton entity="customers" label="Import from Excel" /><a className="btn-ghost" href={`/api/admin/customers/export${exportParams.size ? `?${exportParams}` : ''}`}>Export to Excel</a><CustomerCreateForm /></div></div>
    <Form action="" replace scroll={false} className="admin-directory-search" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
      <label className="admin-directory-search-field">Search<DebouncedSearchField name="q" defaultValue={q} placeholder="Search name, company or WhatsApp number" /></label>
      <CategoryFilterField categories={allCategories || []} defaultCategoryIds={categoryIds} />
      <MultiSelectFilter name="workStream" label="Work stream" options={WORK_STREAMS} selected={workStreams} />
      <MultiSelectFilter name="place" label="Place" options={[...CUSTOMER_PLACES]} selected={places} />
      {filtersActive && <Link href="/admin/customers" style={{ fontSize: 12.5, color: '#756e5c', textDecoration: 'underline', alignSelf: 'center', marginLeft: 'auto' }}>Clear filters</Link>}
    </Form>
    {error && <p role="alert">Customers could not be loaded. Please refresh.</p>}
    <p className="admin-results-summary">{(customers || []).length} customers</p>
    <div className="admin-customer-cards">
      {(customers || []).map((customer: any) => {
        const customerStats = stats.get(customer.id);
        return <div className="admin-customer-card-wrap" key={customer.id}>
          <Link href={`/admin/customers/${customer.id}`} className="card admin-customer-card">
          <strong>{customer.name || 'Unnamed customer'}</strong>
          <span>{customer.company || 'No company'} · {customer.phone || 'No WhatsApp number'}</span>
          <span>{customer.work_stream || 'Work stream not added'}{customer.place ? ` · ${customer.place}` : ''}</span>
            <small>{customerStats?.count || 0} orders{customerStats?.latest ? <> · Latest: <StatusTag status={customerStats.latest.status} /></> : ''}</small>
          </Link>
          <Link className="btn-ghost admin-row-action" href={`/admin/orders/new?customer=${customer.id}`}>New order</Link>
          <DeleteRowButton endpoint={`/api/admin/customers/${customer.id}`} label={`Move ${customer.name || 'this customer'} to bin`} confirmText={`Move ${customer.name || 'this customer'} to the bin? Their past orders are kept. You can restore them later from Admin → Bin.`} />
        </div>;
      })}
    </div>
    <div className="admin-directory-table-wrap" tabIndex={0} role="region" aria-label="Customer directory">
      <table><thead><tr><th>Customer</th><th>Company</th><th>WhatsApp</th><th>Place</th><th>Work stream</th><th>Go-to requirements</th><th>Orders</th><th>Latest status</th><th>Actions</th></tr></thead>
      <tbody>{(customers || []).map((customer: any) => { const customerStats = stats.get(customer.id); return <tr key={customer.id}>
        <td><Link href={`/admin/customers/${customer.id}`} className="admin-table-link">{customer.name || 'Unnamed customer'}</Link></td>
        <td>{customer.company || '—'}</td><td>{customer.phone || '—'}</td><td>{customer.place || '—'}</td><td>{customer.work_stream || '—'}</td><td className="admin-table-wrap-text">{customer.go_to_requirements || '—'}</td>
        <td>{customerStats?.count || 0}</td><td>{customerStats?.latest ? <StatusTag status={customerStats.latest.status} /> : '—'}</td>
        <td style={{ whiteSpace: 'nowrap' }}>
          <Link className="btn-ghost admin-row-action" href={`/admin/orders/new?customer=${customer.id}`}>New order</Link>
          <DeleteRowButton endpoint={`/api/admin/customers/${customer.id}`} label={`Move ${customer.name || 'this customer'} to bin`} confirmText={`Move ${customer.name || 'this customer'} to the bin? Their past orders are kept. You can restore them later from Admin → Bin.`} />
        </td>
      </tr>; })}</tbody></table>
    </div>
  </>;
}
