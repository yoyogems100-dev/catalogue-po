import './globals.css';

export const metadata = {
  title: 'YOYO GEMS — Collection Catalogue',
  description: 'Wholesale gemstone catalogue'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
