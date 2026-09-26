import { DIMENSIONS, fillTemplate, filterHref, matches, type OptionsByDim, type Taggable } from './filters';

// Which filtered category views are worth sending to search engines, and the
// short list shown as "Popular searches" in the footer. Pure functions.

export type FilterLink = { href: string; label: string; photos: number; category: string };

/**
 * One link per single filter value that has at least one real photo behind
 * it, labelled with the same heading the filtered page shows.
 */
export function filterLinks(
  page: { name: string; href: string; photos: Taggable[] },
  options: OptionsByDim,
  headingTemplate: string
): FilterLink[] {
  const out: FilterLink[] = [];
  for (const dim of DIMENSIONS) {
    for (const o of options[dim]) {
      const sel = { shape: [], size: [], colour: [], grade: [], [dim]: [o.slug] };
      const photos = page.photos.filter((p) => matches(p, sel)).length;
      // Nothing to show is a thin page; showing everything is the same page
      // as the unfiltered one (e.g. the only grade a category carries).
      if (!photos || photos === page.photos.length) continue;
      // "Cabochon Cabochons": the category already says it.
      if (page.name.toLowerCase().includes(o.name.toLowerCase())) continue;
      out.push({
        href: filterHref(page.href, sel),
        label: fillTemplate(headingTemplate || '{filters} {category}', { filters: o.name, category: page.name, count: String(photos) }),
        photos,
        category: page.href
      });
    }
  }
  return out;
}

/**
 * The best-photographed filtered pages, spread across categories: each
 * category's strongest link first, then each one's second, and so on.
 */
export function popularLinks(links: FilterLink[], max = 12, perCategory = 2): FilterLink[] {
  const byCat = new Map<string, FilterLink[]>();
  for (const l of [...links].sort((a, b) => b.photos - a.photos)) {
    const list = byCat.get(l.category) ?? [];
    if (list.length < perCategory) list.push(l);
    byCat.set(l.category, list);
  }
  const out: FilterLink[] = [];
  for (let round = 0; round < perCategory; round++) {
    const tier = [...byCat.values()].map((list) => list[round]).filter(Boolean).sort((a, b) => b.photos - a.photos);
    out.push(...tier);
  }
  return out.slice(0, max);
}
