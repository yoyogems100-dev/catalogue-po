import Link from 'next/link';
import { supabasePublic } from '@/lib/supabase-public';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { photoUrl } from '@/lib/photos';
import { getCustomerId } from '@/lib/customer-auth';
import HeaderLogo from '@/components/HeaderLogo';
import AccountMenu from '@/components/AccountMenu';
import Footer from '@/components/Footer';
import { getSettings } from '@/lib/settings';

export const revalidate = 30;

async function getAccountState() {
  const customerId = getCustomerId();
  if (!customerId) return { loggedIn: false, customerName: null };
  const { data } = await supabaseAdmin.from('customers').select('name').eq('id', customerId).maybeSingle();
  return { loggedIn: true, customerName: data?.name || null };
}

// Browse everything at a glance, grouped by category, instead of clicking into
// one category at a time -- default view shows each category's cover photo;
// picking a tag narrows every category down to just the photos carrying it.
export default async function BrowsePage({ searchParams }: { searchParams: { tag?: string } }) {
  const selectedTagId = searchParams.tag ? Number(searchParams.tag) : null;

  const [{ data: tags }, { data: categories }, account, settings] = await Promise.all([
    supabasePublic.from('tags').select('id, name').eq('is_global', true).order('name'),
    supabasePublic.from('categories').select('id, num, name, slug, thumbnail_photo_id').order('num'),
    getAccountState(),
    getSettings()
  ]);

  const categoryIds = (categories || []).map((c) => c.id);

  let sections: { category: { id: number; name: string; slug: string }; photos: { id: number; url: string | null }[] }[] = [];

  if (selectedTagId) {
    // Tag selected: every photo across every category carrying that tag, grouped by category.
    const { data: taggedPhotoIds } = await supabasePublic.from('photo_tags').select('photo_id').eq('tag_id', selectedTagId);
    const photoIds = (taggedPhotoIds || []).map((r: any) => r.photo_id);
    const { data: photos } = photoIds.length
      ? await supabasePublic.from('photos').select('id, category_id, storage_path, drive_id').in('id', photoIds)
      : { data: [] };

    const byCategory: Record<number, { id: number; url: string | null }[]> = {};
    (photos || []).forEach((p: any) => {
      if (!byCategory[p.category_id]) byCategory[p.category_id] = [];
      byCategory[p.category_id].push({ id: p.id, url: photoUrl(p, 400) });
    });

    sections = (categories || [])
      .filter((c) => byCategory[c.id]?.length)
      .map((c) => ({ category: { id: c.id, name: c.name, slug: c.slug }, photos: byCategory[c.id] }));
  } else {
    // Default view: one cover/default photo per category, every category visible at once.
    const { data: photos } = categoryIds.length
      ? await supabasePublic.from('photos').select('id, category_id, storage_path, drive_id, sort_order').in('category_id', categoryIds).order('sort_order')
      : { data: [] };

    const firstPhotoByCategory: Record<number, any> = {};
    const photoById: Record<number, any> = {};
    (photos || []).forEach((p: any) => {
      photoById[p.id] = p;
      if (!firstPhotoByCategory[p.category_id]) firstPhotoByCategory[p.category_id] = p;
    });

    sections = (categories || [])
      .map((c) => {
        const cover = (c.thumbnail_photo_id && photoById[c.thumbnail_photo_id]) || firstPhotoByCategory[c.id] || null;
        return { category: { id: c.id, name: c.name, slug: c.slug }, photos: cover ? [{ id: cover.id, url: photoUrl(cover, 400) }] : [] };
      })
      .filter((s) => s.photos.length > 0);
  }

  return (
    <>
      <div className="topbar">
        <Link href="/"><HeaderLogo height={28} /></Link>
        <AccountMenu loggedIn={account.loggedIn} customerName={account.customerName} />
      </div>
      <div className="container" style={{ padding: '28px 20px 80px' }}>
        <nav className="breadcrumb-nav">
          <Link href="/">&#127968; Home</Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Browse</span>
        </nav>
        <h1 style={{ fontSize: 26, color: 'var(--ink)', margin: '0 0 6px' }}>Browse</h1>
        <p style={{ fontSize: 13, color: '#8a8370', marginBottom: 18 }}>
          {selectedTagId ? 'Every category with a match for this tag.' : "Every category's default photo, all in one glance -- pick a tag to narrow down."}
        </p>

        {tags && tags.length > 0 && (
          <div className="browse-tag-row">
            <Link href="/browse" className={`tag-chip-filter ${!selectedTagId ? 'active' : ''}`}>All</Link>
            {tags.map((t: any) => (
              <Link key={t.id} href={`/browse?tag=${t.id}`} className={`tag-chip-filter ${selectedTagId === t.id ? 'active' : ''}`}>
                {t.name}
              </Link>
            ))}
          </div>
        )}

        {sections.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#8a8370', border: '1px dashed var(--line)' }}>
            No photos found for this tag yet.
          </div>
        ) : (
          sections.map(({ category, photos }) => (
            <section key={category.id} className="browse-category-section">
              <div className="browse-category-head">
                <h2>{category.name}</h2>
                <Link href={`/category/${category.slug}`}>View category &rarr;</Link>
              </div>
              <div className="browse-photo-grid">
                {photos.map((p) => (
                  <Link key={p.id} href={`/category/${category.slug}`} className="browse-photo-tile">
                    {p.url && <img src={p.url} alt={category.name} loading="lazy" />}
                  </Link>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
      <Footer settings={settings} />
    </>
  );
}
