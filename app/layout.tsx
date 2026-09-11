import './globals.css';
import { HotSellingProvider } from '@/components/HotSelling';

export const metadata = {
  title: 'YOYO GEMS — Collection Catalogue',
  description: 'Wholesale gemstone catalogue'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><HotSellingProvider>{children}</HotSellingProvider></body>
    </html>
  );
}
