import { getFaqs, getGlobal, getPage, whatsappHref } from '@/lib/site/public';
import { breadcrumbLd, pageMetadata } from '@/lib/site/page-meta';
import { richTextToPlain } from '@/lib/site/rich-text';
import { Crumbs, JsonLd, PageHead } from '@/components/site/PageParts';
import RichText from '@/components/site/RichText';
import { Chevron, WhatsApp } from '@/components/site/icons';
import Link from 'next/link';
import s from '@/components/site/site.module.css';
import c from '@/components/site/category.module.css';
import p from '@/components/site/pages.module.css';

export const revalidate = 3600;

export const generateMetadata = () => pageMetadata('faq', '/faq', { title: 'FAQ' });

export default async function FaqPage() {
  const [page, g, faqs] = await Promise.all([getPage('faq'), getGlobal(), getFaqs()]);
  const wa = whatsappHref(g.contact?.whatsapp, g.contact?.whatsapp_message);

  return (
    <>
      <Crumbs trail={[{ name: 'Home', href: '/' }, { name: 'FAQ' }]} />
      <PageHead title={page.hero?.heading || 'Frequently asked questions'} intro={page.hero?.intro} />
      <section className={s.sectionTight} style={{ paddingTop: 0 }} aria-label="Questions">
        <div className={s.wrap}>
          <div className={p.faqList}>
            {faqs.map((f, i) => (
              <details key={f.id} className={p.faq} open={i === 0}>
                <summary><h2>{f.question}</h2><Chevron size={18} /></summary>
                <RichText html={f.answer} className={c.prose} />
              </details>
            ))}
          </div>
          <div className={`${c.panel} ${p.faqCta}`}>
            <h2 className={c.h}>{page.cta?.heading || 'Still have a question?'}</h2>
            {page.cta?.text && <p className={c.prose}>{page.cta.text}</p>}
            <div className={s.heroActions}>
              {wa && <a href={wa} className={s.btn} target="_blank" rel="noopener noreferrer"><WhatsApp size={18} /> WhatsApp us</a>}
              <Link href="/request-catalogue" className={s.btnGhost}>Request Catalogue</Link>
            </div>
          </div>
        </div>
      </section>
      <JsonLd data={[
        breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'FAQ', path: '/faq' }]),
        ...(faqs.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage',
          mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: richTextToPlain(f.answer) } })) }] : [])
      ]} />
    </>
  );
}
