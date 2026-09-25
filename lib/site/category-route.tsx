import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategoryPage, type CategoryPage } from './category-data';
import { getGlobal, getMedia } from './public';
import { mediaSrc } from './media-url';
import { activeCount, fillTemplate, filterHref, isIndexable, parseSelection, selectionWords, type OptionsByDim, type Selection } from './filters';
import { richTextToPlain } from './rich-text';
import CategoryView from '@/components/site/CategoryView';

// Shared by /products/[slug] and /products/[slug]/[sub].

type Params = Record<string, string | string[] | undefined>;

function optionsOf(page: CategoryPage): OptionsByDim {
  return {
    shape: page.filters.shape ? page.shapes : [],
    size: page.filters.size ? page.sizes : [],
    colour: page.filters.colour ? page.colours : [],
    grade: page.filters.grade ? page.grades : []
  };
}

async function resolve(parentSlug: string | null, slug: string, search: Params) {
  const page = await getCategoryPage(parentSlug, slug);
  if (!page) return null;
  const global = await getGlobal();
  const options = optionsOf(page);
  const selection = parseSelection(search, options);
  const count = activeCount(selection);
  let heading = page.name;
  let intro: string | null = null;
  if (count) {
    const words = { filters: selectionWords(selection, options), category: page.name, count: String(page.photos.length) };
    heading = fillTemplate(global.filters?.heading || '{filters} {category}', words);
    intro = fillTemplate(global.filters?.intro || '{filters} {category} from our ready range.', words);
  }
  return { page, global, options, selection, count, heading, intro };
}

export async function categoryMetadata(parentSlug: string | null, slug: string, search: Params): Promise<Metadata> {
  const r = await resolve(parentSlug, slug, search);
  if (!r) return { title: 'Not found', robots: { index: false } };
  const { page, selection, count, heading, intro } = r;
  const seo = page.content.seo || {};
  const indexable = !count || isIndexable(selection);
  const canonical = count && indexable ? filterHref(page.href, selection) : page.href;
  const description = (count ? intro : seo.description || page.content.hero?.promise || page.descriptor || richTextToPlain(page.content.what?.body || '')) || undefined;
  const ogId = seo.image || page.content.hero?.image;
  const og = ogId ? (await getMedia([ogId])).get(ogId) : null;
  return {
    title: count ? heading : seo.title || heading,
    description: description?.slice(0, 170),
    alternates: { canonical },
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: { title: count ? heading : seo.title || heading, description: description?.slice(0, 200), url: canonical, images: og ? [{ url: mediaSrc(og, 1600), alt: og.alt }] : page.photos[0] ? [{ url: page.photos[0].src }] : undefined }
  };
}

export async function CategoryRoute({ parentSlug, slug, search }: { parentSlug: string | null; slug: string; search: Params }) {
  const r = await resolve(parentSlug, slug, search);
  if (!r) notFound();
  const { page, global, options, selection, heading, intro } = r;
  const site = 'https://www.yoyogems.co.in';
  const crumbs = [{ name: 'Home', url: `${site}/` }, { name: 'Products', url: `${site}/products` },
    ...(page.parent ? [{ name: page.parent.name, url: `${site}${page.parent.href}` }] : []), { name: page.name, url: `${site}${page.href}` }];
  const list = page.children.length
    ? page.children.map((k, i) => ({ '@type': 'ListItem', position: i + 1, name: k.name, url: `${site}${k.href}` }))
    : page.shapes.map((sh, i) => ({ '@type': 'ListItem', position: i + 1, name: `${sh.name} ${page.name}`, url: `${site}${filterHref(page.href, emptySel(), 'shape', sh.slug)}` }));
  const ld = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })) },
    ...(list.length ? [{ '@context': 'https://schema.org', '@type': 'ItemList', name: page.name, itemListElement: list }] : [])
  ];
  return (
    <>
      <CategoryView page={page} selection={selection} options={options} heading={heading} intro={intro} global={global} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
    </>
  );
}

function emptySel(): Selection { return { shape: [], size: [], colour: [], grade: [] }; }
