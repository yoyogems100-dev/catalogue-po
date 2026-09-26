import type { MetadataRoute } from 'next';
import { getPage } from '@/lib/site/public';
import { chartPages } from '@/lib/site/chart-pages';
import { getSeoCategories } from '@/lib/site/seo-data';
import { SITE_URL } from '@/lib/site/page-meta';

// Built from the live website: every visible category, its filtered views
// that have photos behind them, the chart pages and the standalone pages.
// The private catalogue (/po) and admin are not listed.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, charts] = await Promise.all([getSeoCategories(), getPage('charts')]);
  const url = (path: string) => `${SITE_URL}${path}`;
  const pages: MetadataRoute.Sitemap = [
    { url: url('/'), changeFrequency: 'weekly', priority: 1 },
    { url: url('/request-catalogue'), changeFrequency: 'monthly', priority: 0.9 },
    { url: url('/products'), changeFrequency: 'weekly', priority: 0.8 },
    ...['/about', '/quality', '/how-to-order', '/faq', '/contact'].map((p) => ({ url: url(p), changeFrequency: 'monthly' as const, priority: 0.6 })),
    { url: url('/charts'), changeFrequency: 'monthly', priority: 0.7 },
    ...chartPages(charts).map((c) => ({ url: url(`/charts/${c.slug}`), changeFrequency: 'monthly' as const, priority: 0.6 }))
  ];
  for (const c of categories) {
    pages.push({ url: url(c.href), changeFrequency: 'weekly', priority: c.href.split('/').length > 3 ? 0.7 : 0.8 });
    for (const l of c.links) pages.push({ url: url(l.href), changeFrequency: 'weekly', priority: 0.5 });
  }
  return pages;
}
