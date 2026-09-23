'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CART_EVENT, loadCart } from '@/lib/cart-storage';

// Header entry point to the requirement. Before this, the draft was only
// reachable from inside a category page -- a buyer could leave with lines
// pending and see no trace of them anywhere else on the site.
//
// The count is read after mount rather than rendered on the server: the cart
// lives in localStorage, so server HTML has no idea what's in it, and rendering
// a guess would flash the wrong number.
export default function CartBag() {
  const [lines, setLines] = useState<number | null>(null);

  useEffect(() => {
    const read = () => setLines(loadCart().length);
    read();
    // Same tab (the builder adding lines) and other tabs respectively.
    window.addEventListener(CART_EVENT, read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener(CART_EVENT, read);
      window.removeEventListener('storage', read);
    };
  }, []);

  const count = lines ?? 0;

  return (
    <Link
      href="/po/cart"
      className="cart-bag"
      aria-label={count ? `Your requirement, ${count} ${count === 1 ? 'line' : 'lines'}` : 'Your requirement'}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d="M6 8h12l-1 12H7L6 8Z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
      {count > 0 && <span className="cart-bag-count">{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}
