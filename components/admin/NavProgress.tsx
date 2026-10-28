'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// A thin bar across the top of the admin from the moment a link is tapped or
// a filter form is submitted until the next page has arrived. Admin pages are
// rendered on demand, so without it a tap looked like nothing had happened
// for as long as the page's queries took. It never replaces the page (a
// loading skeleton would, and would take focus out of the search boxes).
export default function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);

  // The new URL has rendered: done.
  useEffect(() => { setPending(false); }, [pathname, searchParams]);

  useEffect(() => {
    const here = () => window.location.pathname + window.location.search;
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname + url.search === here()) return;
      setPending(true);
    }
    function onSubmit(e: SubmitEvent) {
      // Only forms that navigate (a filter <Form action="">, or an explicit
      // method="get"). The admin's save forms have neither -- they post with
      // fetch and stay on the page.
      const form = e.target as HTMLFormElement | null;
      if (!form) return;
      const method = (form.getAttribute('method') || '').toLowerCase();
      if (method === 'get' || (form.hasAttribute('action') && method !== 'post')) setPending(true);
    }
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
    };
  }, []);

  // Never leave the bar stuck if a navigation is cancelled.
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setPending(false), 15000);
    return () => clearTimeout(t);
  }, [pending]);

  return <div className={`admin-nav-progress${pending ? ' is-active' : ''}`} role="progressbar" aria-hidden={!pending} aria-label="Loading page" />;
}
