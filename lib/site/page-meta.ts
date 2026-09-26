import type { Metadata } from 'next';
import { getMedia, getPage } from './public';
import { OG_BASE, shareImages } from './share';

export { OG_BASE, shareCard, shareImages } from './share';

export const SITE_URL = 'https://www.yoyogems.co.in';

/** Title, description, canonical and share image for a standalone page. */
export async function pageMetadata(key: string, path: string, fallback: { title: string; description?: string }): Promise<Metadata> {
  const page = await getPage(key);
  const seo = page.seo || {};
  const img = seo.image ? (await getMedia([seo.image])).get(seo.image) : null;
  const title = seo.title || fallback.title;
  const description = (seo.description || fallback.description || '').slice(0, 170) || undefined;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...OG_BASE, title, description, url: path, images: shareImages(img, title) }
  };
}

export function breadcrumbLd(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${SITE_URL}${c.path}` }))
  };
}
