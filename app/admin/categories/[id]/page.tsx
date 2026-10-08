import CategoryColorChart from '@/components/admin/CategoryColorChart';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { photoUrl } from '@/lib/photos';
import RainbowStripOptions from '@/components/admin/RainbowStripOptions';
import CategoryTagBar from '@/components/admin/CategoryTagBar';
import CategoryAdminClient from './CategoryAdminClient';
import CategoryArchiveToggle from '@/components/admin/CategoryArchiveToggle';
import Link from 'next/link';
import { ColorsWorkspace } from '../../colors/ColorsWorkspace';
import PricingClient from '../../pricing/PricingClient';
import ShapeReferenceManager from '@/components/admin/ShapeReferenceManager';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import CategoryMaterialsManager from '@/components/admin/CategoryMaterialsManager';
import { parseExploreFilter } from '@/lib/explore-filter';
import { CATALOGUE_PRICES_ENABLED } from '@/lib/pricing-calc';

// See app/admin/categories/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

export default async function CategoryAdminPage({ params: paramsPromise, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const params = await paramsPromise;
  const categoryId = Number(params.id);
  // Eight tabs collapsed to five. Overview was a signpost plus a count list,
  // so the counts are now a strip visible on every tab and the tab is gone;
  // Color chart belongs with Colors, and Specifications with Shapes & sizes,
  // rather than each being a tab of one control. Photos leads, because that is
  // what the team opens a category to do.
  const LEGACY_TABS: Record<string, string> = {
    overview: 'photos',
    'color-chart': 'colors',
    specifications: 'shapes'
  };
  const raw = (await searchParams).tab || '';
  // A category with its own field name (Semi Precious Beads: "Material")
  // keeps its shapes, sizes and materials on one Materials tab instead of the
  // shared Shapes & sizes and Colors tabs.
  const { data: head } = await supabaseAdmin.from('categories').select('option_label').eq('id', categoryId).maybeSingle();
  const optionLabel: string | null = head?.option_label ?? null;
  const TABS = (optionLabel
    ? ['photos','materials','pricing','suppliers']
    : ['photos','shapes','colors','pricing','suppliers',...(categoryId===29?['strip-counts']:[])])
    .filter((t) => CATALOGUE_PRICES_ENABLED || t !== 'pricing');
  const tab = TABS.includes(raw) ? raw : (optionLabel && ['shapes','colors','color-chart','specifications'].includes(raw) ? 'materials' : (LEGACY_TABS[raw] || 'photos'));

  // Only the "Shapes & sizes" tab needs the full, catalogue-wide shape/size
  // lists (to offer shapes/sizes that aren't linked to this category yet) --
  // shape_sizes alone is 2000+ rows, paged in from Supabase's 1000-row cap.
  // Every other tab only ever needs what's already linked to this one
  // category, which is a cheap, category-scoped join. Previously this whole
  // page fetched the catalogue-wide lists unconditionally on every single
  // tab click, which is what made switching tabs slow.
  const needsFullShapeSizeCatalogue = tab === 'shapes';
  // The "move to category" picker on the Photos tab is the only thing that
  // needs every other category's name -- skip it everywhere else.
  const needsCategoryList = tab === 'photos';

  const [
    { data: category },
    { data: allShapes },
    { data: allTags },
    { data: linkedShapesRaw },
    { data: linkedColorsRaw },
    { data: linkedTagsRaw },
    { data: linkedSizesRaw },
    fullSizesResult,
    { data: otherCategoriesRaw }
  ] = await Promise.all([
    supabaseAdmin.from('categories').select('id, num, name, slug, thumbnail_photo_id, badge_types, color_chart_url, archived_at, explore_default_filter').eq('id', categoryId).single(),
    // Shared shapes, plus this category's own -- never another category's.
    supabaseAdmin.from('shapes').select('id, name, icon_key, ref_photo_url').or(`owner_category_id.is.null,owner_category_id.eq.${categoryId}`).order('sort_order').order('name'),
    supabaseAdmin.from('tags').select('id, name, is_global').order('name'),
    // drill (Hole Punched holes) arrived with a migration; until it's applied
    // the shapes still list, just without saved holes.
    supabaseAdmin.from('category_shapes').select('shape_id, ref_photo_url, drill, shapes(id, name, icon_key, ref_photo_url, owner_category_id, sort_order)').eq('category_id', categoryId)
      .then((r) => (r.error?.code === '42703'
        ? supabaseAdmin.from('category_shapes').select('shape_id, ref_photo_url, shapes(id, name, icon_key, ref_photo_url, owner_category_id, sort_order)').eq('category_id', categoryId) as unknown as typeof r
        : r)),
    supabaseAdmin.from('category_colors').select('color_id, colors(id, name, hex_value, ref_photo_url, owner_category_id, sort_order)').eq('category_id', categoryId),
    supabaseAdmin.from('category_tags').select('tag_id, tags(id, name, is_global)').eq('category_id', categoryId),
    supabaseAdmin.from('category_shape_sizes').select('shape_size_id, shape_sizes(id, shape_id, size_mm, weight_ct)').eq('category_id', categoryId),
    needsFullShapeSizeCatalogue
      ? fetchAllRows<{ id: number; shape_id: number; size_mm: string; weight_ct: number | null }>((from, to) =>
          supabaseAdmin.from('shape_sizes').select('id, shape_id, size_mm, weight_ct', { count: 'exact' }).range(from, to)
        )
      : Promise.resolve({ data: [] as { id: number; shape_id: number; size_mm: string; weight_ct: number | null }[], error: null }),
    needsCategoryList
      ? supabaseAdmin.from('categories').select('id, name, slug').neq('id', categoryId).order('num')
      : Promise.resolve({ data: [] as { id: number; name: string; slug: string | null }[], error: null })
  ]);
  const allSizes = fullSizesResult.data || [];
  const otherCategories = otherCategoriesRaw || [];

  if (!category) {
    return <p>Category not found. <Link href="/admin/categories">&larr; Back</Link></p>;
  }

  const linkedShapes = (linkedShapesRaw || []).map((r: any) => r.shapes).filter(Boolean);
  const linkedColors = (linkedColorsRaw || []).map((r: any) => r.colors).filter(Boolean);
  const linkedTags = (linkedTagsRaw || []).map((r: any) => r.tags).filter(Boolean);
  const linkedSizes = (linkedSizesRaw || []).map((r: any) => r.shape_sizes).filter(Boolean);
  const linkedShapeIds = linkedShapes.map((s: any) => s.id);
  const linkedColorIds = linkedColors.map((c: any) => c.id);
  const linkedTagIds = linkedTags.map((t: any) => t.id);
  const linkedSizeIds = linkedSizes.map((sz: any) => sz.id);

  let materialsPanel: React.ReactNode = null;
  if (tab === 'materials') {
    const { data: availability } = await fetchAllRows<{ shape_size_id: number; color_id: number }>((from, to) =>
      supabaseAdmin.from('category_size_colors').select('shape_size_id, color_id', { count: 'exact' }).eq('category_id', categoryId).range(from, to));
    const bySort = (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name);
    const shapeRows = (linkedShapesRaw || []).filter((r: any) => r.shapes).sort((a: any, b: any) => bySort(a.shapes, b.shapes));
    const shapeOrder = new Map(shapeRows.map((r: any, i: number) => [r.shapes.id, i]));
    materialsPanel = <CategoryMaterialsManager
      key={categoryId}
      categoryId={categoryId}
      label={optionLabel || 'Color'}
      shapes={shapeRows.map((r: any) => ({ id: r.shapes.id, name: r.shapes.name, iconKey: r.shapes.icon_key, refPhotoUrl: r.ref_photo_url || r.shapes.ref_photo_url || null, owned: r.shapes.owner_category_id === categoryId }))}
      sizes={linkedSizes
        .map((sz: any) => ({ id: sz.id, shapeId: sz.shape_id, sizeMm: sz.size_mm }))
        .sort((a: any, b: any) => (shapeOrder.get(a.shapeId) ?? 0) - (shapeOrder.get(b.shapeId) ?? 0) || parseFloat(a.sizeMm) - parseFloat(b.sizeMm) || a.sizeMm.localeCompare(b.sizeMm))}
      materials={linkedColors.slice().sort(bySort).map((c: any) => ({ id: c.id, name: c.name, refPhotoUrl: c.ref_photo_url }))}
      availability={(availability || []).map((r) => [r.shape_size_id, r.color_id] as [number, number])}
    />;
  }

  let categorySuppliers: any[] = [];
  if (tab === 'suppliers') {
    const { data: supplierLinks } = await supabaseAdmin.from('supplier_categories').select('supplier_id').eq('category_id', categoryId);
    const ids = (supplierLinks || []).map((link: any) => link.supplier_id);
    if (ids.length) {
      const { data } = await supabaseAdmin.from('suppliers').select('id,name,contact_name,phone').in('id', ids).order('name');
      categorySuppliers = data || [];
    }
  }

  // Photos (with their per-photo tag/shape/size/color joins) are only
  // needed on the Photos tab -- fetching and formatting every photo on every
  // other tab was pure waste.
  let photosFormatted: any[] = [];
  if (tab === 'photos') {
    const { data: photos } = await supabaseAdmin
      .from('photos')
      .select('*, photo_tags(tag_id), photo_shapes(shape_id), photo_sizes(shape_size_id), photo_colors(color_id)')
      .eq('category_id', categoryId)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
    photosFormatted = (photos || []).map((p: any) => ({
      id: p.id,
      url: photoUrl(p, 400),
      coverUrl: photoUrl(p, 400, 'cover'),
      photoCrop: p.photo_crop || null,
      coverCrop: p.cover_crop || null,
      shapeIds: (p.photo_shapes || []).map((r: any) => r.shape_id),
      sizeIds: (p.photo_sizes || []).map((r: any) => r.shape_size_id),
      colorIds: (p.photo_colors || []).map((r: any) => r.color_id),
      product_code: p.product_code,
      notes: p.notes,
      tag_ids: (p.photo_tags || []).map((t: any) => t.tag_id),
      // Set when this photo is another angle of a grouped stone: the lead
      // carries the tags and is the cover the catalogue shows.
      parentPhotoId: p.parent_photo_id ?? null,
      isCoverOnly: p.is_cover_only
    }));
  }

  return (
    <>
      <Link href="/admin/categories" className="back-link">&larr; All categories</Link>
      <h1 style={{ marginTop: 8 }}>{String(category.num).padStart(2, '0')} — {category.name}{category.archived_at && <span className="admin-archived-pill">Archived</span>}</h1>
      {category.archived_at && <CategoryArchiveToggle id={category.id} name={category.name} archivedAt={category.archived_at} />}
      <div className="category-downloads">
        {CATALOGUE_PRICES_ENABLED && <a className="btn-ghost size-chart-download" href={`/api/admin/pricing/pdf?category_id=${categoryId}`}>Download price list</a>}
        {!category.archived_at && <a className="btn-ghost size-chart-download" href={`/api/categories/${categoryId}/size-chart`}>Download shape &amp; size chart</a>}
        {!category.archived_at && <CategoryArchiveToggle id={category.id} name={category.name} archivedAt={null} />}
      </div>
      <nav className="admin-coverage-filters" aria-label="Category workspace">
        {TABS.map(key => <Link key={key} className={`tag-chip ${tab === key ? 'active' : ''}`} href={`/admin/categories/${categoryId}?tab=${key}`} aria-current={tab === key ? 'page' : undefined}>{key === 'strip-counts' ? 'Strip counts' : key === 'materials' ? `${optionLabel || 'Material'}s` : key === 'shapes' ? 'Shapes & sizes' : key[0].toUpperCase() + key.slice(1)}</Link>)}
        {!category.archived_at && <Link href={`/po/category/${category.slug}`} target="_blank">View public category ↗</Link>}
      </nav>
      <CategoryTagBar categoryId={categoryId} tags={linkedTags.map((t: any) => ({ id: t.id, name: t.name }))} allTags={(allTags || []).map((t: any) => ({ id: t.id, name: t.name }))} />
      {tab === 'materials' ? materialsPanel : tab === 'strip-counts' ? <RainbowStripOptions sizes={linkedSizes.filter((size: any) => linkedSizeIds.includes(size.id)).map((size: any) => ({id:size.id,label:`${linkedShapes.find((shape: any) => shape.id === size.shape_id)?.name||'Shape'} · ${size.size_mm} mm`}))} /> : tab === 'colors' ? <><CategoryColorChart key={categoryId} categoryId={categoryId} categoryName={category.name} initialUrl={category.color_chart_url} /><ColorsWorkspace initialCategoryId={categoryId} embedded /></> : tab === 'pricing' ? <PricingClient key={categoryId} categories={[{id:category.id,name:category.name,slug:category.slug}]} initialCategoryId={categoryId} /> : tab === 'suppliers' ? <section className="admin-linked-records"><div className="admin-section-head"><div><h2>Suppliers for {category.name}</h2><p>Supplier profiles and rates linked to this category.</p></div><Link className="btn" href="/admin/suppliers">Manage suppliers</Link></div><div className="admin-record-grid">{categorySuppliers.map((supplier) => <Link className="card admin-supplier-card" href={`/admin/suppliers/${supplier.id}`} key={supplier.id}><strong>{supplier.name}</strong><span>{supplier.contact_name || 'No contact person'} · {supplier.phone || 'No phone'}</span><small>View rates and coverage</small></Link>)}{!categorySuppliers.length && <p>No suppliers linked yet. Add this category from a supplier profile.</p>}</div></section> : <>

      <CategoryAdminClient
        key={categoryId}
        section={tab}
        categoryId={categoryId}
        allShapes={(allShapes || []).map((s: any) => ({ id: s.id, name: s.name, iconKey: s.icon_key }))}
        allSizes={allSizes}
        allTags={allTags || []}
        linkedShapes={linkedShapes.map((s: any) => ({ id: s.id, name: s.name, iconKey: s.icon_key }))}
        linkedColors={linkedColors.map((c: any) => ({ id: c.id, name: c.name, hexValue: c.hex_value, refPhotoUrl: c.ref_photo_url }))}
        linkedSizes={linkedSizes.map((sz: any) => ({ id: sz.id, shape_id: sz.shape_id, size_mm: sz.size_mm, weight_ct: sz.weight_ct }))}
        linkedTags={linkedTags.map((t: any) => ({ id: t.id, name: t.name, is_global: t.is_global }))}
        linkedShapeIds={linkedShapeIds}
        linkedColorIds={linkedColorIds}
        linkedTagIds={linkedTagIds}
        linkedSizeIds={linkedSizeIds}
        thumbnailPhotoId={category.thumbnail_photo_id}
        photos={photosFormatted}
        otherCategories={otherCategories}
        currentCategory={{ id: category.id, name: category.name, slug: category.slug }}
        shapeReference={tab === 'shapes' ? <ShapeReferenceManager
        categoryId={categoryId}
        references={linkedShapes.map((shape: any) => {
          const link = (linkedShapesRaw || []).find((r: any) => r.shape_id === shape.id);
          // Same default-to-photo-when-available rule as the public category page: a
          // category-specific upload wins, otherwise fall back to the shared photo for
          // this shape (e.g. the Moissanite gemstone photos), otherwise the vector.
          // reference_style is ignored here too -- see the note in the category page.
          const refPhotoUrl = link?.ref_photo_url || shape?.ref_photo_url || null;
          return {
            shapeId: shape.id,
            name: shape?.name || `Shape #${shape.id}`,
            iconKey: shape?.icon_key,
            refPhotoUrl,
            referenceStyle: refPhotoUrl ? 'photo' as const : 'vector' as const,
            // Same order as the drill-holes route picks the photo to drill into.
            drillBaseUrl: link?.drill?.base || (link?.ref_photo_url?.includes('/shape-references/') ? link.ref_photo_url : null) || shape?.ref_photo_url || link?.ref_photo_url || null,
            drill: link?.drill ? { holes: link.drill.holes || [], backdrop: link.drill.backdrop || null } : null,
          };
        })}
/> : null}
        badgeTypes={(category.badge_types || []) as ('shapes' | 'colors' | 'sizes')[]}
        optionLabel={optionLabel}
        exploreDefault={parseExploreFilter((category as any).explore_default_filter)}
      /></>}
    </>
  );
}
