import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import SupplierCreateForm from './SupplierCreateForm';

export const dynamic = 'force-dynamic';

export default async function SuppliersPage() {
  const [{ data: suppliers }, { data: categoryLinks }, { data: categories }] = await Promise.all([
    supabaseAdmin.from('suppliers').select('*').order('name'),
    supabaseAdmin.from('supplier_categories').select('supplier_id,category_id'),
    supabaseAdmin.from('categories').select('id,name'),
  ]);
  const categoryNames = new Map((categories || []).map((category: any) => [category.id, category.name]));
  return <>
    <div className="admin-page-head"><div><h1>Suppliers</h1><p>Supplier coverage, contacts and the latest buying rates.</p></div><SupplierCreateForm /></div>
    <div className="admin-record-grid">{(suppliers || []).map((supplier: any) => {
      const names = (categoryLinks || []).filter((link: any) => link.supplier_id === supplier.id).map((link: any) => categoryNames.get(link.category_id)).filter(Boolean);
      return <Link href={`/admin/suppliers/${supplier.id}`} className="card admin-supplier-card" key={supplier.id}><strong>{supplier.name}</strong><span>{supplier.contact_name || 'No contact person'} · {supplier.phone || 'No phone'}</span><small>{names.length ? names.slice(0, 4).join(' · ') : 'No categories linked'}{names.length > 4 ? ` +${names.length - 4}` : ''}</small></Link>;
    })}{!suppliers?.length && <p>No suppliers added yet.</p>}</div>
  </>;
}
