'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FullLogo } from './Logo';
import LoginForm from './LoginForm';

const UserIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" />
  </svg>
);

export default function AccountMenu({ loggedIn, customerName }: { loggedIn: boolean; customerName: string | null }) {
  const [open, setOpen] = useState(false);

  if (loggedIn) {
    // Both destinations (My Orders, My Info) sit behind the one account
    // trigger -- keeping the header to two elements (cart, account) instead
    // of a separate always-visible "My Orders" link crowding the row.
    return (
      <div className="account-menu account-menu-loggedin">
        <button type="button" className="account-menu-trigger" onClick={() => setOpen(!open)} aria-haspopup="dialog" aria-expanded={open}>
          <UserIcon />
          <span>{customerName || 'Account'}</span>
        </button>
        {open && (
          <>
            <div className="account-menu-backdrop" onClick={() => setOpen(false)} />
            <div className="account-menu-popover card">
              <div className="account-menu-links">
                <Link href="/account/orders" prefetch={false} onClick={() => setOpen(false)}>My Orders</Link>
                <Link href="/account/profile" prefetch={false} onClick={() => setOpen(false)}>My Info</Link>
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

  return <LoggedOutAccountMenu />;
}

// Logged-out: a proper centered modal, not a small anchored dropdown -- the
// login/signup form is too tall to hang off the header icon without either
// overlapping the hero/logo behind it or spilling into the page content
// below, which read as "cropped by the header".
function LoggedOutAccountMenu() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
  }, [open]);

  return (
    <div className="account-menu">
      <button type="button" className="account-menu-trigger" onClick={() => setOpen(true)} aria-label="Account" aria-haspopup="dialog" aria-expanded={open}>
        <UserIcon />
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="login-dialog"
          onClose={() => setOpen(false)}
          onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}
        >
          <div style={{ marginBottom: 18 }}><FullLogo size="md" color="#1B3A6B" /></div>
          <LoginForm onSuccess={() => window.location.reload()} />
        </dialog>
      )}
    </div>
  );
}
