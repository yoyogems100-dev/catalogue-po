'use client';

import { useEffect, useRef, useState } from 'react';
import HeaderLogo from './HeaderLogo';
import AccountMenu from './AccountMenu';
import CartBag from './CartBag';
import QuickOrderButton from './QuickOrderButton';

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
          <QuickOrderButton />
          <CartBag />
          <AccountMenu loggedIn={loggedIn} customerName={customerName} />
        </div>
      </div>
      {/* Quick Order writes straight to the local cart and needs no account,
          so it belongs on the public home page for everyone -- it used to
          appear only in the signed-in account header, which is the one place
          a first-time buyer never sees. */}
      <div className="hero hero-compact" ref={heroRef}>
        <HeaderLogo height={40} />
        <div className="topbar-actions">
          {/* This one also answers the home page's colour chips. */}
          <QuickOrderButton listenForColorStart />
          <CartBag />
          <AccountMenu loggedIn={loggedIn} customerName={customerName} />
        </div>
      </div>
    </>
  );
}
