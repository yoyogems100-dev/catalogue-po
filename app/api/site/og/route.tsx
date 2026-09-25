import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';

// The share card shown when a page is sent on WhatsApp or found in search and
// the owner has not chosen a photo for it: the page name on the brand's black
// and purple, in Playfair. /api/site/og?title=Moissanite

export const revalidate = 86400;

// A fixed-weight file: the image renderer cannot read the variable font
// the watermarks use.
let font: Promise<Buffer> | null = null;
const playfair = () => (font ??= readFile(path.join(process.cwd(), 'assets/fonts/PlayfairDisplay-SemiBold.ttf')));

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('title') || '';
  const title = raw.replace(/\s+/g, ' ').trim().slice(0, 80);
  const size = title.length > 44 ? 64 : title.length > 26 ? 78 : 96;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 72px', backgroundColor: '#0a0a0c', backgroundImage: 'radial-gradient(circle at 88% 12%, rgba(179,59,224,0.5) 0%, rgba(122,53,240,0.18) 30%, rgba(10,10,12,0) 58%)', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, fontFamily: 'Playfair', fontSize: 34, letterSpacing: 4 }}>
          YOYO GEMS<span style={{ fontSize: 16, marginTop: 2 }}>®</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ display: 'flex', width: 120, height: 5, borderRadius: 5, background: 'linear-gradient(90deg, #7a35f0, #b33be0, #e0359f)' }} />
          <div style={{ display: 'flex', fontFamily: 'Playfair', fontSize: size, lineHeight: 1.08, maxWidth: 1000 }}>
            {title || 'Synthetic Gemstones. Infinite Choices. One Trusted Name.'}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, color: '#b3adbf' }}>
          <span>{title ? 'Synthetic Gemstones. Infinite Choices. One Trusted Name.' : 'Wholesale loose gemstones · Jaipur'}</span>
          <span style={{ color: '#e7a6f2' }}>yoyogems.co.in</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: [{ name: 'Playfair', data: await playfair(), weight: 600, style: 'normal' }] }
  );
}
