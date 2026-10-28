import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategoryPage, optionsOf } from './category-data';
import { getGlobal, getMedia, getPage } from './public';
import { visibleChartSlugs } from './chart-pages';
import { OG_BASE, shareImages } from './page-meta';
import { richTextToPlain } from './rich-text';
import FilteredCategoryView from '@/components/site/FilteredCategoryView';

// Shared by /products/[slug] and /products/[slug]/[sub]. The server renders
// only the plain category page (cached, see the page files); ?shape=…
// filters are applied in the browser by FilteredCategoryView. Crawlers that
// walk filter combinations therefore get the one cached page, which names
// the plain URL as canonical, and next.config.js marks filtered URLs noindex.

async function resolve(parentSlug: string | null, slug: string) {
  const page = await getCategoryPage(parentSlug, slug);
  if (!page) return null;
  const [global, chartsContent] = await Promise.all([getGlobal(), getPage('charts')]);
  return { page, global, options: optionsOf(page), chartSlugs: visibleChartSlugs(chartsContent) };
}

export async function categoryMetadata(parentSlug: string | null, slug: string): Promise<Metadata> {
  const r = await resolve(parentSlug, slug);
  if (!r) return { title: 'Not found', robots: { index: false } };
  const { page } = r;
  const seo = page.content.seo || {};
  const description = (seo.description || page.content.hero?.promise || page.descriptor || richTextToPlain(page.content.what?.body || '')) || undefined;
  const ogId = seo.image || page.content.hero?.image;
  const og = ogId ? (await getMedia([ogId])).get(ogId) : null;
  return {
    title: seo.title || page.name,
    description: description?.slice(0, 170),
    alternates: { canonical: page.href },
    openGraph: { ...OG_BASE, title: seo.title || page.name, description: description?.slice(0, 200), url: page.href, images: shareImages(og, page.name, page.photos[0]?.src) }
  };
}

export async function CategoryRoute({ parentSlug, slug }: { parentSlug: string | null; slug: string }) {
  const r = await resolve(parentSlug, slug);
  if (!r) notFound();
  const { page, global, options, chartSlugs } = r;
  const site = 'https://www.yoyogems.co.in';
  const crumbs = [{ name: 'Home', url: `${site}/` }, { name: 'Products', url: `${site}/products` },
    ...(page.parent ? [{ name: page.parent.name, url: `${site}${page.parent.href}` }] : []), { name: page.name, url: `${site}${page.href}` }];
  // Sub-categories only: filtered (?shape=…) URLs are kept out of search.
  const list = page.children.map((k, i) => ({ '@type': 'ListItem', position: i + 1, name: k.name, url: `${site}${k.href}` }));
  const ld = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })) },
    ...(list.length ? [{ '@context': 'https://schema.org', '@type': 'ItemList', name: page.name, itemListElement: list }] : [])
  ];
  return (
    <>
      <FilteredCategoryView page={page} options={options} global={global} chartSlugs={chartSlugs} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
    </>
  );
}
