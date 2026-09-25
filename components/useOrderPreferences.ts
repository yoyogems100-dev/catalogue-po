'use client';

import { useEffect, useState } from 'react';
import type { OrderPreference } from '@/lib/customer-preferences';

// One request per page load, shared by every component that asks: the header's
// Quick Order, the home colour chips and the category composer all want the
// same list -- the buyer's usual picks with the shop defaults filling the gaps.
let pending: Promise<OrderPreference[]> | null = null;

function load(): Promise<OrderPreference[]> {
  if (!pending) {
    pending = fetch('/api/order-preferences')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => (Array.isArray(data?.preferences) ? data.preferences : []))
      .catch(() => []);
  }
  return pending;
}

export function useOrderPreferences(): OrderPreference[] {
  const [prefs, setPrefs] = useState<OrderPreference[]>([]);
  useEffect(() => {
    let live = true;
    load().then((p) => { if (live) setPrefs(p); });
    return () => { live = false; };
  }, []);
  return prefs;
}
