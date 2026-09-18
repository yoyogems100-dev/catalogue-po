import { supabaseAdmin } from '@/lib/supabase-admin';
import BinRowActions from './BinRowActions';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
}

export default async function AdminBinPage() {
  const [{ data: orders }, { data: customers }, { data: suppliers }] = await Promise.all([
    supabaseAdmin.from('orders').select('id, contact_name, status, deleted_at, customer_id').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    supabaseAdmin.from('customers').select('id, name, company, phone, deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    supabaseAdmin.from('suppliers').select('id, name, company, deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false })
  ]);

  const customerIds = [...new Set((orders || []).map((o: any) => o.customer_id).filter(Boolean))];
  const { data: orderCustomers } = customerIds.length
    ? await supabaseAdmin.from('customers').select('id, name, company').in('id', customerIds)
    : { data: [] };
  const custMap: Record<number, any> = Object.fromEntries((orderCustomers || []).map((c: any) => [c.id, c]));

  return (
    <>
      <h1>Bin</h1>
      <p style={{ color: '#756e5c', fontSize: 13, marginBottom: 20 }}>
        Orders, customers and suppliers deleted from their list land here first. Restore a row to bring it back, or delete it permanently -- that cannot be undone.
      </p>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Orders ({(orders || []).length})</h2>
        {(orders || []).length === 0 ? <p style={{ fontSize: 13, color: '#756e5c' }}>Nothing in the bin.</p> : (
          <table>
            <thead><tr><th>#</th><th>Customer</th><th>Status</th><th>Deleted</th><th></th></tr></thead>
            <tbody>
              {(orders || []).map((o: any) => {
                const cust = custMap[o.customer_id];
                return (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>{cust ? (cust.name || cust.company) : (o.contact_name || '—')}</td>
                    <td>{o.status}</td>
                    <td>{fmt(o.deleted_at)}</td>
                    <td><BinRowActions type="orders" id={o.id} label={`order #${o.id}`} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Customers ({(customers || []).length})</h2>
        {(customers || []).length === 0 ? <p style={{ fontSize: 13, color: '#756e5c' }}>Nothing in the bin.</p> : (
          <table>
            <thead><tr><th>Name</th><th>Company</th><th>WhatsApp</th><th>Deleted</th><th></th></tr></thead>
            <tbody>
              {(customers || []).map((c: any) => (
                <tr key={c.id}>
                  <td>{c.name || 'Unnamed customer'}</td>
                  <td>{c.company || '—'}</td>
                  <td>{c.phone || '—'}</td>
                  <td>{fmt(c.deleted_at)}</td>
                  <td><BinRowActions type="customers" id={c.id} label={c.name || 'this customer'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 15, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Suppliers ({(suppliers || []).length})</h2>
        {(suppliers || []).length === 0 ? <p style={{ fontSize: 13, color: '#756e5c' }}>Nothing in the bin.</p> : (
          <table>
            <thead><tr><th>Name</th><th>Company</th><th>Deleted</th><th></th></tr></thead>
            <tbody>
              {(suppliers || []).map((s: any) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.company || '—'}</td>
                  <td>{fmt(s.deleted_at)}</td>
                  <td><BinRowActions type="suppliers" id={s.id} label={s.name} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
