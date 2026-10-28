import Link from 'next/link';

// A clear way back to the catalogue home from any inner page. The logo also
// links there, but buyers don't expect that; a labelled house icon they do.
// Icon-only on narrow phones (the label is still read out), "Home" beside it
// from 480px.
export default function HomeButton() {
  return (
    <Link href="/po" className="home-btn" aria-label="Home">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3.5 10.5 12 3.5l8.5 7" />
        <path d="M5.5 9v10.5a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9" />
      </svg>
      <span className="home-btn-label" aria-hidden="true">Home</span>
    </Link>
  );
}
