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
    return (
      <Link href="/account/orders" className="account-menu-trigger">
        <UserIcon />
        <span>{customerName || 'My Orders'}</span>
      </Link>
    );
  }

  return (
    <div className="account-menu">
      <button type="button" className="account-menu-trigger" onClick={() => setOpen(!open)}>
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
