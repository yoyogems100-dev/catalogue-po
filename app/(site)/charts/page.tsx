import Link from 'next/link';
import { getGlobal, getPage, whatsappHref } from '@/lib/site/public';
import { getChartGrades, getChartShapes, getColourChart } from '@/lib/site/chart-data';
import { chartPages } from '@/lib/site/chart-pages';
import { breadcrumbLd, pageMetadata, SITE_URL } from '@/lib/site/page-meta';
import { Crumbs, CtaBand, JsonLd, PageHead } from '@/components/site/PageParts';
import HideOnError from '@/components/site/HideOnError';
import { Arrow } from '@/components/site/icons';
import s from '@/components/site/site.module.css';
import p from '@/components/site/pages.module.css';

export const revalidate = 3600;

export const generateMetadata = () => pageMetadata('charts', '/charts', { title: 'Charts: shapes, sizes, colours and grades' });

export default async function ChartsHub() {
  const [page, g, shapes, grades] = await Promise.all([getPage('charts'), getGlobal(), getChartShapes(), getChartGrades()]);
  const charts = chartPages(page);
  const swatches = Object.fromEntries(await Promise.all(charts.filter((c) => c.kind === 'colour').map(async (c) =>
    [c.slug, (await getColourChart(c.categories || [])).flatMap((gr) => gr.colours).slice(0, 8)] as const)));
  const shapePreview = shapes.filter((x) => x.img).slice(0, 6);

  return (
    <>
      <Crumbs trail={[{ name: 'Home', href: '/' }, { name: 'Charts' }]} />
      <PageHead title={page.hub?.heading || 'Charts'} intro={page.hub?.intro} />
      <section className={s.sectionTight} style={{ paddingTop: 0 }} aria-label="All charts">
        <ul className={`${s.wrap} ${p.chartCards}`} role="list">
          {charts.map((c) => (
            <li key={c.slug}>
              <Link href={`/charts/${c.slug}`} className={`${p.chartCard} ${c.kind === 'grades' ? p.chartCardWide : ''}`}>
                <div className={p.chartPreview} aria-hidden="true">
                  {c.kind === 'shapes' && shapePreview.map((x) => <HideOnError key={x.slug} as="span" className={p.previewShape} img={{ src: x.img!, alt: '', width: 48, height: 48, loading: 'lazy' }} />)}
                  {c.kind === 'sizes' && ['1.0', '2.0', '3.0', '4.0', '5.0'].map((mm, i) => <span key={mm} className={p.previewDot} style={{ width: 10 + i * 7, height: 10 + i * 7 }} />)}
                  {c.kind === 'colour' && (swatches[c.slug] || []).map((x) => <HideOnError key={x.slug} as="span" className={p.previewSwatch} img={{ src: x.img, alt: '', width: 36, height: 36, loading: 'lazy' }} />)}
                  {c.kind === 'grades' && grades.map((gr) => <span key={gr.code} className={p.previewGrade}>{gr.name.replace('High Density Swiss', 'HD Swiss')}</span>)}
                </div>
                <h2>{c.title}</h2>
                {c.intro && <p>{c.intro}</p>}
                <span className={s.linkArrow}>Open <Arrow /></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <CtaBand heading="Want every chart in one file?" text="The digital catalogue has every shape, size and colour we stock." whatsapp={whatsappHref(g.contact?.whatsapp, g.contact?.whatsapp_message)} />
      <JsonLd data={[
        breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Charts', path: '/charts' }]),
        { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Charts', itemListElement: charts.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.title, url: `${SITE_URL}/charts/${c.slug}` })) }
      ]} />
    </>
  );
}
