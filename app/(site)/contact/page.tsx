import { getGlobal, getMedia, getPage, telHref, toImage, whatsappHref } from '@/lib/site/public';
import { breadcrumbLd, pageMetadata, SITE_URL } from '@/lib/site/page-meta';
import { Crumbs, CtaBand, Figure, JsonLd, PageHead } from '@/components/site/PageParts';
import { Phone, Pin, Receipt, WhatsApp } from '@/components/site/icons';
import s from '@/components/site/site.module.css';
import c from '@/components/site/category.module.css';
import p from '@/components/site/pages.module.css';

export const revalidate = 3600;

export const generateMetadata = () => pageMetadata('contact', '/contact', { title: 'Contact' });

export default async function ContactPage() {
  const [page, g] = await Promise.all([getPage('contact'), getGlobal()]);
  const ct = g.contact || {};
  const wa = whatsappHref(ct.whatsapp, ct.whatsapp_message);
  const tel = telHref(ct.phone);
  const mapUrl = page.visit?.map_url || (ct.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ct.address)}` : null);
  const photo = page.visit?.image ? toImage((await getMedia([page.visit.image])).get(page.visit.image), 'YOYO GEMS office, Jaipur') : null;

  return (
    <>
      <Crumbs trail={[{ name: 'Home', href: '/' }, { name: 'Contact' }]} />
      <PageHead title={page.hero?.heading || 'Contact'} intro={page.hero?.intro} />
      <section className={s.sectionTight} style={{ paddingTop: 0 }} aria-label="Ways to reach us">
        <div className={`${s.wrap} ${s.contactGrid} ${p.contactCards}`}>
          {wa && (
            <a href={wa} className={s.contactItem} target="_blank" rel="noopener noreferrer">
              <span className={s.contactIcon}><WhatsApp size={20} /></span>
              <span><strong>WhatsApp</strong><span>Fastest reply. Send your list or a photo.</span></span>
            </a>
          )}
          {ct.phone && (
            <a href={tel || undefined} className={s.contactItem}>
              <span className={s.contactIcon}><Phone /></span>
              <span><strong>{ct.phone}</strong><span>{ct.hours || 'Call us'}</span></span>
            </a>
          )}
          {ct.email && (
            <a href={`mailto:${ct.email}`} className={s.contactItem}>
              <span className={s.contactIcon} aria-hidden="true">@</span>
              <span><strong>{ct.email}</strong><span>Email</span></span>
            </a>
          )}
          {ct.gst_note && (
            <div className={s.contactItem}>
              <span className={s.contactIcon}><Receipt /></span>
              <span><strong>GST registered</strong><span>{ct.gst_note}</span></span>
            </div>
          )}
        </div>
      </section>
      {(ct.address || page.visit?.text) && (
        <section className={s.sectionTight} style={{ paddingTop: 0 }} aria-labelledby="visit-heading">
          <div className={`${s.wrap} ${photo ? p.storyGrid : ''}`}>
            <div className={c.panel}>
              <h2 id="visit-heading" className={c.h}>{page.visit?.heading || 'Visiting us'}</h2>
              {ct.address && <address className={p.address}><Pin size={18} /> <span>{ct.address}</span></address>}
              {page.visit?.text && <p className={c.prose}>{page.visit.text}</p>}
              {mapUrl && <p style={{ marginTop: 14 }}><a href={mapUrl} className={s.linkArrow} target="_blank" rel="noopener noreferrer">Open in Maps →</a></p>}
            </div>
            {photo && <Figure image={photo} sizes="(min-width: 900px) 45vw, 100vw" />}
          </div>
        </section>
      )}
      <CtaBand heading={page.cta?.heading || 'Get the full digital catalogue'} text={page.cta?.text} button={page.cta?.button} />
      <JsonLd data={[
        breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Contact', path: '/contact' }]),
        { '@context': 'https://schema.org', '@type': 'ContactPage', url: `${SITE_URL}/contact`, name: page.hero?.heading || 'Contact' }
      ]} />
    </>
  );
}
