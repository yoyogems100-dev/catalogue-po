import Link from 'next/link';
import type { ContentValue } from '@/lib/site/schema';
import type { NavCategory } from '@/lib/site/public';
import { telHref, whatsappHref } from '@/lib/site/public';
import CatThumb from './CatThumb';
import SiteLogo from './SiteLogo';
import s from './site.module.css';

export default function SiteFooter({ global, categories, autoPopular = [] }: { global: ContentValue; categories: NavCategory[]; autoPopular?: { label: string; url: string }[] }) {
  const c = global.contact || {};
  const wa = whatsappHref(c.whatsapp, c.whatsapp_message);
  // The owner's own list if they made one, else the best-photographed
  // filtered pages (see lib/site/seo.ts).
  const chosen = (global.footer?.links || []).filter((l: any) => l.label && l.url);
  const popular = chosen.length ? chosen : autoPopular;
  const social = (global.social?.links || []).filter((l: any) => l.label && l.url);
  return (
    <footer className={s.footer}>
      <div className={s.wrap}>
        <div className={s.footerGrid}>
          <div className={s.footerBrand}>
            <SiteLogo width={256} height={70} alt="YOYO GEMS® — Synthetic Gemstones. Infinite Choices. One Trusted Name." lazy />
            <p className={s.footerBlurb}>{global.footer?.blurb}</p>
          </div>
          <div className={s.footerProducts}>
            <h2>Products</h2>
            {/* Two columns of stone + name even on a phone: a single column of
                short names left most of the footer's width empty. */}
            <ul className={s.footerCats}>{categories.map((cat) => <li key={cat.id}><Link href={cat.href}><CatThumb image={cat.image} size={34} />{cat.name}</Link></li>)}</ul>
          </div>
          <div>
            <h2>Company</h2>
            <ul>
              <li><Link href="/about">About us</Link></li>
              <li><Link href="/charts">Charts</Link></li>
              <li><Link href="/quality">Quality &amp; QC</Link></li>
              <li><Link href="/how-to-order">How to order</Link></li>
              <li><Link href="/faq">FAQ</Link></li>
              <li><Link href="/contact">Contact</Link></li>
              <li><Link href="/request-catalogue">Request catalogue</Link></li>
            </ul>
          </div>
          <div>
            <h2>Contact</h2>
            <ul>
              {c.phone && <li><a href={telHref(c.phone) || undefined}>{c.phone}</a></li>}
              {wa && <li><a href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a></li>}
              {c.email && <li><a href={`mailto:${c.email}`}>{c.email}</a></li>}
              {social.map((l: any) => <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a></li>)}
            </ul>
            {c.address && <p style={{ marginTop: 10 }}>{c.address}</p>}
          </div>
        </div>
        {popular.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <h2>Popular searches</h2>
            <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '0 18px' }}>
              {popular.map((l: any) => <li key={l.url}><Link href={l.url}>{l.label}</Link></li>)}
            </ul>
          </div>
        )}
        <div className={s.footerBottom}>
          <span>© {new Date().getFullYear()} YOYO GEMS®. {global.footer?.legal}</span>
          {c.gst_note && <span>{c.gst_note}</span>}
        </div>
      </div>
    </footer>
  );
}
