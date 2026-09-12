'use client';

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

/** Keep a wide option list inside the viewport, even beside a narrow trigger. */
export function useDropdownBounds(open: boolean, root: RefObject<HTMLDivElement | null>) {
  const [style, setStyle] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      if (!root.current) return;
      const rect = root.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const start = (viewport?.offsetLeft || 0) + 12;
      const end = (viewport?.offsetLeft || 0) + (viewport?.width || document.documentElement.clientWidth) - 12;
      const width = Math.min(Math.max(rect.width, 280), Math.max(0, end - start));
      const left = Math.max(start, Math.min(rect.left, end - width));
      setStyle({ width, minWidth: 0, maxWidth: 'none', left: left - rect.left, right: 'auto', transform: 'none' });
    };
    update();
    const observer = new ResizeObserver(update);
    if (root.current) observer.observe(root.current);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [open, root]);
  return style;
}
