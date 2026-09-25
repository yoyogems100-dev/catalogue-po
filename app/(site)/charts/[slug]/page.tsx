import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGlobal, getMedia, getPage, whatsappHref } from '@/lib/site/public';
import { getChartGrades, getChartShapes, getColourChart } from '@/lib/site/chart-data';
import { chartPages } from '@/lib/site/chart-pages';
import { breadcrumbLd, OG_BASE, shareImages, SITE_URL } from '@/lib/site/page-meta';
import { richTextToPlain } from '@/lib/site/rich-text';
import { Crumbs, CtaBand, JsonLd, PageHead } from '@/components/site/PageParts';
import ShapeChart from '@/components/site/ShapeChart';
import SizeChart from '@/components/site/SizeChart';
import HideOnError from '@/components/site/HideOnError';
import RichText from '@/components/site/RichText';
import s from '@/components/site/site.module.css';
import c from '@/components/site/category.module.css';
import p from '@/components/site/pages.module.css';

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return chartPages(await getPage('charts')).map((c) => ({ slug: c.slug }));
}

async function resolve(slug: string) {
  const page = await getPage('charts');
  const charts = chartPages(page);
  const chart = charts.find((x) => x.slug === slug);
  return chart ? { page, charts, chart } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await resolve((await params).slug);
  if (!r) return { title: 'Not found', robots: { index: false } };
  const path = `/charts/${r.chart.slug}`;
  const img = r.page.seo?.image ? (await getMedia([r.page.seo.image])).get(r.page.seo.image) : null;
  const description = r.chart.intro.slice(0, 170) || undefined;
  return {
    title: r.chart.title,
    description,
    alternates: { canonical: path },
    openGraph: { ...OG_BASE, title: r.chart.title, description, url: path, images: shareImages(img, r.chart.title) }
  };
}

export default async function ChartPage({ params }: Props) {
  const r = await resolve((await params).slug);
  if (!r) notFound();
  const { page, charts, chart } = r;
  const g = await getGlobal();
  const path = `/charts/${chart.slug}`;

  let body: ReactNode = null;
  let extraLd: unknown[] = [];
  if (chart.kind === 'shapes') {
    const shapes = await getChartShapes();
    body = <ShapeChart shapes={shapes} />;
    extraLd = [{ '@context': 'https://schema.org', '@type': 'ItemList', name: chart.title, numberOfItems: shapes.length,
      itemListElement: shapes.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name })) }];
  } else if (chart.kind === 'sizes') {
    const shapes = (await getChartShapes()).filter((x) => x.sizes.length);
    const initial = shapes.find((x) => x.slug === 'round')?.slug ?? shapes[0]?.slug ?? '';
    body = (
      <>
        <SizeChart shapes={shapes} initial={initial} />
        {page.sizes?.note && <p className={p.note}>{page.sizes.note}</p>}
      </>
    );
  } else if (chart.kind === 'colour') {
    const groups = await getColourChart(chart.categories || []);
    body = groups.length ? groups.map((gr) => (
      <section key={gr.href} className={p.colourGroup} aria-labelledby={`grp-${gr.href}`}>
        <div className={p.colourGroupHead}>
          <h2 id={`grp-${gr.href}`} className={c.h}>{gr.name}</h2>
          <Link href={gr.href} className={s.linkArrow}>{gr.name} page →</Link>
        </div>
        <ul className={p.swatchChart} role="list">
          {gr.colours.map((x) => (
            <li key={x.slug}>
              <Link href={x.href} className={p.swatchTile}>
                <HideOnError as="span" className={p.swatchPhoto} img={{ src: x.img, alt: `${x.name} ${gr.name}`, width: 120, height: 120, loading: 'lazy', decoding: 'async' }} />
                <span>{x.name}</span>
              </Link>
            </li>
          ))}
        </ul>
        {gr.unphotographed.length > 0 && <p className={p.note}>Also available: {gr.unphotographed.join(', ')}. Photos on request.</p>}
      </section>
    )) : <p className={c.empty}>Colours for this chart are in the catalogue.</p>;
  } else {
    const grades = (await getChartGrades());
    body = (
      <>
        {page.grades?.body && (
          <section className={p.gradeIntro}>
            {page.grades?.body_heading && <h2 className={c.h}>{page.grades.body_heading}</h2>}
            <RichText html={page.grades.body} className={c.prose} />
          </section>
        )}
        <ol className={p.ladder} aria-label="Grades, lowest to highest">
          {grades.map((gr, i) => (
            <li key={gr.code} id={gr.code} className={p.rung}>
              <div className={p.rungMark}><span className={s.gradientText}>{gr.name}</span><span className={p.rungStep}>{i + 1} of {grades.length}</span></div>
              <div className={p.rungBody}>
                {gr.summary && <p className={p.rungSummary}>{gr.summary}</p>}
                <RichText html={gr.description} className={c.prose} />
                {gr.usedIn.length > 0 && (
                  <p className={p.rungUsed}>Stocked in: {gr.usedIn.map((u, j) => <span key={u.href}>{j > 0 && ', '}<Link href={u.href}>{u.name}</Link></span>)}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
        {page.grades?.choosing && (
          <section className={`${c.panel} ${p.gradeChoose}`}>
            {page.grades?.choosing_heading && <h2 className={c.h}>{page.grades.choosing_heading}</h2>}
            <RichText html={page.grades.choosing} className={c.prose} />
            <p style={{ marginTop: 14 }}><Link href="/quality" className={s.linkArrow}>How we check every lot →</Link></p>
          </section>
        )}
      </>
    );
    extraLd = [{
      '@context': 'https://schema.org', '@type': 'Article', headline: chart.title, url: `${SITE_URL}${path}`,
      description: chart.intro, articleBody: [richTextToPlain(page.grades?.body || ''), ...grades.map((gr) => `${gr.name}: ${gr.summary} ${richTextToPlain(gr.description)}`), richTextToPlain(page.grades?.choosing || '')].join('\n\n'),
      publisher: { '@type': 'Organization', name: 'YOYO GEMS', url: SITE_URL }
    }];
  }

  return (
    <>
      <Crumbs trail={[{ name: 'Home', href: '/' }, { name: 'Charts', href: '/charts' }, { name: chart.title }]} />
      <PageHead title={chart.title} intro={chart.intro} />
      <nav className={`${s.wrap} ${p.chartTabs}`} aria-label="Charts">
        <ul>{charts.map((x) => <li key={x.slug}>{x.slug === chart.slug ? <span aria-current="page">{x.title}</span> : <Link href={`/charts/${x.slug}`}>{x.title}</Link>}</li>)}</ul>
      </nav>
      <div className={`${s.wrap} ${p.chartBody}`}>{body}</div>
      <CtaBand heading="Get the full digital catalogue" text="Every shape, size and colour we stock, sent on WhatsApp." whatsapp={whatsappHref(g.contact?.whatsapp, g.contact?.whatsapp_message)} />
      <JsonLd data={[breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Charts', path: '/charts' }, { name: chart.title, path }]), ...extraLd]} />
    </>
  );
}
