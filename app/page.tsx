import Link from 'next/link';
import { getSettings } from '@/lib/settings';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { FullLogo } from '@/components/Logo';

// The catalogue moved to /po. This is the only page a stranger can reach, so it
// says who YOYO GEMS is and where trade buyers go -- and deliberately shows no
// categories, photos or prices, which are what the /po gate exists to protect.
export const metadata = {
  title: 'YOYO GEMS — Synthetic Gemstones',
  description: 'YOYO GEMS, Jaipur. Wholesale synthetic and fashion gemstones for the trade.'
};

export default async function LandingPage() {
  const settings = await getSettings();
  const waUrl = settings.whatsapp_number
    ? buildWhatsAppUrl(settings.whatsapp_number, `Hi YOYO GEMS, I'd like access to your catalogue.`)
    : null;

  return (
    <main className="landing">
      <div className="landing-inner">
        <FullLogo size="lg" color="#1B3A6B" />
        <p className="landing-lead">
          Wholesale synthetic and fashion gemstones, cut and supplied from Jaipur.
        </p>
        <p className="landing-note">
          Our full collection catalogue is reserved for trade buyers.
        </p>
        <Link href="/po" className="btn landing-cta">Enter the trade catalogue</Link>
        {waUrl && (
          <p className="landing-contact">
            Not a customer yet? <a href={waUrl} target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a>
          </p>
        )}
        <p className="landing-address">YOYO GEMS &middot; Jaipur, Rajasthan, India</p>
      </div>
    </main>
  );
}
