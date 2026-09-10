import { supabaseAdmin } from '@/lib/supabase-admin';
import TagsClient from './TagsClient';

// Admin pages never call a dynamic API (cookies()/headers()) themselves --
// auth happens purely in middleware -- so without this, Next can statically
// cache this page at build time and never pick up new tags/links again until
// the next deploy. Every admin list page needs this for the same reason.
export const dynamic = 'force-dynamic';

export default async function TagsPage({searchParams}:{searchParams:Promise<{category?:string}>}) {
  const query = await searchParams;
  const categoryId = Number(query.category) || 0;
  const {data:categories} = await supabaseAdmin.from('categories').select('id,name').order('num');
  const selected = categories?.find(category => category.id === categoryId);
  const {data:links} = selected ? await supabaseAdmin.from('category_tags').select('tag_id').eq('category_id',categoryId) : {data:[]};
  const { data: tags } = await supabaseAdmin.from('tags').select('id, name, is_global').order('name');

  return (
    <>
      <h1>Tags</h1>
      <p style={{ fontSize: 13, color: '#756e5c', marginBottom: 18 }}>
        Free-form tags for anything shapes/colors/sizes don't cover -- e.g. "New Arrival", "Best Seller", "AAA Grade".
        Global tags are available to link on any category; category-specific tags are created from inside that category's page.
      </p>
      <form><label>Filter by category<select name="category" defaultValue={categoryId}><option value={0}>All categories</option>{categories?.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><button className="btn" type="submit">Apply</button></form>
      {selected ? <><p>Specifications linked to {selected.name}. <a href={`/admin/categories/${categoryId}?tab=specifications`}>Manage category specifications</a></p><ul>{(tags || []).filter(tag => links?.some(link => link.tag_id === tag.id)).map(tag => <li key={tag.id}>{tag.name}</li>)}</ul>{!links?.length && <p>No specifications linked yet.</p>}</> : <TagsClient tags={tags || []} />}
    </>
  );
}
