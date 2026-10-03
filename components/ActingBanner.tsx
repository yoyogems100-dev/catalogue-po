'use client';

import { useState } from 'react';
import CustomerSwitcher, { switchCustomer } from './CustomerSwitcher';

/** The gold strip on the account pages while ordering for someone else. */
export default function ActingBanner({ customerName, selfName }: { customerName: string | null; selfName: string }) {
  const [switching, setSwitching] = useState(false);
  return (
    <div className="acting-banner" role="status">
      <span>Ordering for <strong>{customerName || 'this customer'}</strong></span>
      <button type="button" onClick={() => setSwitching(true)}>Switch</button>
      <button type="button" onClick={() => switchCustomer(null)}>Back to {selfName}</button>
      {switching && <CustomerSwitcher onClose={() => setSwitching(false)} />}
    </div>
  );
}
