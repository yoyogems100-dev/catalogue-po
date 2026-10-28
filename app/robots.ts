import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site/page-meta';

// The public website is open to search engines. The trade catalogue, customer
// accounts, admin and API are private and stay out of search results.
// Filtered category URLs (/products/cz?shape=round&colour=…) are blocked:
// they are the same cached page filtered in the browser, and walking every
// combination is what had Amazonbot request /products/cz ~22,000 times.
// A few crawlers that send no customers are kept out entirely.
const BLOCKED_BOTS = ['Amazonbot', 'PetalBot', 'DotBot'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: BLOCKED_BOTS, disallow: '/' },
      { userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/po', '/login', '/products/*?*'] }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
