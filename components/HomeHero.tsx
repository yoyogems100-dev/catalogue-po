'use client';

import { useEffect, useRef, useState } from 'react';
import HeaderLogo from './HeaderLogo';

// The full hero (with the large logo) is the only header shown on first load.
// The slim topbar is fixed-position and stays invisible until the hero has
// scrolled out of view, then fades/slides in -- avoiding showing the same
// logo twice on screen at once, and freeing up space on mobile.
export default function HomeHero() {
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
      </div>
      <div className="hero hero-compact" ref={heroRef}>
        <div className="eyebrow">Digital Catalogue</div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <HeaderLogo height={88} />
        </div>
        <div className="hero-divider" />
      </div>
    </>
  );
}
