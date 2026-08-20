'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LoginForm from './LoginForm';

const UserIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" />
  </svg>
);

export default function AccountMenu({ loggedIn, customerName }: { loggedIn: boolean; customerName: string | null }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  if (loggedIn) {
    // My Orders sits directly in the header, not behind a click -- it's the
    // single most-used destination once logged in, so it shouldn't need a
    // popover to reach. The popover (name + logout) is still one click away.
    return (
      <div className="account-menu account-menu-loggedin">
        <Link href="/account/orders" className="account-menu-orders-link">My Orders</Link>
        <button type="button" className="account-menu-trigger" onClick={() => setOpen(!open)} aria-haspopup="dialog" aria-expanded={open}>
          <UserIcon />
          <span>{customerName || 'Account'}</span>
        </button>
        {open && (
          <>
            <div className="account-menu-backdrop" onClick={() => setOpen(false)} />
            <div className="account-menu-popover card">
              <div className="account-menu-links">
                <Link href="/account/orders" onClick={() => setOpen(false)}>My Orders</Link>
              </div>
              <form action="/api/account/logout" method="post">
                <button type="submit" className="account-menu-logout">Log out</button>
              </form>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="account-menu">
      <button type="button" className="account-menu-trigger" onClick={() => setOpen(!open)} aria-label="Account" aria-haspopup="dialog" aria-expanded={open}>
        <UserIcon />
      </button>
      {open && (
        <>
          <div className="account-menu-backdrop" onClick={() => setOpen(false)} />
          <div className="account-menu-popover card">
            <LoginForm onSuccess={() => { setOpen(false); router.refresh(); }} />
          </div>
        </>
      )}
    </div>
  );
}
