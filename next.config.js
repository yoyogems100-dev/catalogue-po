/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: { '/api/categories/*/size-chart': ['./public/moissanite-shapes/*.png'] },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }
    ]
  }
};

module.exports = nextConfig;
