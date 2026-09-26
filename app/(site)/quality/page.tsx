import { getGlobal, getMedia, getPage, toImage, whatsappHref } from '@/lib/site/public';
import { pageSchemas } from '@/lib/site/page-schemas';
import { collectImageIds } from '@/lib/site/schema';
import { breadcrumbLd, pageMetadata } from '@/lib/site/page-meta';
import { Crumbs, CtaBand, Figure, JsonLd, PageHead } from '@/components/site/PageParts';
import RichText from '@/components/site/RichText';
import s from '@/components/site/site.module.css';
import c from '@/components/site/category.module.css';
import p from '@/components/site/pages.module.css';

export const revalidate = 3600;

export const generateMetadata = () => pageMetadata('quality', '/quality', { title: 'Quality & QC' });

export default async function QualityPage() {
  const [page, g] = await Promise.all([getPage('quality'), getGlobal()]);
  const media = await getMedia(collectImageIds(pageSchemas.quality, page));
  const img = (id: number | null | undefined, alt = '') => (id ? toImage(media.get(id), alt) : null);
  const checks = (page.checks?.items || []).filter((x: any) => x.title);
  const photos = (page.photos?.items || []).map((x: any) => ({ image: img(x.image, x.caption), caption: x.caption })).filter((x: any) => x.image);

  return (
    <>
      <Crumbs trail={[{ name: 'Home', href: '/' }, { name: 'Quality & QC' }]} />
      <PageHead title={page.hero?.heading || 'Quality & QC'} intro={page.hero?.intro} image={img(page.hero?.image, 'Stones on the checking table')} />
      {page.body?.text && (
        <section className={s.sectionTight} style={{ paddingTop: 8 }}>
          <div className={s.wrap}><RichText html={page.body.text} className={c.prose} /></div>
        </section>
      )}
      {checks.length > 0 && (
        <section className={s.sectionTight} aria-labelledby="checks-heading">
          <div className={s.wrap}>
            <h2 id="checks-heading" className={c.h}>{page.checks?.heading}</h2>
            <ol className={`${c.checks} ${p.checkGrid}`}>
              {checks.map((x: any, i: number) => <li key={i}><h3>{x.title}</h3>{x.text && <p>{x.text}</p>}</li>)}
            </ol>
          </div>
        </section>
      )}
      {photos.length > 0 && (
        <section className={s.sectionTight} aria-label="Photos">
          <div className={`${s.wrap} ${p.photoGrid}`}>
            {photos.map((x: any, i: number) => <Figure key={i} image={x.image} caption={x.caption} />)}
          </div>
        </section>
      )}
      <CtaBand heading={page.cta?.heading || 'See the full range'} text={page.cta?.text} button={page.cta?.button}
        whatsapp={whatsappHref(g.contact?.whatsapp, g.contact?.whatsapp_message)} />
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Quality & QC', path: '/quality' }])} />
    </>
  );
}
