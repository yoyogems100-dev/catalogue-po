'use client';

import { useEffect, useState } from 'react';

// A round button in the corner of long admin pages (a big photo gallery, the
// order list): near the top it jumps to the bottom, further down it jumps
// back to the top. Hidden on pages that fit on about one screen.
export default function ScrollJump() {
  const [state, setState] = useState<'none' | 'down' | 'up'>('none');

  useEffect(() => {
    let frame = 0;
    function update() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const doc = document.documentElement;
        const room = doc.scrollHeight - window.innerHeight;
        if (room < window.innerHeight * 0.75) return setState('none');
        setState(window.scrollY < room / 2 ? 'down' : 'up');
      });
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    // Pages grow after load (photos, "load more"), without any scroll.
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, []);

  if (state === 'none') return null;
  const down = state === 'down';
  return (
    <button
      type="button"
      className="admin-scroll-jump"
      aria-label={down ? 'Go to the bottom of the page' : 'Back to the top of the page'}
      title={down ? 'Go to bottom' : 'Back to top'}
      onClick={() => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: down ? document.documentElement.scrollHeight : 0, behavior: reduce ? 'auto' : 'smooth' });
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ transform: down ? undefined : 'rotate(180deg)' }}>
        <path d="M12 5v14" /><path d="M6 13l6 6 6-6" />
      </svg>
    </button>
  );
}
