'use client';

import type { AnchorHTMLAttributes, MouseEvent } from 'react';

// A link to a filtered view of the category page being shown. A click only
// rewrites the address bar (the page re-filters itself from it), so choosing
// filters never asks the server for anything. It is still a real link (copy,
// open in a new tab); rel="nofollow" tells crawlers not to walk every filter
// combination.
export default function FilterLink({ href, replace = false, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; replace?: boolean }) {
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    window.history[replace ? 'replaceState' : 'pushState'](null, '', href);
  };
  return <a href={href} rel="nofollow" onClick={go} {...rest} />;
}
