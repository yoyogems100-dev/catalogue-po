import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import SupplierManager from './SupplierManager';

export const dynamic = 'force-dynamic';

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [{ data: supplier }, { data: categories }, { data: links }, { data: rates }] = await Promise.all([
    supabaseAdmin.from('suppliers').select('*').eq('id', id).maybeSingle(), supabaseAdmin.from('categories').select('id,name').order('num'), supabaseAdmin.from('supplier_categories').select('category_id').eq('supplier_id', id), supabaseAdmin.from('supplier_rates').select('*').eq('supplier_id', id).order('updated_at', { ascending: false }),
  ]);
  if (!supplier) return <p>Supplier not found. <Link href="/admin/suppliers">Back to suppliers</Link></p>;
  const shapeIds = (rates || []).map((rate: any) => rate.shape_id).filter(Boolean), sizeIds = (rates || []).map((rate: any) => rate.shape_size_id).filter(Boolean), colorIds = (rates || []).map((rate: any) => rate.color_id).filter(Boolean);
  const [{ data: shapes }, { data: sizes }, { data: colors }] = await Promise.all([shapeIds.length ? supabaseAdmin.from('shapes').select('id,name').in('id', shapeIds) : Promise.resolve({ data: [] }), sizeIds.length ? supabaseAdmin.from('shape_sizes').select('id,size_mm').in('id', sizeIds) : Promise.resolve({ data: [] }), colorIds.length ? supabaseAdmin.from('colors').select('id,name').in('id', colorIds) : Promise.resolve({ data: [] })]);
  const map = (rows: any[] | null, value: string) => new Map((rows || []).map((row: any) => [row.id, row[value]])); const categoryMap = map(categories, 'name'), shapeMap = map(shapes, 'name'), sizeMap = map(sizes, 'size_mm'), colorMap = map(colors, 'name');
  const formattedRates = (rates || []).map((rate: any) => ({ id: rate.id, categoryId: rate.category_id, categoryName: categoryMap.get(rate.category_id) || '—', shapeName: shapeMap.get(rate.shape_id) || 'All', sizeMm: sizeMap.get(rate.shape_size_id) || 'All', colorName: colorMap.get(rate.color_id) || 'All', costPrice: Number(rate.cost_price), currency: rate.currency, notes: rate.notes }));
  return <><Link className="back-link" href="/admin/suppliers">← All suppliers</Link><h1>{supplier.name}</h1><SupplierManager supplier={supplier} categories={categories || []} linkedCategoryIds={(links || []).map((link: any) => link.category_id)} rates={formattedRates} /></>;
}
