'use client';

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

/**
 * Size and place an option panel: comfortably readable beside a narrow
 * trigger, and never wider than it needs to be beside a wide one.
 *
 * The width used to come from the root element's rect. The root is a
 * position:relative block div, so it spans its container -- inside an admin
 * page that meant a 260px trigger opening a 1159px panel, 91% of the screen,
 * for a list of short option names. The panel now sizes from the TRIGGER and
 * is capped, then clamped to stay on screen.
 */
const MIN_PANEL = 280;
const MAX_PANEL = 420;

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
      // Prefer the trigger's own width so the panel lines up with the control
      // the buyer actually clicked, not its full-width wrapper.
      const trigger = root.current.querySelector('button');
      const anchorWidth = trigger ? trigger.getBoundingClientRect().width : rect.width;
      const available = Math.max(0, end - start);
      const width = Math.min(Math.max(anchorWidth, MIN_PANEL), MAX_PANEL, available);
      const anchorLeft = trigger ? trigger.getBoundingClientRect().left : rect.left;
      const left = Math.max(start, Math.min(anchorLeft, end - width));
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

  // On a phone the list opens near the bottom of the screen, where the fixed
  // "Your requirement" bar covers it -- the buyer saw one option and had to
  // guess the list scrolled. Once, on open, scroll the page just enough that
  // the whole panel sits above anything pinned to the bottom, without pushing
  // the trigger itself off the top.
  useLayoutEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const el = root.current;
      const panel = el?.querySelector<HTMLElement>(':scope > .icon-select-panel, :scope > .ms-panel');
      if (!el || !panel) return;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const bar = document.querySelector<HTMLElement>('.po-summary-bar');
      const visibleBottom = viewportHeight - (bar ? bar.getBoundingClientRect().height : 0) - 8;
      const overlap = panel.getBoundingClientRect().bottom - visibleBottom;
      const room = Math.max(0, el.getBoundingClientRect().top - 72); // keep the trigger below the header
      const by = Math.min(overlap, room);
      if (by > 0) window.scrollBy({ top: by, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, root]);
  return style;
}
