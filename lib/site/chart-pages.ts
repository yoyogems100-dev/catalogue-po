import { slugOf } from './filters';

// Pure helpers for the Charts pages (no database access; safe in tests).

/** Every chart page in hub order, from the Charts page content. */
export function chartPages(content: any): { slug: string; title: string; intro: string; kind: 'shapes' | 'sizes' | 'colour' | 'grades'; categories?: number[] }[] {
  return [
    { slug: 'shapes', title: content.shapes?.title || 'Shape chart', intro: content.shapes?.intro || '', kind: 'shapes' as const },
    { slug: 'sizes', title: content.sizes?.title || 'Size & MM → carat chart', intro: content.sizes?.intro || '', kind: 'sizes' as const },
    ...colourChartList(content).map((c) => ({ ...c, kind: 'colour' as const })),
    { slug: 'grades', title: content.grades?.title || 'Quality grades explained', intro: content.grades?.intro || '', kind: 'grades' as const }
  ];
}

/** The colour charts configured on the Charts page, with their URL slugs. */
export function colourChartList(content: any): { slug: string; title: string; intro: string; categories: number[] }[] {
  const reserved = new Set(['shapes', 'sizes', 'grades']);
  const seen = new Set<string>();
  return ((content?.colours?.charts || []) as any[]).map((c) => ({ ...c, slug: slugOf(c.slug || c.title) }))
    .filter((c) => c.slug && c.title && !reserved.has(c.slug) && !seen.has(c.slug) && (seen.add(c.slug), true));
}

/** Sort sizes by first dimension, then second: 1, 1x1.5, 1x2, 1.1, 1.5 ... */
export function byMm(a: string, b: string) {
  const nums = (s: string) => (s.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  const x = nums(a), y = nums(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? -1) - (y[i] ?? -1);
    if (d) return d;
  }
  return a.localeCompare(b);
}
