import type { Metadata } from 'next';
import SiteHeader from '@/components/site/SiteHeader';
import SiteFooter from '@/components/site/SiteFooter';
import { WhatsApp } from '@/components/site/icons';
import { getGlobal, getMedia, getNavTree, whatsappHref } from '@/lib/site/public';
import { getPopularSearches } from '@/lib/site/seo-data';
import { mediaSrc } from '@/lib/site/media-url';
import { OG_BASE, shareCard } from '@/lib/site/page-meta';
import s from '@/components/site/site.module.css';

const SITE_URL = 'https://www.yoyogems.co.in';

export async function generateMetadata(): Promise<Metadata> {
  const g = await getGlobal();
  const template = g.seo?.title_template?.includes('%s') ? g.seo.title_template : '%s · YOYO GEMS®';
  const og = g.seo?.image ? (await getMedia([g.seo.image])).get(g.seo.image) : null;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `YOYO GEMS® — ${g.brand?.tagline || 'Synthetic Gemstones'}`, template },
    description: g.seo?.description,
    openGraph: { ...OG_BASE, images: og ? [{ url: mediaSrc(og, 1600), alt: og.alt }] : [shareCard()] },
    twitter: { card: 'summary_large_image' }
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [g, categories, autoPopular] = await Promise.all([getGlobal(), getNavTree(), getPopularSearches().catch(() => [])]);
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
    <div className={s.root}>
      <a href="#main" className={s.skip}>Skip to content</a>
      <SiteHeader categories={categories} ctaLabel={g.header?.cta_label || 'Request Catalogue'} showTradeLogin={g.header?.show_trade_login !== false} whatsappHref={wa} />
      <main id="main" className={s.main}>{children}</main>
      <SiteFooter global={g} categories={categories} autoPopular={autoPopular} />
      {wa && (
        <a href={wa} className={s.waFloat} target="_blank" rel="noopener noreferrer" aria-label="Chat with YOYO GEMS on WhatsApp">
          <WhatsApp size={28} />
        </a>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(org).replace(/</g, '\\u003c') }} />
    </div>
  );
}
