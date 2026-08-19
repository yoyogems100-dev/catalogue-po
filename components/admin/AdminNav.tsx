'use client';

import { useState } from 'react';
import Link from 'next/link';
import { WordMark } from '@/components/Logo';
import NotificationBell from '@/components/admin/NotificationBell';

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

// Desktop keeps the always-visible left sidebar this project has always had.
// On mobile that same sidebar becomes a slide-out drawer (opened via the
// hamburger button), since a full link list can't fit on a phone screen
// without either wrapping or forcing horizontal scroll -- both were reported
// as unusable. Home and the notification bell stay persistently visible on
// the compact mobile top bar rather than being tucked into the drawer, since
// they're the two things worth reaching without an extra tap.
export default function AdminNav() {
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
  }

  const links = (
    <>
      <Link href="/admin" onClick={close}>Dashboard</Link>
      <Link href="/admin/orders" onClick={close}>Orders</Link>
      <Link href="/admin/categories" onClick={close}>Categories</Link>
      <Link href="/admin/shapes" onClick={close}>Shapes</Link>
      <Link href="/admin/colors" onClick={close}>Colors</Link>
      <Link href="/admin/bulk-link" onClick={close}>Bulk Link</Link>
      <Link href="/admin/tags" onClick={close}>Tags</Link>
      <Link href="/" target="_blank" onClick={close}>View public site &rarr;</Link>
    </>
  );

  return (
    <>
      <div className="admin-mobile-topbar">
        <button type="button" className="admin-hamburger" onClick={() => setOpen(true)} aria-label="Open menu">
          <MenuIcon />
        </button>
        <Link href="/admin" className="admin-mobile-home" aria-label="Dashboard">
          <HomeIcon />
        </Link>
        <NotificationBell />
      </div>

      {open && <div className="admin-nav-backdrop" onClick={close} />}

      <nav className={`admin-nav ${open ? 'admin-nav-open' : ''}`}>
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="admin-nav-logo">
          <WordMark height={20} color="#FAF8F3" />
          <button type="button" className="admin-nav-close" onClick={close} aria-label="Close menu">
            <CloseIcon />
          </button>
          <div className="admin-nav-bell-desktop">
            <NotificationBell />
          </div>
        </div>
        {links}
        <form action="/api/admin-logout" method="post" style={{ marginTop: 20 }}>
          <button type="submit" style={{ background: 'none', border: 'none', color: '#cbd3e0', padding: '10px 24px', fontSize: 13.5, cursor: 'pointer' }}>
            Log out
          </button>
        </form>
      </nav>
    </>
  );
}
