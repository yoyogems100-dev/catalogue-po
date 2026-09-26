'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WordMark } from '@/components/Logo';
import NotificationBell from '@/components/admin/NotificationBell';
import { BIN, OVERVIEW, WORKSPACES, currentHref, workspaceOf, type NavLink } from '@/components/admin/nav-config';

const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
  </svg>
);

const ExternalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
    <path d="M15 3h6v6M10 14 21 3" />
  </svg>
);

// The full link list is always tucked in a slide-out drawer (opened via the
// hamburger), on desktop as well as mobile -- a permanently-visible sidebar
// crowded the page on desktop too. The drawer switches between the two
// independent workspaces, Website and PO portal (see nav-config.ts). Home,
// the current workspace's public view, and notifications stay on the
// persistent top bar.
export default function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [ws, setWs] = useState(workspaceOf(pathname));
  useEffect(() => { setWs(workspaceOf(pathname)); }, [pathname]);

  const current = currentHref(pathname);
  const here = WORKSPACES.find((w) => w.key === workspaceOf(pathname))!;
  const shown = WORKSPACES.find((w) => w.key === ws)!;

  function close() {
    setOpen(false);
  }

  const link = (l: NavLink) => (
    <Link key={l.href} href={l.href} onClick={close} aria-current={l.href === current ? 'page' : undefined}>
      {l.label}
    </Link>
  );

  return (
    <>
      <div className="admin-mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
          <button type="button" className="admin-hamburger" onClick={() => setOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </button>
          <span className="admin-topbar-ws">{here.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Link href="/admin" className="admin-mobile-home" aria-label="Admin overview">
            <HomeIcon />
          </Link>
          <a href={here.viewHref} target="_blank" rel="noopener noreferrer" className="admin-mobile-home" aria-label={here.viewLabel} title={here.viewLabel}>
            <ExternalIcon />
          </a>
          <NotificationBell />
        </div>
      </div>

      {open && <div className="admin-nav-backdrop" onClick={close} />}

      <nav className={`admin-nav ${open ? 'admin-nav-open' : ''}`} aria-label="Admin">
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="admin-nav-logo">
          <WordMark height={20} color="#FAF8F3" />
          <button type="button" className="admin-nav-close" onClick={close} aria-label="Close menu">
            <CloseIcon />
          </button>
        </div>
        {link(OVERVIEW)}
        <div className="admin-nav-switch" role="tablist" aria-label="Workspace">
          {WORKSPACES.map((w) => (
            <button key={w.key} type="button" role="tab" aria-selected={w.key === ws} onClick={() => setWs(w.key)}>{w.label}</button>
          ))}
        </div>
        {shown.groups.map((g) => (
          <div key={g.title} className="admin-nav-group" role="group" aria-label={g.title}>
            <p className="admin-nav-heading">{g.title}</p>
            {g.links.map(link)}
          </div>
        ))}
        <a href={shown.viewHref} target="_blank" rel="noopener noreferrer" onClick={close}>{shown.viewLabel} &rarr;</a>
        <div className="admin-nav-group">
          {link(BIN)}
        </div>
        <form action="/api/admin-logout" method="post" style={{ marginTop: 12 }}>
          <button type="submit" style={{ background: 'none', border: 'none', color: '#cbd3e0', padding: '10px 24px', fontSize: 13.5, cursor: 'pointer' }}>
            Log out
          </button>
        </form>
      </nav>
    </>
  );
}
