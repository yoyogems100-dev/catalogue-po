/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    // The shared shape photos too: a shape with no category-specific photo
    // falls back to its own reference photo (e.g. Moissanite Tapered Baguette).
    // The illustrated G-Series price list prints colour and shape photos.
    '/api/admin/pricing/pdf': ['./public/reference/colors/crushed-ice/*', './public/reference/stones/*', './public/moissanite-shapes/*.png'],
    '/api/categories/*/size-chart': ['./public/moissanite-shapes/*.png', './public/reference/stones/*'],
    // assets/fonts is the watermark typeface. It is read from disk at
    // request time by every route that stores a photo, so without this trace they get ENOENT in
    // production while working perfectly here -- the same failure the PDFKit
    // font trace above exists to prevent.
    '/api/**': ['./node_modules/pdfkit/js/standard-fonts/**', './node_modules/pdfkit/js/data/**', './public/brand/yoyo-gems-pdf-wordmark.png', './assets/fonts/*.ttf']
  },
  // The catalogue used to live at the site root. Bookmarks, WhatsApp links and
  // order PDFs sent before the move still point at those addresses, so they
  // are forwarded to the same page under /po (query string kept) rather than
  // 404ing. Done here, not in middleware, so they cost no function call; the
  // /po page then asks a signed-out visitor to sign in as before.
  async redirects() {
    return ['/category', '/cart', '/browse', '/account'].flatMap((p) => [
      { source: p, destination: `/po${p}`, permanent: true },
      { source: `${p}/:path*`, destination: `/po${p}/:path*`, permanent: true }
    ]);
  },
  // Filtered category views (?shape=, ?size=, ?colour=, ?grade=) are the
  // plain cached page filtered in the browser: tell search engines not to
  // index them. Their HTML already names the plain URL as canonical, and
  // robots.txt asks crawlers not to fetch them at all. A static header, so it
  // costs no function call.
  async headers() {
    return ['shape', 'size', 'colour', 'grade'].map((key) => ({
      source: '/products/:path*',
      has: [{ type: 'query', key }],
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, follow' }]
    }));
  },
  images: {
    // Website pictures are resized through /_next/image (lib/site/optimize.ts).
    // Uploaded files get new names, so a long cache is safe and keeps the
    // number of re-optimisations low. When replacing a file in /public, give
    // it a new name, or the old picture can be served for up to 31 days.
    minimumCacheTTL: 2678400,
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }
    ]
  }
};

module.exports = nextConfig;
