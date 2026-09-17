'use client';

import { useEffect, useRef, useState } from 'react';
import HeaderLogo from './HeaderLogo';
import AccountMenu from './AccountMenu';
import CartBag from './CartBag';

// A single-row, logo-left navbar -- the hero used to center a large logo
// below the icon row, which forced a tall header just to leave room for it.
// The slim floating topbar (same layout, smaller logo) stays invisible until
// this hero scrolls out of view, then fades in.
export default function HomeHero({ loggedIn, customerName }: { loggedIn: boolean; customerName: string | null }) {
  const heroRef = useRef<HTMLDivElement>(null);
  const [showTopbar, setShowTopbar] = useState(false);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowTopbar(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className={`topbar topbar-floating ${showTopbar ? 'topbar-visible' : ''}`}>
        <HeaderLogo height={26} />
        <div className="topbar-actions">
          <CartBag />
          <AccountMenu loggedIn={loggedIn} customerName={customerName} />
        </div>
      </div>
      <div className="hero hero-compact" ref={heroRef}>
        <HeaderLogo height={40} />
        <div className="topbar-actions">
          <CartBag />
          <AccountMenu loggedIn={loggedIn} customerName={customerName} />
        </div>
      </div>
    </>
  );
}
