// The Supabase project caps any single response at 1000 rows; a plain
// `.select()` on a table that has grown past that silently returns only the
// first page instead of erroring, so join tables read in full for a
// site-wide computation (e.g. every category_shape_sizes row, to work out
// which categories have any linked sizes) quietly go stale as the catalogue
// grows. This mirrors the pagination loop already used in
// app/api/hot-selling/route.ts, factored out for reuse.
const PAGE_SIZE = 1000;

export async function fetchAllRows<T>(
  buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const all: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await buildPage(offset, offset + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    if (data) all.push(...data);
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { data: all, error: null };
}
