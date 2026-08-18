import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';
import AccountHeader from '@/components/AccountHeader';
import { milestoneLabel } from '@/lib/order-milestones';
import { getSettings } from '@/lib/settings';
import QuickOrderClient from './QuickOrderClient';

export default async function QuickOrderPage() {
  const customerId = getCustomerId();
  if (!customerId) redirect('/account/login');

  const [{ data: orders }, { data: categories }] = await Promise.all([
    supabaseAdmin
      .from('orders')
      .select('id, status, created_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('categories').select('id, num, name, slug').order('num')
  ]);

  const orderIds = (orders || []).map((o) => o.id);
  const { data: items } = orderIds.length
    ? await supabaseAdmin
        .from('order_items')
        .select('order_id, category_id, shape_id, shape_size_id, custom_size, color_id, quantity, request_type')
        .in('order_id', orderIds)
    : { data: [] };

  const categoryIds = [...new Set((items || []).map((i: any) => i.category_id).filter(Boolean))];
  const shapeIds = [...new Set((items || []).map((i: any) => i.shape_id).filter(Boolean))];
  const sizeIds = [...new Set((items || []).map((i: any) => i.shape_size_id).filter(Boolean))];
  const colorIds = [...new Set((items || []).map((i: any) => i.color_id).filter(Boolean))];

  const [{ data: catRows }, { data: shapesData }, { data: sizesData }, { data: colorsData }] = await Promise.all([
    categoryIds.length ? supabaseAdmin.from('categories').select('id, name, slug').in('id', categoryIds) : Promise.resolve({ data: [] }),
    shapeIds.length ? supabaseAdmin.from('shapes').select('id, name').in('id', shapeIds) : Promise.resolve({ data: [] }),
    sizeIds.length ? supabaseAdmin.from('shape_sizes').select('id, size_mm').in('id', sizeIds) : Promise.resolve({ data: [] }),
    colorIds.length ? supabaseAdmin.from('colors').select('id, name, hex_value').in('id', colorIds) : Promise.resolve({ data: [] })
  ]);

  const catMap: Record<number, { name: string; slug: string }> = Object.fromEntries(
    (catRows || []).map((c: any) => [c.id, { name: c.name, slug: c.slug }])
  );
  const shapeMap: Record<number, string> = Object.fromEntries((shapesData || []).map((s: any) => [s.id, s.name]));
  const sizeMap: Record<number, string> = Object.fromEntries((sizesData || []).map((s: any) => [s.id, s.size_mm]));
  const colorMap: Record<number, { name: string; hex: string | null }> = Object.fromEntries(
    (colorsData || []).map((c: any) => [c.id, { name: c.name, hex: c.hex_value }])
  );

  const itemsFormatted = (items || []).map((it: any) => ({
    orderId: it.order_id,
    categoryId: it.category_id,
    categoryName: catMap[it.category_id]?.name || '—',
    shapeId: it.shape_id,
    shapeName: shapeMap[it.shape_id] || '—',
    sizeId: it.shape_size_id,
    sizeMm: sizeMap[it.shape_size_id] || it.custom_size || '—',
    colorId: it.color_id,
    colorName: colorMap[it.color_id]?.name || '—',
    colorHex: colorMap[it.color_id]?.hex || '#ccc',
    quantity: it.quantity,
    requestType: it.request_type || 'Place Order'
  }));

  // "Your Usual" -- rank every distinct shape+color+size(+category) combo this
  // customer has ever ordered by how many times it shows up, most-frequent
  // first. Ties broken by total quantity ordered (a combo ordered twice at
  // high volume beats one ordered twice at token volume).
  const comboKey = (i: (typeof itemsFormatted)[number]) => `${i.categoryId}|${i.shapeId}|${i.sizeId ?? i.sizeMm}|${i.colorId}`;
  const comboStats = new Map<string, { item: (typeof itemsFormatted)[number]; count: number; totalQty: number }>();
  itemsFormatted.forEach((i) => {
    const key = comboKey(i);
    const existing = comboStats.get(key);
    if (existing) {
      existing.count += 1;
      existing.totalQty += i.quantity;
    } else {
      comboStats.set(key, { item: i, count: 1, totalQty: i.quantity });
    }
  });
  const frequentCombos = [...comboStats.values()]
    .sort((a, b) => b.count - a.count || b.totalQty - a.totalQty)
    .slice(0, 6)
    .map((s) => ({ ...s.item, quantity: s.item.quantity })); // use the combo's own last-seen qty as the suggested default

  // Past orders list for the "repeat a specific order" picker, each carrying
  // its own full item list so picking one doesn't need another round trip.
  const pastOrders = (orders || []).map((o: any) => {
    const orderItems = itemsFormatted.filter((i) => i.orderId === o.id);
    const categoryNames = [...new Set(orderItems.map((i) => i.categoryName))];
    return {
      id: o.id,
      statusLabel: milestoneLabel(o.status),
      createdAt: o.created_at,
      categoryNames,
      totalPieces: orderItems.reduce((sum, i) => sum + i.quantity, 0),
      items: orderItems
    };
  });

  const categoryOptions = (categories || []).map((c: any) => ({ id: c.id, name: c.name, slug: c.slug }));
  const settings = await getSettings();

  return (
    <>
      <AccountHeader />
      <div className="container" style={{ padding: '28px 20px 80px' }}>
        <nav className="breadcrumb-nav">
          <Link href="/">&#127968; Home</Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Quick Order</span>
        </nav>
        <h1 style={{ fontSize: 26, color: 'var(--ink)', margin: '0 0 6px' }}>Quick Order</h1>
        <p style={{ fontSize: 13, color: '#8a8370', marginBottom: 20 }}>
          Reorder your usual, repeat a past order, or build a fresh one without browsing category by category.
        </p>

        <QuickOrderClient
          frequentCombos={frequentCombos}
          pastOrders={pastOrders}
          categories={categoryOptions}
          whatsappNumber={settings.whatsapp_number || undefined}
        />
      </div>
    </>
  );
}
