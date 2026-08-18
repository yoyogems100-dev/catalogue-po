import { supabaseAdmin } from '@/lib/supabase-admin';
import Link from 'next/link';
import AdminOrderBuilder from './AdminOrderBuilder';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

export default async function NewAdminOrderPage() {
  const [{ data: categories }, { data: customers }] = await Promise.all([
    supabaseAdmin.from('categories').select('id, num, name').order('num'),
    supabaseAdmin.from('customers').select('id, name, phone, company').order('name')
  ]);

  return (
    <>
      <Link href="/admin/orders" style={{ fontSize: 13, color: 'var(--navy)' }}>&larr; All orders</Link>
      <h1 style={{ marginTop: 8 }}>New order (offline / phone request)</h1>
      <p style={{ fontSize: 13, color: '#8a8370', marginBottom: 20 }}>
        Build a purchase order on a customer's behalf -- for orders taken by phone, WhatsApp, or in person.
      </p>
      <AdminOrderBuilder
        allCategories={(categories || []).map((c: any) => ({ id: c.id, num: c.num, name: c.name }))}
        allCustomers={(customers || []).map((c: any) => ({ id: c.id, name: c.name, phone: c.phone, company: c.company }))}
      />
    </>
  );
}
