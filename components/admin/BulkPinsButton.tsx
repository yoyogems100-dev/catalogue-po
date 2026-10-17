'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Gives every customer who has a WhatsApp number but no PIN a random 4-digit
 * one, after a second tap to confirm, then offers the full list to download
 * and share. Each customer's PIN also shows on their own page.
 */
export default function BulkPinsButton({ withoutPin }: { withoutPin: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function run() {
    setBusy(true);
    setMessage('');
    const res = await fetch('/api/admin/customers/pins', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setConfirming(false);
    if (!res.ok) { setMessage(data.error || 'Could not set PINs. Please try again.'); return; }
    setMessage(`PINs set for ${data.created} customer${data.created === 1 ? '' : 's'}.`);
    router.refresh();
  }

  return (
    <span className="bulk-pins">
      {withoutPin > 0 && (confirming ? (
        <>
          <button type="button" className="btn" disabled={busy} onClick={run}>{busy ? 'Setting PINs…' : `Yes, set ${withoutPin} PINs`}</button>
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
        </>
      ) : (
        <button type="button" className="btn-ghost" onClick={() => setConfirming(true)}>Give PINs to {withoutPin} without one</button>
      ))}
      <a className="btn-ghost" href="/api/admin/customers/pins">Download PIN list</a>
      {message && <span role="status" className="bulk-pins-status">{message}</span>}
    </span>
  );
}
