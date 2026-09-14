// The Supabase project caps any single response at 1000 rows; a plain
// `.select()` on a table that has grown past that silently returns only the
// first page instead of erroring, so join tables read in full for a
// site-wide computation (e.g. every category_shape_sizes row, to work out
// which categories have any linked sizes) quietly go stale as the catalogue
// grows. This mirrors the pagination loop already used in
// app/api/hot-selling/route.ts, factored out for reuse.
//
// Pages are fetched in parallel, not one-at-a-time: the first page also asks
// Postgres for the exact total row count, so every remaining page's range is
// already known and can be requested in the same Promise.all instead of
// waiting on each previous page to land first. A table with 4000+ rows
// (5 pages) used to mean 5 sequential round-trips to Supabase before the
// caller could even start rendering; now it's effectively one round-trip's
// worth of latency.
const PAGE_SIZE = 1000;

export async function fetchAllRows<T>(
  buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null; count?: number | null }>
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const first = await buildPage(0, PAGE_SIZE - 1);
  if (first.error) return { data: null, error: first.error };
  const firstRows = first.data || [];
  const total = typeof first.count === 'number' ? first.count : null;
  // No usable count (buildPage didn't request one) -- fall back to the
  // original sequential loop, since we don't know how many pages remain.
  if (total === null) {
    const all = [...firstRows];
    for (let offset = PAGE_SIZE; firstRows.length === PAGE_SIZE; offset += PAGE_SIZE) {
      const { data, error } = await buildPage(offset, offset + PAGE_SIZE - 1);
      if (error) return { data: null, error };
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE_SIZE) break;
    }
    return { data: all, error: null };
  }
  const remainingOffsets: number[] = [];
  for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) remainingOffsets.push(offset);
  const rest = await Promise.all(remainingOffsets.map((offset) => buildPage(offset, offset + PAGE_SIZE - 1)));
  const restError = rest.find((r) => r.error)?.error;
  if (restError) return { data: null, error: restError };
  const all = [...firstRows, ...rest.flatMap((r) => r.data || [])];
  return { data: all, error: null };
}
