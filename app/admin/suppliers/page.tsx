import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import SupplierCreateForm from './SupplierCreateForm';
import DebouncedSearchField from '@/components/admin/DebouncedSearchField';
import CategoryFilterField from '@/components/admin/CategoryFilterField';
import CategoryChips from '@/components/admin/CategoryChips';
import BulkImportButton from '@/components/admin/BulkImportButton';

export const dynamic = 'force-dynamic';

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; sort?: string }> }) {
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 80) || '';
  const categoryIds = (params.category || '').split(',').map((v) => v.trim()).filter((v) => /^\d+$/.test(v)).map(Number);
  const safeQ = q.replace(/[,()%]/g, '');
  // Sorting by "best price" only makes sense against one category's rates --
  // across several categories there's no single number to rank suppliers by.
  const singleCategoryId = categoryIds.length === 1 ? categoryIds[0] : null;
  const priceSort = singleCategoryId && (params.sort === 'price_asc' || params.sort === 'price_desc') ? params.sort : null;

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

  const bestPriceBySupplier = new Map<number, number>();
  if (singleCategoryId && suppliers?.length) {
    const { data: rates } = await supabaseAdmin.from('supplier_rates').select('supplier_id,cost_price').eq('category_id', singleCategoryId).in('supplier_id', suppliers.map((s: any) => s.id));
    (rates || []).forEach((rate: any) => {
      const price = Number(rate.cost_price);
      const current = bestPriceBySupplier.get(rate.supplier_id);
      if (current === undefined || price < current) bestPriceBySupplier.set(rate.supplier_id, price);
    });
  }

  let orderedSuppliers = suppliers || [];
  if (priceSort) {
    const withPrice = orderedSuppliers.filter((s: any) => bestPriceBySupplier.has(s.id));
    const withoutPrice = orderedSuppliers.filter((s: any) => !bestPriceBySupplier.has(s.id));
    withPrice.sort((a: any, b: any) => {
      const diff = bestPriceBySupplier.get(a.id)! - bestPriceBySupplier.get(b.id)!;
      return priceSort === 'price_asc' ? diff : -diff;
    });
    orderedSuppliers = [...withPrice, ...withoutPrice];
  }

  const filtersActive = Boolean(q || categoryIds.length);
  const exportParams = new URLSearchParams();
  if (q) exportParams.set('q', q);
  if (categoryIds.length) exportParams.set('category', categoryIds.join(','));

  function sortUrl(sort: 'price_asc' | 'price_desc' | null) {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (categoryIds.length) p.set('category', categoryIds.join(','));
    if (sort) p.set('sort', sort);
    return `/admin/suppliers${p.size ? `?${p}` : ''}`;
  }

  return <>
    <div className="admin-page-head"><div><h1>Suppliers</h1><p>Supplier coverage, contacts and the latest buying rates.</p></div><div style={{ display: 'flex', gap: 8 }}><BulkImportButton entity="suppliers" label="Import from Excel" /><a className="btn-ghost" href={`/api/admin/suppliers/export${exportParams.size ? `?${exportParams}` : ''}`}>Export to Excel</a><SupplierCreateForm categories={allCategories || []} /></div></div>
    <form className="admin-directory-search" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
      <label style={{ flex: '1 1 220px' }}>Search<DebouncedSearchField name="q" defaultValue={q} placeholder="Search name, company or contact" /></label>
      <CategoryFilterField categories={allCategories || []} defaultCategoryIds={categoryIds} />
      {filtersActive && <Link href="/admin/suppliers" style={{ fontSize: 12.5, color: '#756e5c', textDecoration: 'underline', alignSelf: 'center', marginLeft: 'auto' }}>Clear filters</Link>}
    </form>
    {error && <p role="alert">Suppliers could not be loaded. Please refresh.</p>}
    {singleCategoryId && (
      <div className="cat-view-toggle" role="group" aria-label="Sort by price" style={{ marginBottom: 14 }}>
        <Link href={sortUrl('price_asc')} className={priceSort === 'price_asc' ? 'active' : ''} aria-current={priceSort === 'price_asc' ? 'true' : undefined}>↓ Cheapest first</Link>
        <Link href={sortUrl('price_desc')} className={priceSort === 'price_desc' ? 'active' : ''} aria-current={priceSort === 'price_desc' ? 'true' : undefined}>↑ Priciest first</Link>
      </div>
    )}
    <p className="admin-results-summary">{orderedSuppliers.length} suppliers</p>
    <div className="admin-record-grid">{orderedSuppliers.map((supplier: any) => {
      const names = (categoryLinks || []).filter((link: any) => link.supplier_id === supplier.id).map((link: any) => categoryNames.get(link.category_id)).filter(Boolean);
      const bestPrice = bestPriceBySupplier.get(supplier.id);
      return <Link href={`/admin/suppliers/${supplier.id}`} className="card admin-supplier-card" key={supplier.id}>
        <strong>{supplier.name}</strong>
        <span>{supplier.company || 'No company'} · {supplier.contact_name || 'No contact person'} · {supplier.phone || 'No phone'}</span>
        {singleCategoryId && <span style={{ fontWeight: 600, color: bestPrice !== undefined ? 'var(--gold)' : '#756e5c' }}>{bestPrice !== undefined ? `From ₹${bestPrice}` : 'No rate on file'}</span>}
        <CategoryChips names={names} />
      </Link>;
    })}{!orderedSuppliers.length && <p>{filtersActive ? 'No suppliers match this filter.' : 'No suppliers added yet.'}</p>}</div>
  </>;
}
