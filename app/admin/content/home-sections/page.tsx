import { supabaseAdmin } from '@/lib/supabase-admin';
import { photoUrl } from '@/lib/photos';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import { MOST_ORDERED_SETTING_KEY } from '@/lib/most-ordered';
import { HOME_SECTIONS_SETTING_KEY, parseHomeSections } from '@/lib/home-sections';
import HomeSectionsEditor from './HomeSectionsEditor';

// See app/admin/categories/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

type PhotoRow = { id: number; category_id: number; is_cover_only: boolean | null; storage_path: string | null; drive_id: string | null; photo_crop: any; cover_crop: any };

export default async function HomeSectionsPage() {
  const [{ data: categories }, { data: settings }, { data: photos }] = await Promise.all([
    supabaseAdmin.from('categories').select('id, num, name, thumbnail_photo_id, archived_at').order('num'),
    supabaseAdmin.from('settings').select('key, value').in('key', [HOME_SECTIONS_SETTING_KEY, MOST_ORDERED_SETTING_KEY]),
    fetchAllRows<PhotoRow>((from, to) => supabaseAdmin.from('photos')
      .select('id, category_id, is_cover_only, storage_path, drive_id, photo_crop, cover_crop', { count: 'exact' })
      .order('sort_order', { ascending: true }).order('id', { ascending: true }).range(from, to))
  ]);
  const setting = (key: string) => settings?.find((s) => s.key === key)?.value ?? null;

  // The same cover the /po home card shows, small, so each row is recognisable at a glance.
  const photoById = new Map((photos || []).map((p) => [p.id, p]));
  const firstPhoto = new Map<number, PhotoRow>();
  (photos || []).forEach((p) => { if (!p.is_cover_only && !firstPhoto.has(p.category_id)) firstPhoto.set(p.category_id, p); });

  const rows = (categories || []).map((c) => {
    const cover = (c.thumbnail_photo_id && photoById.get(c.thumbnail_photo_id)) || firstPhoto.get(c.id) || null;
    return { id: c.id, num: c.num, name: c.name, archived: !!c.archived_at, thumb: cover ? photoUrl(cover, 120, 'cover') : null };
  });

  return (
    <>
      <div className="hs-page-head">
        <h1>Home page sections</h1>
        <a className="btn-ghost" href="/po" target="_blank" rel="noopener">View /po ↗</a>
      </div>
      <p className="hs-intro">
        The category shelves at the top of the <a href="/po" target="_blank" rel="noopener">/po</a> home page, such as
        &ldquo;Most ordered&rdquo; and &ldquo;New in&rdquo;. Buyers see them from top to bottom in this order. Every category not
        on a shelf is listed after them.
      </p>
      <HomeSectionsEditor
        categories={rows}
        initial={parseHomeSections(setting(HOME_SECTIONS_SETTING_KEY), setting(MOST_ORDERED_SETTING_KEY))}
      />
    </>
  );
}
