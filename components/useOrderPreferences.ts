'use client';

import { useEffect, useState } from 'react';
import type { OrderPreference } from '@/lib/customer-preferences';
import { COLOR_FAMILIES } from '@/lib/color-family';

// One request per page load, shared by every component that asks: the header's
// Quick Order, the home colour chips and the category composer all want the
// same list -- the buyer's usual picks with the shop defaults filling the gaps
// -- and the colour buttons the shop has chosen to show.
type QuickOrderConfig = { preferences: OrderPreference[]; colorButtons: number[] };
const ALL_BUTTONS = COLOR_FAMILIES.map((f) => f.id);
let pending: Promise<QuickOrderConfig> | null = null;

function load(): Promise<QuickOrderConfig> {
  if (!pending) {
    pending = fetch('/api/order-preferences')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => ({
        preferences: Array.isArray(data?.preferences) ? data.preferences : [],
        colorButtons: Array.isArray(data?.colorButtons) ? data.colorButtons : ALL_BUTTONS
      }))
      .catch(() => ({ preferences: [], colorButtons: ALL_BUTTONS }));
  }
  return pending;
}

function useQuickOrderConfig(): QuickOrderConfig {
  const [config, setConfig] = useState<QuickOrderConfig>({ preferences: [], colorButtons: ALL_BUTTONS });
  useEffect(() => {
    let live = true;
    load().then((c) => { if (live) setConfig(c); });
    return () => { live = false; };
  }, []);
  return config;
}

export function useOrderPreferences(): OrderPreference[] {
  return useQuickOrderConfig().preferences;
}

/** Colour family IDs to offer as buttons, in the shop's order. */
export function useColorButtons(): number[] {
  return useQuickOrderConfig().colorButtons;
}
