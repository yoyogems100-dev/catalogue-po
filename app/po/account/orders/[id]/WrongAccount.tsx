'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// An order link (the WhatsApp updates carry one) opened on a phone that is
// signed in to a different account. Without this the order page answered with
// "page not found", which read as a broken link.

/** Signed in as someone allowed to order for others: switch to the order's buyer and show it. */
export function SwitchToOrderBuyer({ buyerId, buyerName }: { buyerId: number; buyerName: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  async function switchNow() {
    setFailed(false);
    try {
      const res = await fetch('/api/account/act-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: buyerId })
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setFailed(true);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    switchNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="po-card wrong-account-card" role="status">
      {failed ? (
        <>
          <p>Could not switch to {buyerName}&rsquo;s account.</p>
          <button type="button" className="btn" onClick={switchNow}>Try again</button>
        </>
      ) : (
        <p>Opening this order for {buyerName}&hellip;</p>
      )}
    </div>
  );
}

/** Signed in as another buyer: say so plainly and offer to sign in with the right number. */
export function OrderOnAnotherAccount({ orderId, signedInAs, adminHref }: { orderId: number; signedInAs: string; adminHref: string | null }) {
  const next = `/po/account/orders/${orderId}`;
  return (
    <div className="po-card wrong-account-card">
      <h2>This order is on another account</h2>
      <p>
        You are signed in as <strong>{signedInAs}</strong>. Order #{orderId} was placed on a different
        WhatsApp number. Sign in with that number to see it.
      </p>
      <div className="wrong-account-actions">
        <form action={`/api/account/logout?next=${encodeURIComponent(next)}`} method="post">
          <button type="submit" className="btn">Sign out and sign in again</button>
        </form>
        {adminHref && <a className="btn-ghost" href={adminHref}>Open in admin</a>}
        <a className="btn-ghost" href="/po/account/orders">My orders</a>
      </div>
    </div>
  );
}
