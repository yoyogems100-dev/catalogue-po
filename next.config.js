/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/categories/*/size-chart': ['./public/moissanite-shapes/*.png'],
    // assets/fonts is the watermark typeface. It is read from disk at
    // request time, so without this trace the watermark routes get ENOENT in
    // production while working perfectly here -- the same failure the PDFKit
    // font trace above exists to prevent.
    '/api/**': ['./node_modules/pdfkit/js/standard-fonts/**', './node_modules/pdfkit/js/data/**', './public/brand/yoyo-gems-pdf-wordmark.png', './assets/fonts/*.ttf']
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }
    ]
  }
};

module.exports = nextConfig;
