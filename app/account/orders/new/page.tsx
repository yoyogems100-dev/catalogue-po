import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';
import AccountHeader from '@/components/AccountHeader';
import { getSettings } from '@/lib/settings';
import NewOrderClient from './NewOrderClient';

export default async function NewOrderPage({ searchParams }: { searchParams: { from?: string } }) {
  const customerId = getCustomerId();
  if (!customerId) redirect('/account/login');

  const fromOrderId = searchParams.from ? Number(searchParams.from) : null;

  let seedItems: any[] = [];
  if (fromOrderId) {
    const { data: order } = await supabaseAdmin.from('orders').select('id, customer_id').eq('id', fromOrderId).single();
    if (order && order.customer_id === customerId) {
      const { data: items } = await supabaseAdmin
        .from('order_items')
        .select('category_id, shape_id, shape_size_id, custom_size, color_id, quantity, request_type')
        .eq('order_id', fromOrderId);

      const categoryIds = [...new Set((items || []).map((i: any) => i.category_id).filter(Boolean))];
      const shapeIds = [...new Set((items || []).map((i: any) => i.shape_id).filter(Boolean))];
      const sizeIds = [...new Set((items || []).map((i: any) => i.shape_size_id).filter(Boolean))];
      const colorIds = [...new Set((items || []).map((i: any) => i.color_id).filter(Boolean))];

      const [{ data: cats }, { data: shapesData }, { data: sizesData }, { data: colorsData }] = await Promise.all([
        categoryIds.length ? supabaseAdmin.from('categories').select('id, name').in('id', categoryIds) : Promise.resolve({ data: [] }),
        shapeIds.length ? supabaseAdmin.from('shapes').select('id, name').in('id', shapeIds) : Promise.resolve({ data: [] }),
        sizeIds.length ? supabaseAdmin.from('shape_sizes').select('id, size_mm').in('id', sizeIds) : Promise.resolve({ data: [] }),
        colorIds.length ? supabaseAdmin.from('colors').select('id, name, hex_value, ref_photo_url').in('id', colorIds) : Promise.resolve({ data: [] })
      ]);

      const catMap: Record<number, string> = Object.fromEntries((cats || []).map((c: any) => [c.id, c.name]));
      const shapeMap: Record<number, string> = Object.fromEntries((shapesData || []).map((s: any) => [s.id, s.name]));
      const sizeMap: Record<number, string> = Object.fromEntries((sizesData || []).map((s: any) => [s.id, s.size_mm]));
      const colorMap: Record<number, { name: string; hex: string | null; refPhotoUrl: string | null }> = Object.fromEntries(
        (colorsData || []).map((c: any) => [c.id, { name: c.name, hex: c.hex_value, refPhotoUrl: c.ref_photo_url }])
      );

      seedItems = (items || []).map((it: any, i: number) => ({
        id: `seed-${i}-${Date.now()}`,
        categoryId: it.category_id,
        categoryName: catMap[it.category_id] || '—',
        shapeId: it.shape_id,
        shapeName: shapeMap[it.shape_id] || '—',
        sizeId: it.shape_size_id,
        sizeMm: sizeMap[it.shape_size_id] || it.custom_size || '—',
        colorId: it.color_id,
        colorName: colorMap[it.color_id]?.name || '—',
        colorHex: colorMap[it.color_id]?.hex || '#ccc',
        colorRefPhotoUrl: colorMap[it.color_id]?.refPhotoUrl || null,
        qty: it.quantity,
        requestType: it.request_type || 'Place Order'
      }));
    }
  }

  const { data: categoriesRaw } = await supabaseAdmin.from('categories').select('id, name, slug').order('num');
  const allCategories = (categoriesRaw || []).map((c: any) => ({ id: c.id, name: c.name, slug: c.slug }));

  const settings = await getSettings();

  return (
    <>
      <AccountHeader />
      <div className="container" style={{ padding: '28px 20px 80px' }}>
        <nav className="breadcrumb-nav">
          <Link href="/">&#127968; Home</Link>
          <span className="breadcrumb-sep">/</span>
          <Link href="/account/orders">My Orders</Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">{fromOrderId ? `Reorder from #${fromOrderId}` : 'New Order'}</span>
        </nav>
        <h1 style={{ fontSize: 26, color: 'var(--ink)', margin: '0 0 6px' }}>
          {fromOrderId ? `Reorder from Order #${fromOrderId}` : 'New Order'}
        </h1>
        <p style={{ fontSize: 13, color: '#8a8370', marginBottom: 20 }}>
          {fromOrderId
            ? 'Pre-filled from that order -- edit quantities, remove lines, or add more before sending.'
            : 'Build a fresh order across any category.'}
        </p>

        <NewOrderClient seedItems={seedItems} allCategories={allCategories} whatsappNumber={settings.whatsapp_number || undefined} />
      </div>
    </>
  );
}
