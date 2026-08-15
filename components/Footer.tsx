import Link from 'next/link';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { WordMark } from '@/components/Logo';

export default function Footer({ settings }: { settings: Record<string, string> }) {
  const waUrl = settings.whatsapp_number
    ? buildWhatsAppUrl(settings.whatsapp_number, `Hi YOYO GEMS, I'd like to know more about your gemstone collection.`)
    : null;
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-col">
          <WordMark height={22} color="#FAF8F3" />
          <p className="footer-tagline">Synthetic Gemstones. Infinite Choices. One Trusted Name.</p>
        </div>

        <div className="footer-col">
          <div className="footer-heading">Visit</div>
          {settings.location && <div className="footer-line">{settings.location}</div>}
          {settings.contact_name && <div className="footer-line footer-muted">{settings.contact_name}</div>}
        </div>

        <div className="footer-col">
          <div className="footer-heading">Connect</div>
          {waUrl && (
            <a href={waUrl} target="_blank" rel="noopener noreferrer" className="footer-link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.55-3.7 8.21-8.25 8.21Zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.4-.12-.56.13-.17.25-.65.81-.79.97-.15.17-.29.19-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.44.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.36-.77-1.86-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.87.86-.87 2.09 0 1.23.9 2.42 1.02 2.59.12.17 1.77 2.7 4.28 3.79.6.26 1.06.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.16-.48-.28Z" /></svg>
              Chat on WhatsApp
            </a>
          )}
          {settings.instagram_url && (
            <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="footer-link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" /></svg>
              {settings.instagram_handle || 'Instagram'}
            </a>
          )}
        </div>

        <div className="footer-col">
          <div className="footer-heading">Account</div>
          <Link href="/account/orders" className="footer-link">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
            My Orders
          </Link>
        </div>
      </div>
      <div className="footer-bottom container">&copy; {year} YOYO GEMS. All rights reserved.</div>
    </footer>
  );
}
