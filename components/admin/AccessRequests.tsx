'use client';

import Link from 'next/link';
import { useState } from 'react';

export type AccessRequest = { id: number; name: string | null; company: string | null; phone: string | null; createdAt: string };

// Sign-up requests waiting for a PIN, at the top of the admin overview. Open
// one to set the PIN on the customer's page (that clears it), or dismiss it.
export default function AccessRequests({ initial }: { initial: AccessRequest[] }) {
  const [items, setItems] = useState(initial);
  if (!items.length) return null;

  function dismiss(id: number) {
    setItems((cur) => cur.filter((r) => r.id !== id));
    fetch(`/api/admin/customers/${id}/access-request`, { method: 'DELETE' }).catch(() => {});
  }

  return (
    <section id="access-requests" className="card access-requests" aria-labelledby="access-requests-heading">
      <h2 id="access-requests-heading">Access requests <span className="access-requests-count">{items.length}</span></h2>
      <ul>
        {items.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/customers/${r.id}`}>
              <strong>{r.name || r.company || 'No name'}</strong>
              {r.name && r.company && <span> · {r.company}</span>}
              {r.phone && <span className="mono"> · {r.phone}</span>}
              <small>{new Date(r.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })}</small>
            </Link>
            <span className="access-requests-actions">
              <Link className="btn" href={`/admin/customers/${r.id}#pw-heading`}>Set PIN</Link>
              <button type="button" className="btn-ghost" aria-label={`Dismiss request from ${r.name || r.company || r.phone}`} onClick={() => dismiss(r.id)}>Dismiss</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
