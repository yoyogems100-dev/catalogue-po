import Link from 'next/link';

// UI/UX audit: the breadcrumb's "house" was a literal emoji glyph -- not a
// consistent icon across platforms/fonts, and not paired with real text for
// assistive tech beyond the adjacent "Home" word. A real inline SVG plus text
// keeps it visually similar but reliable everywhere.
export default function BreadcrumbHome() {
  return (
    <Link href="/" className="breadcrumb-home-link">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
      </svg>
      Home
    </Link>
  );
}
