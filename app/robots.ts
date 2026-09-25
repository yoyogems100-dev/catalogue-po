import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site/page-meta';

// The public website is open to search engines. The trade catalogue, customer
// accounts, admin and API are private and stay out of search results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/po', '/login'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
