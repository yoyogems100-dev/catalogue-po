'use client';

import { useEffect, useRef } from 'react';

/**
 * Runs `load` now and every `ms` while the tab is on screen. A tab left open in
 * the background stops asking; the moment it is shown again it loads at once,
 * so what you see is as current as before.
 */
export function useVisiblePolling(load: () => unknown, ms: number) {
  const latest = useRef(load);
  latest.current = load;
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const run = () => { void latest.current(); };
    const start = () => { if (!timer) timer = setInterval(run, ms); };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') { run(); start(); } else stop();
    };
    run();
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [ms]);
}
