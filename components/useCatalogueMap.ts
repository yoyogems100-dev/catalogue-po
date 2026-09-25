'use client';

import { useEffect, useState } from 'react';
import type { CatalogueMap } from '@/lib/catalogue-map';

// Fetched once per page load, and only when something first asks for it.
let pending: Promise<CatalogueMap | null> | null = null;

export function useCatalogueMap(enabled: boolean): CatalogueMap | null {
  const [map, setMap] = useState<CatalogueMap | null>(null);
  useEffect(() => {
    if (!enabled) return;
    if (!pending) {
      pending = fetch('/api/catalogue-map')
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null)
        .then((data) => { if (!data) pending = null; return data; });
    }
    let live = true;
    pending.then((m) => { if (live) setMap(m); });
    return () => { live = false; };
  }, [enabled]);
  return map;
}
