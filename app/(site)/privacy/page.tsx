import Link from 'next/link';
import { getGlobal, telHref, whatsappHref } from '@/lib/site/public';
import { breadcrumbLd, pageMetadata } from '@/lib/site/page-meta';
import { Crumbs, JsonLd, PageHead } from '@/components/site/PageParts';
import s from '@/components/site/site.module.css';
import c from '@/components/site/category.module.css';
import p from '@/components/site/pages.module.css';

export const revalidate = 3600;

export const generateMetadata = () =>
  pageMetadata('privacy', '/privacy', {
    title: 'Privacy policy',
    description: 'What YOYO GEMS collects when you request the catalogue or use a trade account, why, and how to have it corrected or deleted.'
  });

// Describes only what the code actually does: the Request Catalogue form
// (app/api/site/lead), the trade account and orders under /po, and the
// browser storage the site uses. Update it when any of those change.
export default async function PrivacyPage() {
  const g = await getGlobal();
  const phone = g.contact?.phone;
  const wa = whatsappHref(g.contact?.whatsapp, 'Hello YOYO GEMS, I have a question about my data.');

  return (
    <>
      <Crumbs trail={[{ name: 'Home', href: '/' }, { name: 'Privacy policy' }]} />
      <PageHead title="Privacy policy" intro="What we collect, why we collect it, and how you can have it corrected or deleted." />
      <section className={s.sectionTight} style={{ paddingTop: 0 }}>
        <div className={s.wrap}>
          <div className={`${c.prose} ${p.legal}`}>
            <p><strong>Last updated: 30 September 2026.</strong> This policy covers www.yoyogems.co.in, run by YOYO GEMS, A-13 Sethi Colony, Jaipur 302004, Rajasthan, India.</p>

            <h2 className={c.h}>What we collect</h2>
            <ul>
              <li><strong>When you request the catalogue:</strong> your name, business name and city, WhatsApp number, the categories you are interested in and, if you give it, your monthly requirement.</li>
              <li><strong>When you use a trade account or send a requirement:</strong> your name, phone number, business details, the items and quantities you ask for, and notes you add.</li>
              <li><strong>To stop spam:</strong> a one-way scrambled code made from your internet address, so we can limit repeated form submissions. We cannot recover your address from it.</li>
            </ul>

            <h2 className={c.h}>Why we use it</h2>
            <p>Only to send you the catalogue, reply to your enquiry, confirm price and availability, and process and deliver your orders. We contact you on WhatsApp or by phone. We do not sell or rent your details, and we do not use them for advertising.</p>

            <h2 className={c.h}>Cookies and browser storage</h2>
            <p>If you sign in to a trade account, we set a cookie that keeps you signed in. Your browser also remembers your light or dark theme choice and any items in your requirement list. We do not use advertising or tracking cookies.</p>

            <h2 className={c.h}>Where it is stored and who can see it</h2>
            <p>Your details are stored with our hosting and database providers (Vercel and Supabase), on servers in India where available. Only the YOYO GEMS team can see them. We share order details with courier partners only as needed to deliver your goods, or when the law requires us to.</p>

            <h2 className={c.h}>How long we keep it</h2>
            <p>We keep enquiries and orders for as long as we are doing business with you, and order records for as long as tax and accounting law requires.</p>

            <h2 className={c.h}>Your choices</h2>
            <p>You can ask us to show you, correct or delete the details we hold about you, or to stop contacting you. We will reply within 30 days. Order records that tax law requires us to keep cannot be deleted before that period ends.</p>

            <h2 className={c.h}>Contact</h2>
            <p>
              For any privacy question or complaint, contact YOYO GEMS
              {phone && <> on <a href={telHref(phone)}>{phone}</a></>}
              {wa && <>, on <a href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a></>}
              , or write to A-13 Sethi Colony, Jaipur 302004, Rajasthan. You can also reach us from the <Link href="/contact">contact page</Link>.
            </p>
          </div>
        </div>
      </section>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Privacy policy', path: '/privacy' }])} />
    </>
  );
}
