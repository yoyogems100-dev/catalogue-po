import './globals.css';
import { JetBrains_Mono, Jost, Playfair_Display } from 'next/font/google';
import { HotSellingProvider } from '@/components/HotSelling';

// Self-hosted at build time: no request to Google and no render-blocking
// stylesheet. The CSS variables are used by globals.css and the website styles.
const serif = Playfair_Display({ subsets: ['latin'], variable: '--font-serif', display: 'swap' });
// Italic is only used for a few short lines, so it loads when needed rather
// than being preloaded on every page.
const serifItalic = Playfair_Display({ subsets: ['latin'], style: 'italic', variable: '--font-serif-italic', display: 'swap', preload: false });
const sans = Jost({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap', preload: false });

export const metadata = {
  title: 'YOYO GEMS — Collection Catalogue',
  description: 'Wholesale gemstone catalogue'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the website layout adds class="js" and data-site-theme to <html>
    // before React loads (see components/site/CountUp.tsx); only this element.
    <html lang="en-IN" className={`${serif.variable} ${serifItalic.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body><HotSellingProvider>{children}</HotSellingProvider></body>
    </html>
  );
}
