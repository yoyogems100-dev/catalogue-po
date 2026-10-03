'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FullLogo } from './Logo';
import LoginForm from './LoginForm';
import CustomerSwitcher, { switchCustomer } from './CustomerSwitcher';

const UserIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" />
  </svg>
);

export default function AccountMenu({ loggedIn, customerName, canSwitch = false, actingAs = null }: {
  loggedIn: boolean;
  customerName: string | null;
  /** May order for other customers -- shows "Switch customer". */
  canSwitch?: boolean;
  /** Set while ordering for someone else. */
  actingAs?: { selfName: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  if (loggedIn) {
    // Both destinations (My Orders, My Info) sit behind the one account
    // trigger -- keeping the header to two elements (cart, account) instead
    // of a separate always-visible "My Orders" link crowding the row.
    return (
      <div className="account-menu account-menu-loggedin">
        <button type="button" className={`account-menu-trigger${actingAs ? ' is-acting' : ''}`} onClick={() => setOpen(!open)} aria-haspopup="dialog" aria-expanded={open}>
          <UserIcon />
          <span>{actingAs ? `For: ${customerName || 'customer'}` : customerName || 'Account'}</span>
        </button>
        {open && (
          <>
            <div className="account-menu-backdrop" onClick={() => setOpen(false)} />
            <div className="account-menu-popover card">
              {actingAs && (
                <div className="account-acting">
                  <p>Ordering for <strong>{customerName || 'this customer'}</strong>. Orders you send are placed in their name.</p>
                  <button type="button" className="btn-ghost" onClick={() => switchCustomer(null)}>Back to {actingAs.selfName}</button>
                </div>
              )}
              {canSwitch && (
                <button type="button" className="account-switch" onClick={() => { setOpen(false); setSwitching(true); }}>
                  {actingAs ? 'Switch to another customer' : 'Switch customer'}
                </button>
              )}
              <div className="account-menu-links">
                <Link href="/po/account/orders" prefetch={false} onClick={() => setOpen(false)}>My Orders</Link>
                <Link href="/po/account/profile" prefetch={false} onClick={() => setOpen(false)}>My Info</Link>
              </div>
              <form action="/api/account/logout" method="post">
                <button type="submit" className="account-menu-logout">Log out</button>
              </form>
            </div>
          </>
        )}
        {switching && <CustomerSwitcher onClose={() => setSwitching(false)} />}
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
          aria-label="Log in or sign up"
          onClose={() => setOpen(false)}
          onCancel={(e) => { e.preventDefault(); dialog.current?.close(); }}
          // onCancel covers the browser's own Escape handling, but that fires
          // from an internal close-watcher rather than from the keydown, so it
          // is easy to lose (a focused input, a nested control). Handling the
          // key directly means Escape works wherever focus happens to be.
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); dialog.current?.close(); } }}
          onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}
        >
          {/* The sign-up form is tall enough to fill a phone screen top to
              bottom, leaving only a sliver of backdrop to tap -- without this
              button someone who opened the dialog by mistake had no obvious
              way back out. */}
          <button
            type="button"
            className="login-dialog-close"
            aria-label="Close"
            onClick={() => dialog.current?.close()}
          >
            &#10005;
          </button>
          <div style={{ marginBottom: 18 }}><FullLogo size="md" color="#1B3A6B" /></div>
          <LoginForm onSuccess={() => window.location.reload()} />
        </dialog>
      )}
    </div>
  );
}
