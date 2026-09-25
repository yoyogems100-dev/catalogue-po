import type { Metadata } from 'next';
import { Jost, Playfair_Display } from 'next/font/google';
import SiteHeader from '@/components/site/SiteHeader';
import SiteFooter from '@/components/site/SiteFooter';
import { WhatsApp } from '@/components/site/icons';
import { getGlobal, getMedia, getNavTree, whatsappHref } from '@/lib/site/public';
import { mediaSrc } from '@/lib/site/media-url';
import s from '@/components/site/site.module.css';

const serif = Playfair_Display({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-serif', display: 'swap' });
const sans = Jost({ subsets: ['latin'], weight: ['300', '400', '500', '600'], variable: '--font-sans', display: 'swap' });

const SITE_URL = 'https://www.yoyogems.co.in';

export async function generateMetadata(): Promise<Metadata> {
  const g = await getGlobal();
  const template = g.seo?.title_template?.includes('%s') ? g.seo.title_template : '%s · YOYO GEMS®';
  const og = g.seo?.image ? (await getMedia([g.seo.image])).get(g.seo.image) : null;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `YOYO GEMS® — ${g.brand?.tagline || 'Synthetic Gemstones'}`, template },
    description: g.seo?.description,
    openGraph: { siteName: 'YOYO GEMS®', type: 'website', locale: 'en_IN', images: og ? [{ url: mediaSrc(og, 1600), alt: og.alt }] : undefined },
    twitter: { card: 'summary_large_image' }
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [g, categories] = await Promise.all([getGlobal(), getNavTree()]);
  const wa = whatsappHref(g.contact?.whatsapp, g.contact?.whatsapp_message);
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'YOYO GEMS',
    url: SITE_URL,
    slogan: g.brand?.tagline,
    telephone: g.contact?.phone || undefined,
    email: g.contact?.email || undefined,
    address: { '@type': 'PostalAddress', streetAddress: 'A-13 Sethi Colony', addressLocality: 'Jaipur', postalCode: '302004', addressRegion: 'Rajasthan', addressCountry: 'IN' },
    sameAs: (g.social?.links || []).map((l: any) => l.url).filter(Boolean)
  };
  return (
    <div className={`${s.root} ${serif.variable} ${sans.variable}`}>
      <a href="#main" className={s.skip}>Skip to content</a>
      <SiteHeader categories={categories} ctaLabel={g.header?.cta_label || 'Request Catalogue'} showTradeLogin={g.header?.show_trade_login !== false} whatsappHref={wa} />
      <main id="main" className={s.main}>{children}</main>
      <SiteFooter global={g} categories={categories} />
      {wa && (
        <a href={wa} className={s.waFloat} target="_blank" rel="noopener noreferrer" aria-label="Chat with YOYO GEMS on WhatsApp">
          <WhatsApp size={28} />
        </a>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(org).replace(/</g, '\\u003c') }} />
    </div>
  );
}
