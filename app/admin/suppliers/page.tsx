import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import SupplierCreateForm from './SupplierCreateForm';
import DebouncedSearchField from '@/components/admin/DebouncedSearchField';
import CategoryFilterField from '@/components/admin/CategoryFilterField';
import CategoryChips from '@/components/admin/CategoryChips';

export const dynamic = 'force-dynamic';

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 80) || '';
  const categoryIds = (params.category || '').split(',').map((v) => v.trim()).filter((v) => /^\d+$/.test(v)).map(Number);
  const safeQ = q.replace(/[,()%]/g, '');

  const [{ data: allCategories }, { data: categoryLinks }] = await Promise.all([
    supabaseAdmin.from('categories').select('id,name').order('num'),
    supabaseAdmin.from('supplier_categories').select('supplier_id,category_id'),
  ]);
  const categoryNames = new Map((allCategories || []).map((category: any) => [category.id, category.name]));

  let supplierQuery = supabaseAdmin.from('suppliers').select('*').order('name');
  if (safeQ) supplierQuery = supplierQuery.or(`name.ilike.%${safeQ}%,company.ilike.%${safeQ}%,contact_name.ilike.%${safeQ}%`);
  if (categoryIds.length) {
    const matchingSupplierIds = [...new Set((categoryLinks || []).filter((link: any) => categoryIds.includes(link.category_id)).map((link: any) => link.supplier_id))];
    supplierQuery = supplierQuery.in('id', matchingSupplierIds.length ? matchingSupplierIds : [-1]);
  }
  const { data: suppliers, error } = await supplierQuery;
  const filtersActive = Boolean(q || categoryIds.length);

  return <>
    <div className="admin-page-head"><div><h1>Suppliers</h1><p>Supplier coverage, contacts and the latest buying rates.</p></div><SupplierCreateForm categories={allCategories || []} /></div>
    <form className="admin-directory-search" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
      <label style={{ flex: '1 1 220px' }}>Search<DebouncedSearchField name="q" defaultValue={q} placeholder="Search name, company or contact" /></label>
      <CategoryFilterField categories={allCategories || []} defaultCategoryIds={categoryIds} />
      {filtersActive && <Link href="/admin/suppliers" style={{ fontSize: 12.5, color: '#756e5c', textDecoration: 'underline', alignSelf: 'center', marginLeft: 'auto' }}>Clear filters</Link>}
    </form>
    {error && <p role="alert">Suppliers could not be loaded. Please refresh.</p>}
    <p className="admin-results-summary">{(suppliers || []).length} suppliers</p>
    <div className="admin-record-grid">{(suppliers || []).map((supplier: any) => {
      const names = (categoryLinks || []).filter((link: any) => link.supplier_id === supplier.id).map((link: any) => categoryNames.get(link.category_id)).filter(Boolean);
      return <Link href={`/admin/suppliers/${supplier.id}`} className="card admin-supplier-card" key={supplier.id}>
        <strong>{supplier.name}</strong>
        <span>{supplier.company || 'No company'} · {supplier.contact_name || 'No contact person'} · {supplier.phone || 'No phone'}</span>
        <CategoryChips names={names} />
      </Link>;
    })}{!suppliers?.length && <p>{filtersActive ? 'No suppliers match this filter.' : 'No suppliers added yet.'}</p>}</div>
  </>;
}
