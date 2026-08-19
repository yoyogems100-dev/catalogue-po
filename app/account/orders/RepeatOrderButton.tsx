'use client';

import { useRouter } from 'next/navigation';

// Inline "repeat this order" shortcut for a row on the orders LIST page (the
// per-order detail page has its own equivalent). The new-order page fetches
// this order's items itself server-side, so no client-side cart staging is
// needed here.
export default function RepeatOrderButton({ orderId }: { orderId: number }) {
  const router = useRouter();

  function repeat(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/account/orders/new?from=${orderId}`);
  }

  return (
    <button type="button" className="btn-ghost account-order-repeat-btn" onClick={repeat}>
      Repeat order
    </button>
  );
}
