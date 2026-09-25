import Link from 'next/link';
import type { CategoryPage } from '@/lib/site/category-data';
import { filterHref, matches, type OptionsByDim, type Selection } from '@/lib/site/filters';
import type { ContentValue } from '@/lib/site/schema';
import { whatsappHref } from '@/lib/site/public';
import RichText from './RichText';
import FilterBar from './FilterBar';
import HideOnError from './HideOnError';
import { Arrow, WhatsApp } from './icons';
import s from './site.module.css';
import c from './category.module.css';

const PHOTO_LIMIT = 36;

export default function CategoryView({ page, selection, options, heading, intro, global }: {
  page: CategoryPage; selection: Selection; options: OptionsByDim; heading: string; intro: string | null; global: ContentValue;
}) {
  const b = page.content;
  const filtered = !!intro;
  const results = page.photos.filter((p) => matches(p, selection));
  const shownPhotos = results.slice(0, PHOTO_LIMIT);
  // With no filter, owner-chosen gallery images lead; filters always show
  // the catalogue photos that match.
  const gallery = !filtered && page.gallery.length ? page.gallery : null;
  const wa = whatsappHref(global.contact?.whatsapp, `Hi YOYO GEMS, I'm interested in ${heading}.`);
  const requestHref = `/request-catalogue?category=${encodeURIComponent(page.parent ? `${page.parent.slug}/${page.slug}` : page.slug)}`;
  const points = (b.why?.points || []).filter((p: any) => p.text);
  const checks = (b.judge?.checkpoints || []).filter((p: any) => p.title || p.body);
  const stockRows = [['Minimum order', b.stock?.moq], ['Lead time', b.stock?.lead_time], ['Calibration', b.stock?.calibration]].filter(([, v]) => v);
  const filterOptions = {
    shape: page.filters.shape ? page.shapes : [],
    size: page.filters.size ? page.sizes : [],
    colour: page.filters.colour ? page.colours : [],
    grade: page.filters.grade ? page.grades : []
  };
  const showFilters = page.photos.length > 0 && Object.values(filterOptions).some((l) => l.length > 1);
  // On a filtered page the charts narrow to the selection too, so the page
  // still says something useful when no photograph matches.
  const chartColours = selection.colour.length
    ? page.colours.filter((col) => selection.colour.some((want) => col.slug === want || col.slug.split('-').includes(want)))
    : page.colours;
  const chartSizes = selection.shape.length ? page.sizeChart.filter((r) => selection.shape.includes(r.slug)) : page.sizeChart;

  const stones = (
    <section className={c.stones} id="stones" aria-labelledby="stones-heading">
      <div className={s.wrap}>
        <h2 id="stones-heading" className={s.h2} style={{ fontSize: 26 }}>{filtered ? `${results.length} matching photo${results.length === 1 ? '' : 's'}` : 'Photographs'}</h2>
      </div>
      {showFilters && <FilterBar basePath={page.href} options={filterOptions} selection={selection} resultCount={results.length} />}
      <div className={s.wrap}>
        {gallery ? (
          <div className={c.photoGrid}>
            {gallery.map((img, i) => (
              <figure key={i} className={c.photo}><img src={img.src} srcSet={img.srcSet} sizes="(min-width: 900px) 25vw, 50vw" alt={img.alt} loading="lazy" decoding="async" /></figure>
            ))}
          </div>
        ) : shownPhotos.length ? (
          <div className={c.photoGrid}>
            {shownPhotos.map((p) => (
              <HideOnError key={p.id} className={c.photo} img={{ src: p.src, alt: p.alt, loading: 'lazy', decoding: 'async' }} />
            ))}
          </div>
        ) : (
          <div className={c.empty}>
            <p><strong>{filtered ? 'No photographs for this combination yet.' : 'Photographs for this range are in the catalogue.'}</strong></p>
            <p>{filtered ? 'We may still hold it. ' : ''}Tell us the shape, size and colour and we’ll confirm stock.</p>
            <div className={s.heroActions} style={{ justifyContent: 'center', marginTop: 14 }}>
              <Link href={requestHref} className={`${s.btn} ${s.btnSm}`}>Request catalogue</Link>
              {filtered && <Link href={page.href} scroll={false} className={`${s.btnGhost} ${s.btnSm}`}>Clear filters</Link>}
            </div>
          </div>
        )}
        {results.length > shownPhotos.length && !gallery && (
          <p className={c.more}>Showing {shownPhotos.length} of {results.length}. <Link href={requestHref}>Get the full catalogue</Link> for every photograph.</p>
        )}
      </div>
    </section>
  );

  return (
    <>
      <nav className={`${s.wrap} ${c.crumbs}`} aria-label="Breadcrumb">
        <ol>
          <li><Link href="/">Home</Link></li>
          <li><Link href="/products">Products</Link></li>
          {page.parent && <li><Link href={page.parent.href}>{page.parent.name}</Link></li>}
          {filtered ? <li><Link href={page.href}>{page.name}</Link></li> : <li aria-current="page">{page.name}</li>}
        </ol>
      </nav>

      <section className={c.hero}>
        <div className={`${s.wrap} ${c.heroGrid}`}>
          <div>
            <h1 className={c.title}>{heading}</h1>
            {filtered ? <p className={c.promise}>{intro}</p> : (b.hero?.promise || page.descriptor) && <p className={c.promise}>{b.hero?.promise || page.descriptor}</p>}
            <div className={s.heroActions}>
              <Link href={requestHref} className={s.btn}>Request catalogue</Link>
              {wa && <a href={wa} className={s.btnGhost} target="_blank" rel="noopener noreferrer"><WhatsApp size={18} /> WhatsApp</a>}
            </div>
          </div>
          {page.heroImage && (
            <div className={c.heroImg}>
              <img src={page.heroImage.src} srcSet={page.heroImage.srcSet} sizes="(min-width: 900px) 45vw, 100vw" alt={page.heroImage.alt} fetchPriority="high" />
            </div>
          )}
        </div>
      </section>

      {filtered && stones}

      {page.children.length > 0 && (
        <section className={s.sectionTight} aria-labelledby="types-heading">
          <div className={s.wrap}>
            <h2 id="types-heading" className={s.h2} style={{ fontSize: 28 }}>Types of {page.name}</h2>
            <ul className={s.catGrid} role="list" style={{ listStyle: 'none', padding: 0 }}>
              {page.children.map((k) => (
                <li key={k.slug}>
                  <Link href={k.href} className={s.catTile}>
                    <div className={s.catImg}>{k.image ? <img src={k.image.src} srcSet={k.image.srcSet} sizes="(min-width: 900px) 25vw, 50vw" alt={k.image.alt} loading="lazy" /> : <div className={s.catImgEmpty} />}</div>
                    <div className={s.catBody}><span className={s.catName}>{k.name}</span>{k.descriptor && <span className={s.catDesc}>{k.descriptor}</span>}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {!filtered && (b.what?.body || points.length > 0) && (
        <section className={s.sectionTight}>
          <div className={`${s.wrap} ${c.twoCol}`}>
            {b.what?.body && (
              <div>
                <h2 className={c.h}>{b.what.heading || 'What it is'}</h2>
                <RichText html={b.what.body} className={c.prose} />
              </div>
            )}
            {points.length > 0 && (
              <div className={c.panel}>
                <h2 className={c.h}>{b.why?.heading || 'Why it matters for your production'}</h2>
                <ul className={c.ticks}>{points.map((p: any, i: number) => <li key={i}>{p.text}</li>)}</ul>
              </div>
            )}
          </div>
        </section>
      )}

      {!filtered && checks.length > 0 && (
        <section className={s.sectionTight} aria-labelledby="judge-heading">
          <div className={s.wrap}>
            <h2 id="judge-heading" className={c.h}>{b.judge?.heading || 'How to judge quality'}</h2>
            <ol className={c.checks}>
              {checks.map((p: any, i: number) => (
                <li key={i}><h3>{p.title}</h3>{p.body && <p>{p.body}</p>}</li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {!filtered && (b.range?.body || page.grades.length > 0 || (b.range?.show_shapes && page.shapes.length > 0)) && (
        <section className={s.sectionTight} aria-labelledby="range-heading">
          <div className={s.wrap}>
            <h2 id="range-heading" className={c.h}>{b.range?.heading || 'Our range'}</h2>
            <RichText html={b.range?.body} className={c.prose} />
            {page.grades.length > 0 && (
              <div className={c.gradeRow}>
                {page.grades.map((g) => (
                  <Link key={g.slug} href={page.filters.grade ? filterHref(page.href, selection, 'grade', g.slug) + '#stones' : '/charts/grades'} className={c.grade} title={g.summary || undefined}>
                    <strong>{g.name}</strong>{g.summary && <span>{g.summary}</span>}
                  </Link>
                ))}
              </div>
            )}
            {b.range?.show_shapes && page.shapes.length > 0 && (
              <ul className={c.shapeGrid} role="list">
                {page.shapes.map((sh) => (
                  <li key={sh.slug}>
                    <Link href={page.filters.shape ? `${filterHref(page.href, selection, 'shape', sh.slug)}#stones` : page.href} className={c.shapeCard}>
                      {sh.img ? <HideOnError as="span" className={c.shapeImg} img={{ src: sh.img, alt: '', width: 64, height: 64, loading: 'lazy' }} /> : <span className={c.shapeImg} />}
                      <span>{sh.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {!filtered && stones}

      {(b.charts?.show_colours || b.charts?.show_sizes) && (chartColours.length > 0 || chartSizes.length > 0 || page.colourCharts.length > 0) && (
        <section className={s.sectionTight} aria-labelledby="charts-heading">
          <div className={s.wrap}>
            <h2 id="charts-heading" className={c.h}>{b.charts?.heading || 'Charts'}</h2>
            {b.charts?.show_colours && chartColours.length > 0 && (
              <>
                <h3 className={c.subh}>Colours</h3>
                <ul className={c.swatchGrid} role="list">
                  {chartColours.map((col) => (
                    <li key={col.slug}>
                      <Link href={page.filters.colour ? `${filterHref(page.href, selection, 'colour', col.slug)}#stones` : page.href} className={c.swatchCard}>
                        {col.img ? <HideOnError as="span" className={c.swatchImg} img={{ src: col.img, alt: '', width: 56, height: 56, loading: 'lazy' }} /> : <span className={c.swatchImg} />}
                        <span>{col.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {!filtered && page.colourCharts.map((chart) => (
                  <figure key={chart.src} className={c.chartImage}>
                    <img src={chart.src} alt={`${chart.name} colour chart`} loading="lazy" />
                    <figcaption>{chart.name} colour chart</figcaption>
                  </figure>
                ))}
              </>
            )}
            {b.charts?.show_sizes && chartSizes.length > 0 && (
              <>
                <h3 className={c.subh}>Shapes &amp; sizes</h3>
                <div className={c.sizeTable} role="table" aria-label="Sizes available by shape">
                  {chartSizes.map((row) => (
                    <div key={row.slug} className={c.sizeRow} role="row">
                      <span role="rowheader">{row.shape}</span>
                      <span role="cell">{row.sizes.map((z) => (/mm$/i.test(z) ? z : `${z}mm`)).join(' · ')}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {b.charts?.note && <p className={c.note}>{b.charts.note}</p>}
            <p className={c.chartLinks}>
              <Link href="/charts/shapes" className={s.linkArrow}>Shape chart <Arrow /></Link>
              <Link href="/charts/sizes" className={s.linkArrow}>Size &amp; mm → carat <Arrow /></Link>
              <Link href="/charts/grades" className={s.linkArrow}>Quality grades <Arrow /></Link>
            </p>
          </div>
        </section>
      )}

      {!filtered && (stockRows.length > 0 || b.stock?.custom) && (
        <section className={s.sectionTight} aria-labelledby="stock-heading">
          <div className={s.wrap}>
            <h2 id="stock-heading" className={c.h}>{b.stock?.heading || 'Ready stock & custom orders'}</h2>
            {stockRows.length > 0 && (
              <dl className={c.facts}>{stockRows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            )}
            {b.stock?.custom && <p className={c.prose}>{b.stock.custom}</p>}
          </div>
        </section>
      )}

      <section className={s.section} aria-labelledby="cta-heading">
        <div className={s.wrap}>
          <div className={s.band}>
            <h2 id="cta-heading">{b.cta?.heading || `Request the full ${page.name} catalogue`}</h2>
            {b.cta?.text && <p>{b.cta.text}</p>}
            <div className={s.heroActions} style={{ justifyContent: 'center' }}>
              <Link href={requestHref} className={s.btn}>Request catalogue <Arrow /></Link>
              {wa && <a href={wa} className={s.btnGhost} target="_blank" rel="noopener noreferrer"><WhatsApp size={18} /> WhatsApp</a>}
            </div>
          </div>
        </div>
      </section>

      {page.siblings.length > 1 && (
        <nav className={`${s.wrap} ${c.siblings}`} aria-label={`More in ${page.parent?.name}`}>
          <h2>More in {page.parent?.name}</h2>
          <ul>{page.siblings.map((sib) => <li key={sib.slug}>{sib.slug === page.slug ? <span aria-current="page">{sib.name}</span> : <Link href={sib.href}>{sib.name}</Link>}</li>)}</ul>
        </nav>
      )}
    </>
  );
}
