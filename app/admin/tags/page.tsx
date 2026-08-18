import { supabaseAdmin } from '@/lib/supabase-admin';
import TagsClient from './TagsClient';

// Admin pages never call a dynamic API (cookies()/headers()) themselves --
// auth happens purely in middleware -- so without this, Next can statically
// cache this page at build time and never pick up new tags/links again until
// the next deploy. Every admin list page needs this for the same reason.
export const dynamic = 'force-dynamic';

export default async function TagsPage() {
  const { data: tags } = await supabaseAdmin.from('tags').select('id, name, is_global').order('name');

  return (
    <>
      <h1>Tags</h1>
      <p style={{ fontSize: 13, color: '#8a8370', marginBottom: 18 }}>
        Free-form tags for anything shapes/colors/sizes don't cover -- e.g. "New Arrival", "Best Seller", "AAA Grade".
        Global tags are available to link on any category; category-specific tags are created from inside that category's page.
      </p>
      <TagsClient tags={tags || []} />
    </>
  );
}
