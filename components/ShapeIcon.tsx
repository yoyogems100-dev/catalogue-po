'use client';

import type { JSX } from 'react';

// Original faceted vector references drawn for the catalogue. They stay crisp
// in dropdowns and PDFs and avoid relying on a raster stock-art sheet. The
// outside silhouette identifies the cut; the inner strokes give each icon the
// gemstone/facet treatment used throughout the catalogue.
const PATHS: Record<string, JSX.Element> = {
  round: <><circle cx="12" cy="12" r="9"/><polygon points="12,5 17,7 19,12 17,17 12,19 7,17 5,12 7,7"/><path d="M12 5v14M5 12h14M7 7l10 10M17 7 7 17"/></>,
  oval: <><ellipse cx="12" cy="12" rx="9" ry="6.5"/><ellipse cx="12" cy="12" rx="5.5" ry="4"/><path d="m3 12 9-4 9 4-9 4-9-4M7 7l5 5 5-5M7 17l5-5 5 5"/></>,
  square: <><rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><rect x="7" y="7" width="10" height="10"/><path d="M3.5 3.5 7 7m13.5-3.5L17 7m3.5 13.5L17 17M3.5 20.5 7 17m0-10 10 10M17 7 7 17"/></>,
  cushion: <><rect x="3.5" y="3.5" width="17" height="17" rx="5.5"/><rect x="7" y="7" width="10" height="10" rx="3"/><path d="M5 5l4 4m10-4-4 4m4 10-4-4M5 19l4-4m3-8v10M7 12h10"/></>,
  marquise: <><path d="M12 2.5C17.5 6.5 19.5 12 12 21.5 4.5 12 6.5 6.5 12 2.5Z"/><path d="m12 2.5-3 8.5 3 6 3-6-3-8.5M7 8l5 3 5-3M6.5 14l5.5 3 5.5-3"/></>,
  triangle: <><path d="M12 3 21 20H3Z"/><path d="m12 3-4 12h8L12 3M3 20l5-5m13 5-5-5M8 15l4 5 4-5"/></>,
  octagon: <><polygon points="8,3 16,3 21,8 21,16 16,21 8,21 3,16 3,8"/><polygon points="9,7 15,7 17,9 17,15 15,17 9,17 7,15 7,9"/><path d="M8 3l1 4m7-4-1 4m6 1-4 1m4 7-4-1m-1 6-1-4m-7 4 1-4m-6-1 4-1M3 8l4 1M9 7l6 10m0-10L9 17"/></>,
  hexagon: <><polygon points="12,2.5 20.5,7.5 20.5,16.5 12,21.5 3.5,16.5 3.5,7.5"/><polygon points="12,6.5 17,9 17,15 12,17.5 7,15 7,9"/><path d="M12 2.5v4m8.5 1L17 9m3.5 7.5L17 15m-5 6.5v-4m-8.5-1L7 15M3.5 7.5 7 9M7 9l10 6M17 9 7 15"/></>,
  pentagon: <><polygon points="12,2.5 21,9.5 17.5,21 6.5,21 3,9.5"/><polygon points="12,7 16.5,10.5 14.8,16 9.2,16 7.5,10.5"/><path d="M12 2.5V7m9 2.5-4.5 1M17.5 21 14.8 16M6.5 21l2.7-5M3 9.5l4.5 1m0 0 7.3 5m1.7-5L9.2 16"/></>,
  diamond: <><path d="M12 2.5 21 12l-9 9.5L3 12Z"/><path d="m12 2.5-4 9.5 4 5 4-5-4-9.5M3 12h18M8 12l4 9.5L16 12"/></>,
  kite: <><path d="M12 2 18 9 12 22 6 9Z"/><path d="m12 2-3 9 3 5 3-5-3-9M6 9l6 2 6-2M9 11l3 11 3-11"/></>,
  lozenge: <><path d="M12 2 19 12l-7 10-7-10Z"/><path d="m12 2-3 10 3 5 3-5-3-10M5 12h14M9 12l3 10 3-10"/></>,
  heart: <><path d="M12 21C4 15.5 2.8 9 6.8 5.5 9.5 3.2 12 5.2 12 7.8c0-2.6 2.5-4.6 5.2-2.3C21.2 9 20 15.5 12 21Z"/><path d="m12 8-4.5 3 4.5 6 4.5-6-4.5-3M5 7l2.5 4M19 7l-2.5 4M7.5 11h9M12 8v9"/></>,
  star: <><path d="M12 2 14.8 8.2 21.5 8.8 16.4 13.3 18 20 12 16.5 6 20l1.6-6.7-5.1-4.5 6.7-.6Z"/><path d="m12 2v14.5M2.5 8.8 16.4 13.3M21.5 8.8 7.6 13.3M6 20l8.8-11.8M18 20 9.2 8.2"/></>,
  clover: (
    <>
      <circle cx="12" cy="7" r="3.4" />
      <circle cx="12" cy="17" r="3.4" />
      <circle cx="7" cy="12" r="3.4" />
      <circle cx="17" cy="12" r="3.4" />
    </>
  ),
  lily: <path d="M12 3 L14 10 L21 12 L14 14 L12 21 L10 14 L3 12 L10 10 Z" />,
  halfmoon: <><path d="M15 3.5A9 9 0 1 0 15 20.5 7 7 0 1 1 15 3.5Z"/><path d="M8 5.5 11 9 7 12l4 3-3 3m3-9 4-5.5m-4 11.5 4 5.5"/></>,
  bucket: <><path d="M5 5h14l-3 16H8Z"/><path d="m5 5 4 5h6l4-5M9 10l3 11 3-11M8 21l4-11 4 11"/></>,
  rose: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
      <line x1="18.4" y1="5.6" x2="5.6" y2="18.4" />
    </>
  ),
  gourd: <path d="M12 4 C8 4 6 7 7 10 C5 12 5 16 8 18 C10 20 14 20 16 18 C19 16 19 12 17 10 C18 7 16 4 12 4 Z" />,
  arrow: <><path d="m12 2.5 7 7-3 12H8l-3-12Z"/><path d="m12 2.5-3 9 3 5 3-5-3-9M5 9.5l4 2m10-2-4 2M8 21.5l4-5 4 5"/></>,
  shield: <><path d="m12 2.5 8 3.5v7c0 5-8 8.5-8 8.5S4 18 4 13V6Z"/><path d="m12 2.5-4 8 4 6 4-6-4-8M4 6l4 4.5M20 6l-4 4.5M8 10.5h8"/></>,
  trapezoid: <><path d="M7 5h10l4 14H3Z"/><path d="m7 5 3 5h4l3-5M3 19l7-9m11 9-7-9M10 10l2 9 2-9"/></>,
  baguette: <><rect x="3" y="7" width="18" height="10" rx=".5"/><rect x="6" y="9" width="12" height="6"/><path d="m3 7 3 2m15-2-3 2m3 8-3-2M3 17l3-2m0-6 12 6m0-6L6 15"/></>
};

export default function ShapeIcon({ iconKey, size = 16 }: { iconKey: string | null | undefined; size?: number }) {
  const shape = (iconKey && PATHS[iconKey]) || PATHS.diamond;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {shape}
    </svg>
  );
}
