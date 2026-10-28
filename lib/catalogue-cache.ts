import { unstable_cache, revalidateTag } from 'next/cache';
import { after } from 'next/server';

// Catalogue reads that are the same for every buyer -- categories, shapes,
// sizes, colours, photos, settings -- are cached instead of re-read from
// Supabase on every request. Every admin write ends by expiring the
// `catalogue` tag (see catalogueChanged), so an edit still shows on the next
// page load; the hourly revalidate is only a backstop.
//
// Per-buyer data (cart, orders, interests, prices for one buyer) is never
// cached here.

export const CATALOGUE_TAG = 'catalogue';

export function cachedCatalogue<A extends unknown[], R>(fn: (...args: A) => Promise<R>, key: string[]): (...args: A) => Promise<R> {
  return unstable_cache(fn, key, { tags: [CATALOGUE_TAG], revalidate: 3600 });
}

/**
 * Call from an admin write handler, once the caller is known to be an admin.
 * The tag is expired after the response is sent -- i.e. after the handler's
 * own writes -- so a read racing the write can't re-cache the old data.
 */
export function catalogueChanged() {
  after(() => revalidateTag(CATALOGUE_TAG, { expire: 0 }));
}

/**
 * Read-only catalogue JSON that is the same for every signed-in buyer: the
 * Vercel CDN answers repeat requests for a minute and then refreshes in the
 * background, so a burst of buyers costs one function call, not one each.
 * The sign-in check (middleware) still runs before the CDN cache.
 */
export const SHARED_JSON_CACHE = 'public, max-age=30, s-maxage=60, stale-while-revalidate=86400';
