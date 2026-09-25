import type { Metadata } from 'next';
import Link from 'next/link';
import { getChartTeaser, getGlobal, getMedia, getNavTree, getPage, telHref, toImage, whatsappHref } from '@/lib/site/public';
import { OG_BASE, shareImages } from '@/lib/site/page-meta';
import { Arrow, Phone, Pin, Receipt, WhatsApp } from '@/components/site/icons';
import HideOnError from '@/components/site/HideOnError';
import s from '@/components/site/site.module.css';
import { pic } from '@/lib/site/optimize';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const [home, g] = await Promise.all([getPage('home'), getGlobal()]);
  const img = home.seo?.image ? (await getMedia([home.seo.image])).get(home.seo.image) : null;
  return {
    title: home.seo?.title ? { absolute: home.seo.title } : undefined,
    description: home.seo?.description || g.seo?.description,
    alternates: { canonical: '/' },
    openGraph: { ...OG_BASE, images: shareImages(img, '') }
  };
}

export default async function HomePage() {
  const [home, g, categories, teaser] = await Promise.all([getPage('home'), getGlobal(), getNavTree(), getChartTeaser()]);
  const heroMedia = home.hero?.image ? (await getMedia([home.hero.image])).get(home.hero.image) : null;
  const hero = toImage(heroMedia, '');
  const c = g.contact || {};
  const wa = whatsappHref(c.whatsapp, c.whatsapp_message);
  const numbers = (home.numbers?.items || []).filter((n: any) => n.value || n.label);
  const columns = (home.story?.columns || []).filter((col: any) => col.title || col.text);
  const blocks = (home.why?.blocks || []).filter((b: any) => b.title);

  return (
    <>
      <section className={s.hero}>
        {hero && (
          <div className={s.heroImage}>
            <img {...pic(hero)} sizes="100vw" alt={hero.alt} fetchPriority="high" />
          </div>
        )}
        <div className={`${s.wrap} ${s.heroInner}`}>
          <h1 className={s.heroTitle}>{home.hero?.heading}</h1>
          {home.hero?.subline && <p className={s.heroSub}>{home.hero.subline}</p>}
          <div className={s.heroActions}>
            <Link href="/request-catalogue" className={s.btn}>{home.hero?.primary_label || 'Request Catalogue'}</Link>
            <Link href="/products" className={s.btnGhost}>{home.hero?.secondary_label || 'Browse Categories'}</Link>
          </div>
        </div>
      </section>

      {numbers.length > 0 && (
        <section className={s.numbers} aria-label="YOYO GEMS in numbers">
          <div className={`${s.wrap} ${s.numbersGrid}`}>
            {numbers.map((n: any, i: number) => (
              <div key={i} className={s.number}>
                <span className={`${s.numberValue} ${s.gradientText}`}>{n.value}</span>
                <span className={s.numberLabel}>{n.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={s.section} aria-labelledby="cat-heading">
        <div className={s.wrap}>
          <div className={s.sectionHead}>
            <span className={s.eyebrow}>Products</span>
            <h2 id="cat-heading" className={s.h2}>{home.categories?.heading}</h2>
            {home.categories?.intro && <p className={s.lead}>{home.categories.intro}</p>}
          </div>
          <ul className={s.catGrid} role="list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {categories.map((cat) => (
              <li key={cat.id} className={s.reveal}>
                <Link href={cat.href} className={s.catTile}>
                  <div className={s.catImg}>
                    {cat.image
                      ? <img {...pic(cat.image)} sizes="(min-width: 900px) 25vw, 50vw" alt={cat.image.alt} loading="lazy" decoding="async" />
                      : <div className={s.catImgEmpty} />}
                  </div>
                  <div className={s.catBody}>
                    <span className={s.catName}>{cat.name}</span>
                    {cat.descriptor && <span className={s.catDesc}>{cat.descriptor}</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {columns.length > 0 && (
        <section className={s.sectionTight} aria-labelledby="story-heading">
          <div className={s.wrap}>
            <div className={s.sectionHead}>
              <span className={s.eyebrow}>One-stop supply</span>
              <h2 id="story-heading" className={s.h2}>{home.story?.heading}</h2>
            </div>
            <div className={s.story}>
              {columns.map((col: any, i: number) => (
                <div key={i} className={`${s.storyCol} ${s.reveal}`}>
                  <h3>{col.title}</h3>
                  <p>{col.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className={s.section} aria-labelledby="charts-heading">
        <div className={s.wrap}>
          <div className={s.sectionHead} style={{ marginBottom: 22 }}>
            <span className={s.eyebrow}>Charts</span>
            <h2 id="charts-heading" className={s.h2}>{home.charts?.heading}</h2>
            {home.charts?.text && <p className={s.lead}>{home.charts.text}</p>}
          </div>
          {teaser.shapes.length > 0 && (
            <div className={s.strip} role="list" aria-label="Shapes">
              {teaser.shapes.map((sh) => (
                <HideOnError key={sh.name} className={s.shape} role="listitem"
                  img={{ src: sh.src, alt: `${sh.name} cut`, width: 96, height: 96, loading: 'lazy', decoding: 'async' }}>
                  <span>{sh.name}</span>
                </HideOnError>
              ))}
            </div>
          )}
          {teaser.colors.length > 0 && (
            <div className={s.swatches} role="list" aria-label="Colours">
              {teaser.colors.map((col) => (
                <HideOnError key={col.name} as="span" className={s.swatch} role="listitem" title={col.name}
                  img={{ src: col.src, alt: col.name, width: 44, height: 44, loading: 'lazy', decoding: 'async' }} />
              ))}
            </div>
          )}
          <Link href="/charts" className={s.linkArrow}>{home.charts?.link_label || 'See all charts'} <Arrow /></Link>
        </div>
      </section>

      {blocks.length > 0 && (
        <section className={s.sectionTight} aria-labelledby="why-heading">
          <div className={s.wrap}>
            <div className={s.sectionHead}>
              <span className={s.eyebrow}>Why choose us</span>
              <h2 id="why-heading" className={s.h2}>{home.why?.heading}</h2>
            </div>
            <div className={s.why}>
              {blocks.map((b: any, i: number) => (
                <div key={i} className={`${s.whyCard} ${s.reveal}`}>
                  <h3>{b.title}</h3>
                  <ul>{(b.points || []).filter((p: any) => p.text).map((p: any, j: number) => <li key={j}>{p.text}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className={s.section} aria-labelledby="cta-heading">
        <div className={s.wrap}>
          <div className={s.band}>
            <h2 id="cta-heading">{home.cta?.heading}</h2>
            {home.cta?.text && <p>{home.cta.text}</p>}
            <Link href="/request-catalogue" className={s.btn}>{home.cta?.button || 'Request Catalogue'} <Arrow /></Link>
          </div>
        </div>
      </section>

      <section className={s.sectionTight} aria-labelledby="contact-heading" style={{ paddingTop: 0 }}>
        <div className={s.wrap}>
          <h2 id="contact-heading" className={s.h2} style={{ fontSize: 28, marginBottom: 20 }}>{home.contact?.heading}</h2>
          <div className={s.contactGrid}>
            {wa && (
              <a href={wa} className={s.contactItem} target="_blank" rel="noopener noreferrer">
                <span className={s.contactIcon}><WhatsApp size={20} /></span>
                <span><strong>WhatsApp</strong><span>Fastest reply</span></span>
              </a>
            )}
            {c.phone && (
              <a href={telHref(c.phone) || undefined} className={s.contactItem}>
                <span className={s.contactIcon}><Phone /></span>
                <span><strong>{c.phone}</strong><span>Call us</span></span>
              </a>
            )}
            {c.city_line && (
              <div className={s.contactItem}>
                <span className={s.contactIcon}><Pin /></span>
                <span><strong>Based in Jaipur</strong><span>{c.city_line}</span></span>
              </div>
            )}
            {c.gst_note && (
              <div className={s.contactItem}>
                <span className={s.contactIcon}><Receipt /></span>
                <span><strong>GST registered</strong><span>{c.gst_note}</span></span>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
