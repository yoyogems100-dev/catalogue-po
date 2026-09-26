import { getGlobal, getPage, whatsappHref } from '@/lib/site/public';
import { breadcrumbLd, pageMetadata, SITE_URL } from '@/lib/site/page-meta';
import { Crumbs, CtaBand, JsonLd, PageHead } from '@/components/site/PageParts';
import RichText from '@/components/site/RichText';
import s from '@/components/site/site.module.css';
import c from '@/components/site/category.module.css';
import p from '@/components/site/pages.module.css';

export const revalidate = 3600;

export const generateMetadata = () => pageMetadata('how-to-order', '/how-to-order', { title: 'How to order' });

export default async function HowToOrderPage() {
  const [page, g] = await Promise.all([getPage('how-to-order'), getGlobal()]);
  const steps = (page.steps?.items || []).filter((x: any) => x.title);
  const title = page.hero?.heading || 'How to order';

  return (
    <>
      <Crumbs trail={[{ name: 'Home', href: '/' }, { name: 'How to order' }]} />
      <PageHead title={title} intro={page.hero?.intro} />
      <section className={s.sectionTight} style={{ paddingTop: 0 }} aria-label="Steps">
        <div className={s.wrap}>
          <ol className={p.steps}>
            {steps.map((x: any, i: number) => (
              <li key={i} className={p.step}>
                <span className={`${p.stepNo} ${s.gradientText}`} aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <div><h2>{x.title}</h2>{x.text && <p>{x.text}</p>}</div>
              </li>
            ))}
          </ol>
          {page.note?.text && <RichText html={page.note.text} className={`${c.prose} ${p.note}`} />}
        </div>
      </section>
      <CtaBand heading={page.cta?.heading || 'Start with the catalogue'} text={page.cta?.text} button={page.cta?.button}
        whatsapp={whatsappHref(g.contact?.whatsapp, g.contact?.whatsapp_message)} />
      <JsonLd data={[
        breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'How to order', path: '/how-to-order' }]),
        { '@context': 'https://schema.org', '@type': 'HowTo', name: title, url: `${SITE_URL}/how-to-order`,
          step: steps.map((x: any, i: number) => ({ '@type': 'HowToStep', position: i + 1, name: x.title, text: x.text || x.title })) }
      ]} />
    </>
  );
}
