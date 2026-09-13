import { supabaseAdmin } from '@/lib/supabase-admin';
import Link from 'next/link';
import AdminOrderBuilder from './AdminOrderBuilder';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

export default async function NewAdminOrderPage({ searchParams }: { searchParams: Promise<{ customer?: string; from?: string }> }) {
  const params = await searchParams;
  const initialCustomerId = Number(params.customer) || null;
  const fromOrderId = Number(params.from) || null;
  const [{ data: categories }, { data: customers }] = await Promise.all([
    supabaseAdmin.from('categories').select('id, num, name').order('num'),
    supabaseAdmin.from('customers').select('id, name, phone, company').order('name')
  ]);
  let repeatItems: any[] = [];
  let initialRequestType = 'Place Order';
  if (initialCustomerId && fromOrderId) {
    const { data: source } = await supabaseAdmin.from('orders').select('id,customer_id,request_type').eq('id', fromOrderId).eq('customer_id', initialCustomerId).maybeSingle();
    if (source) {
      initialRequestType = source.request_type === 'Request Quotation' ? 'Request Quotation' : 'Place Order';
      const { data: rows } = await supabaseAdmin.from('order_items').select('*').eq('order_id', fromOrderId);
      const categoryIds = [...new Set((rows || []).map((row: any) => row.category_id))], shapeIds = [...new Set((rows || []).map((row: any) => row.shape_id))], sizeIds = [...new Set((rows || []).map((row: any) => row.shape_size_id).filter(Boolean))], colorIds = [...new Set((rows || []).map((row: any) => row.color_id).filter(Boolean))];
      const [{ data: rowCategories }, { data: shapes }, { data: sizes }, { data: colors }] = await Promise.all([supabaseAdmin.from('categories').select('id,name').in('id', categoryIds), supabaseAdmin.from('shapes').select('id,name').in('id', shapeIds), sizeIds.length ? supabaseAdmin.from('shape_sizes').select('id,size_mm').in('id', sizeIds) : Promise.resolve({ data: [] }), colorIds.length ? supabaseAdmin.from('colors').select('id,name').in('id', colorIds) : Promise.resolve({ data: [] })]);
      const names = (list: any[] | null, field: string) => new Map((list || []).map((row: any) => [row.id, row[field]])); const categoryNames = names(rowCategories, 'name'), shapeNames = names(shapes, 'name'), sizeNames = names(sizes, 'size_mm'), colorNames = names(colors, 'name');
      repeatItems = (rows || []).map((row: any) => ({ id: `repeat-${row.id}`, categoryId: row.category_id, categoryName: categoryNames.get(row.category_id) || 'Category', shapeId: row.shape_id, shapeName: shapeNames.get(row.shape_id) || 'Shape', sizeId: row.shape_size_id, sizeMm: sizeNames.get(row.shape_size_id) || row.custom_size || 'Custom', colorId: row.color_id, colorName: colorNames.get(row.color_id) || 'Custom', qty: row.quantity, orderSpecs: row.order_specs || undefined }));
    }
  }

  return (
    <>
      <Link href="/admin/orders" className="back-link">&larr; All orders</Link>
      <h1 style={{ marginTop: 8 }}>New order (offline / phone request)</h1>
      <p style={{ fontSize: 13, color: '#756e5c', marginBottom: 20 }}>
        Build a purchase order on a customer's behalf -- for orders taken by phone, WhatsApp, or in person.
      </p>
      <AdminOrderBuilder
        allCategories={(categories || []).map((c: any) => ({ id: c.id, num: c.num, name: c.name }))}
        allCustomers={(customers || []).map((c: any) => ({ id: c.id, name: c.name, phone: c.phone, company: c.company }))}
        initialCustomerId={initialCustomerId}
        repeatItems={repeatItems}
        initialRequestType={initialRequestType}
      />
    </>
  );
}
