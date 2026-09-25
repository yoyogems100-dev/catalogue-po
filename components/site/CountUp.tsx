'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCount, parseCount } from '@/lib/site/count';

// A figure that counts up from zero the first time it is on screen.
// The real value is in the page for search engines and screen readers, and
// anyone who has asked their phone to reduce motion just sees the number.
// With JavaScript on, the site layout marks <html class="js"> before paint and
// the figure stays hidden until it is ready to count, so it never flashes
// "40+" → "0+"; without JavaScript it simply shows "40+".
export default function CountUp({ value, className, duration = 1600 }: { value: string; className?: string; duration?: number }) {
  const count = parseCount(value);
  const [shown, setShown] = useState(value);
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!count || !el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) { setReady(true); return; }
    setShown(formatCount(count, 0));
    setReady(true);
    let frame = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setShown(t < 1 ? formatCount(count, count.target * eased) : value);
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(frame); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={`${className || ''} ${ready ? '' : 'count-pending'}`} ref={ref}>
      <span aria-hidden="true" style={{ fontVariantNumeric: 'tabular-nums' }}>{shown}</span>
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>{value}</span>
    </span>
  );
}
