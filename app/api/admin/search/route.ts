import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cleanQuery, type SearchItem } from '@/lib/admin-search';

// The database half of the admin search: customers, suppliers, shapes, sizes,
// colours and orders whose name (or phone, size, order number) matches ?q=.
// Pages and categories are matched in the browser.
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const q = cleanQuery(req.nextUrl.searchParams.get('q') || '');
  const orderNo = q.match(/^#?(\d{1,9})$/)?.[1];
  if (q.length < 2 && !orderNo) return NextResponse.json({ items: [] });
  const like = `%${q}%`;
  const digits = q.replace(/\D/g, '');
  // "oval 6x8": the word with a number is the size, the rest names the shape.
  const words = q.split(' ');
  const sizeWord = words.find((w) => /\d/.test(w))?.replace(/mm$/i, '');
  const shapeWords = words.filter((w) => !/\d/.test(w) && !/^mm$/i.test(w));
  const shapeLike = `%${(sizeWord ? shapeWords : words).join(' ') || q}%`;

  const [customers, suppliers, shapes, colours, sizes, orders] = await Promise.all([
    supabaseAdmin.from('customers').select('id, name, company, phone, place')
      .is('deleted_at', null)
      .or([`name.ilike.${like}`, `company.ilike.${like}`, `place.ilike.${like}`, ...(digits.length >= 4 ? [`phone.ilike.%${digits}%`] : [])].join(','))
      .order('name').limit(8),
    supabaseAdmin.from('suppliers').select('id, name, company, contact_name, phone')
      .is('deleted_at', null)
      .or([`name.ilike.${like}`, `company.ilike.${like}`, `contact_name.ilike.${like}`, ...(digits.length >= 4 ? [`phone.ilike.%${digits}%`] : [])].join(','))
      .order('name').limit(6),
    supabaseAdmin.from('shapes').select('id, name').is('owner_category_id', null).ilike('name', shapeLike).order('sort_order').limit(6),
    supabaseAdmin.from('colors').select('id, name').is('owner_category_id', null).ilike('name', like).order('sort_order').limit(6),
    // "6x8", "2.5"... only worth asking when there is a number in it.
    sizeWord && !orderNo
      ? (() => {
          let sizes = supabaseAdmin.from('shape_sizes').select('id, shape_id, size_mm, shapes!shape_sizes_shape_id_fkey!inner(name, owner_category_id)')
            .ilike('size_mm', `${sizeWord.replace(/[x×]/gi, '%x%')}%`).is('shapes.owner_category_id', null);
          for (const w of shapeWords) sizes = sizes.ilike('shapes.name', `%${w}%`);
          return sizes.limit(8);
        })()
      : Promise.resolve({ data: [] as any[] }),
    orderNo
      ? supabaseAdmin.from('orders').select('id, contact_name, status').eq('id', Number(orderNo)).is('deleted_at', null).limit(1)
      : supabaseAdmin.from('orders').select('id, contact_name, status').ilike('contact_name', like).is('deleted_at', null).order('id', { ascending: false }).limit(5)
  ]);

  const items: SearchItem[] = [
    ...(orders.data || []).map((o: any) => ({ kind: 'order' as const, label: `Order #${o.id}`, detail: [o.contact_name, o.status].filter(Boolean).join(' · '), href: `/admin/orders/${o.id}` })),
    ...(customers.data || []).map((c: any) => ({ kind: 'customer' as const, label: c.name || c.company || c.phone || `Customer ${c.id}`, detail: [c.name ? c.company : null, c.place, c.phone].filter(Boolean).join(' · '), href: `/admin/customers/${c.id}`, keywords: `${c.company || ''} ${c.place || ''} ${c.phone || ''}` })),
    ...(suppliers.data || []).map((s: any) => ({ kind: 'supplier' as const, label: s.name || s.company || `Supplier ${s.id}`, detail: [s.company !== s.name ? s.company : null, s.contact_name, s.phone].filter(Boolean).join(' · '), href: `/admin/suppliers/${s.id}`, keywords: `${s.company || ''} ${s.contact_name || ''} ${s.phone || ''}` })),
    ...(shapes.data || []).map((s: any) => ({ kind: 'shape' as const, label: s.name, detail: 'Shapes & sizes', href: `/admin/shapes?q=${encodeURIComponent(s.name)}&open=${s.id}` })),
    ...(sizes.data || []).map((s: any) => ({ kind: 'size' as const, label: `${s.size_mm} mm`, detail: s.shapes?.name, href: `/admin/shapes?q=${encodeURIComponent(s.shapes?.name || '')}&open=${s.shape_id}`, keywords: `${s.size_mm} ${s.shapes?.name || ''}` })),
    ...(colours.data || []).map((c: any) => ({ kind: 'colour' as const, label: c.name, detail: 'Colours', href: `/admin/colors?q=${encodeURIComponent(c.name)}` }))
  ];
  return NextResponse.json({ items });
}
