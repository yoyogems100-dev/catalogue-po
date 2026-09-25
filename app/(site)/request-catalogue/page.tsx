import { unstable_cache } from 'next/cache';
import { getGlobal, getPage, whatsappHref } from '@/lib/site/public';
import { breadcrumbLd, pageMetadata } from '@/lib/site/page-meta';
import { leadCategoryGroups } from '@/lib/site/lead-choices';
import { Crumbs, JsonLd } from '@/components/site/PageParts';
import RequestForm from '@/components/site/RequestForm';
import { WhatsApp } from '@/components/site/icons';
import s from '@/components/site/site.module.css';
import c from '@/components/site/category.module.css';
import p from '@/components/site/pages.module.css';

export const revalidate = 3600;

export const generateMetadata = () => pageMetadata('request-catalogue', '/request-catalogue', { title: 'Request the Catalogue' });

const getGroups = unstable_cache(leadCategoryGroups, ['site-lead-categories'], { revalidate: 3600, tags: ['site'] });

export default async function RequestCataloguePage() {
  const [page, g, groups] = await Promise.all([getPage('request-catalogue'), getGlobal(), getGroups()]);
  const wa = whatsappHref(g.contact?.whatsapp, g.contact?.whatsapp_message);

  return (
    <>
      <Crumbs trail={[{ name: 'Home', href: '/' }, { name: 'Request catalogue' }]} />
      <section className={`${c.hero} ${p.head}`} aria-labelledby="rq-heading">
        <div className={`${s.wrap} ${p.requestGrid}`}>
          <div className={p.requestIntro}>
            <h1 id="rq-heading" className={c.title}>{page.hero?.heading || 'Request the digital catalogue'}</h1>
            {page.hero?.intro && <p className={p.intro}>{page.hero.intro}</p>}
            {page.hero?.promise && <p className={p.promise}>{page.hero.promise}</p>}
            {wa && (
              <p className={p.orWhatsapp}>
                Prefer to talk? <a href={wa} target="_blank" rel="noopener noreferrer"><WhatsApp size={16} /> Message us on WhatsApp</a>
              </p>
            )}
          </div>
          <RequestForm
            groups={groups}
            whatsapp={wa}
            copy={{
              button: page.form?.button || 'Request Catalogue',
              privacy: page.form?.privacy || '',
              requirement_hint: page.form?.requirement_hint || '',
              thanksHeading: page.thanks?.heading || 'Thank you. Your request is in.',
              thanksText: page.thanks?.text || '',
              whatsappLabel: page.thanks?.whatsapp_label || 'Message us on WhatsApp'
            }}
          />
        </div>
      </section>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Request catalogue', path: '/request-catalogue' }])} />
    </>
  );
}
