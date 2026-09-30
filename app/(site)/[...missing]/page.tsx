import { notFound } from 'next/navigation';

// Any address the website doesn't have (a mistyped or old link) lands here and
// gets the site's own "page not found" with a real 404, inside the site's
// header and footer. Real pages, /po, /admin and /api all match first.
export default function Missing() {
  notFound();
}
