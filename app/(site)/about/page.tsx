import Link from 'next/link';
import { getGlobal, getMedia, getPage, toImage, whatsappHref } from '@/lib/site/public';
import { pageSchemas } from '@/lib/site/page-schemas';
import { collectImageIds } from '@/lib/site/schema';
import { breadcrumbLd, pageMetadata } from '@/lib/site/page-meta';
import { Crumbs, Figure, JsonLd } from '@/components/site/PageParts';
import RichText from '@/components/site/RichText';
import { Arrow, WhatsApp } from '@/components/site/icons';
import s from '@/components/site/site.module.css';
import c from '@/components/site/category.module.css';
import p from '@/components/site/pages.module.css';

export const revalidate = 3600;

export const generateMetadata = () => pageMetadata('about', '/about', { title: 'About us' });

export default async function AboutPage() {
  const [page, g] = await Promise.all([getPage('about'), getGlobal()]);
  const media = await getMedia(collectImageIds(pageSchemas.about, page));
  const img = (id: number | null | undefined, alt = '') => (id ? toImage(media.get(id), alt) : null);
  const hero = img(page.hero?.image);
  const blocks = (page.story?.blocks || []).filter((b: any) => b.heading || b.body);
  const photos = (page.photos?.items || []).map((x: any) => ({ image: img(x.image, x.caption), caption: x.caption })).filter((x: any) => x.image);
  const numbers = (page.numbers?.items || []).filter((n: any) => n.value || n.label);
  const wa = whatsappHref(g.contact?.whatsapp, g.contact?.whatsapp_message);

  return (
    <>
      <Crumbs trail={[{ name: 'Home', href: '/' }, { name: 'About us' }]} />
      <header className={p.aboutHero}>
        {hero && <div className={p.aboutHeroImg}><img src={hero.src} srcSet={hero.srcSet} sizes="100vw" alt={hero.alt} fetchPriority="high" /></div>}
        <div className={`${s.wrap} ${p.aboutHeroInner}`}>
          <h1 className={c.title}>{page.hero?.heading || 'About YOYO GEMS'}</h1>
          {page.hero?.tagline && <p className={c.promise}>{page.hero.tagline}</p>}
        </div>
      </header>

      {blocks.map((b: any, i: number) => {
        const image = img(b.image, b.heading);
        return (
          <section key={i} className={`${s.sectionTight} ${p.story}`} aria-labelledby={`story-${i}`}>
            <div className={`${s.wrap} ${image ? p.storyGrid : ''} ${image && i % 2 ? p.storyFlip : ''}`}>
              <div>
                <h2 id={`story-${i}`} className={c.h}>{b.heading}</h2>
                <RichText html={b.body} className={`${c.prose} ${p.storyText}`} />
              </div>
              {image && <Figure image={image} className={p.storyImg} sizes="(min-width: 900px) 45vw, 100vw" />}
            </div>
          </section>
        );
      })}

      {photos.length > 0 && (
        <section className={s.sectionTight} aria-labelledby="photos-heading">
          <div className={s.wrap}>
            <h2 id="photos-heading" className={c.h}>{page.photos?.heading}</h2>
            <div className={p.photoStrip} role="list">
              {photos.map((x: any, i: number) => <div role="listitem" key={i}><Figure image={x.image} caption={x.caption} sizes="(min-width: 900px) 30vw, 80vw" /></div>)}
            </div>
          </div>
        </section>
      )}

      {numbers.length > 0 && (
        <section className={s.numbers} aria-label="YOYO GEMS in numbers" style={{ marginTop: 32 }}>
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

      <section className={s.section} aria-label="Get in touch">
        <div className={s.wrap}>
          <div className={s.band}>
            <h2>{page.cta?.heading || 'That’s the whole idea. One trusted name.'}</h2>
            <div className={s.heroActions} style={{ justifyContent: 'center' }}>
              <Link href="/request-catalogue" className={s.btn}>{page.cta?.primary_label || 'Request the Digital Catalogue'} <Arrow /></Link>
              {wa && <a href={wa} className={s.btnGhost} target="_blank" rel="noopener noreferrer"><WhatsApp size={18} /> {page.cta?.secondary_label || 'Talk to us on WhatsApp'}</a>}
            </div>
          </div>
        </div>
      </section>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'About us', path: '/about' }])} />
    </>
  );
}
