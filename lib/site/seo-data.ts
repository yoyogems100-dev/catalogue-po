import { unstable_cache } from 'next/cache';
import { getAllCategoryPaths, getCategoryPage, optionsOf } from './category-data';
import { getGlobal } from './public';
import { filterLinks, popularLinks, type FilterLink } from './seo';

// Every visible category page and its worthwhile filtered views, for the
// sitemap and the footer. Cached with the rest of the site and refreshed on
// any admin change.

export type CategoryEntry = { href: string; links: FilterLink[] };

async function load(): Promise<CategoryEntry[]> {
  const [paths, g] = await Promise.all([getAllCategoryPaths(), getGlobal()]);
  const template = g.filters?.heading || '{filters} {category}';
  const pages = await Promise.all(paths.map((p) => getCategoryPage(p.parent, p.slug)));
  return pages.filter((p): p is NonNullable<typeof p> => !!p)
    .map((page) => ({ href: page.href, links: filterLinks(page, optionsOf(page), template) }));
}

export const getSeoCategories = unstable_cache(load, ['site-seo-categories'], { revalidate: 3600, tags: ['site'] });

/** Footer "Popular searches" when the owner has not chosen their own. */
export async function getPopularSearches(): Promise<{ label: string; url: string }[]> {
  const entries = await getSeoCategories();
  return popularLinks(entries.flatMap((e) => e.links)).map((l) => ({ label: l.label, url: l.href }));
}
