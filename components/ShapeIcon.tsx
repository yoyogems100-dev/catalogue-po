'use client';

// Small vector outline icons per shape family. Pure SVG paths -- crisp at any
// size, no raster assets, same approach as the logo fix. Falls back to a
// generic diamond outline for anything unmapped.
const PATHS: Record<string, JSX.Element> = {
  round: <circle cx="12" cy="12" r="9" />,
  oval: <ellipse cx="12" cy="12" rx="9" ry="6" />,
  square: <rect x="4" y="4" width="16" height="16" rx="2" />,
  cushion: <rect x="4" y="4" width="16" height="16" rx="6" />,
  marquise: <path d="M12 3 C17 7 17 17 12 21 C7 17 7 7 12 3 Z" />,
  triangle: <path d="M12 4 L20 19 L4 19 Z" />,
  octagon: <polygon points="8,4 16,4 20,8 20,16 16,20 8,20 4,16 4,8" />,
  hexagon: <polygon points="12,3 20,8 20,16 12,21 4,16 4,8" />,
  pentagon: <polygon points="12,3 21,10 17,21 7,21 3,10" />,
  diamond: <path d="M12 3 L20 12 L12 21 L4 12 Z" />,
  kite: <path d="M12 2 L17 9 L12 22 L7 9 Z" />,
  lozenge: <path d="M12 2 L18 12 L12 22 L6 12 Z" />,
  heart: <path d="M12 20 C4 14 3 8 7 5 C10 3 12 5 12 8 C12 5 14 3 17 5 C21 8 20 14 12 20 Z" />,
  star: <path d="M12 2 L14.6 8.6 L21.8 9 L16.2 13.4 L18.2 20.4 L12 16.4 L5.8 20.4 L7.8 13.4 L2.2 9 L9.4 8.6 Z" />,
  clover: (
    <>
      <circle cx="12" cy="7" r="3.4" />
      <circle cx="12" cy="17" r="3.4" />
      <circle cx="7" cy="12" r="3.4" />
      <circle cx="17" cy="12" r="3.4" />
    </>
  ),
  lily: <path d="M12 3 L14 10 L21 12 L14 14 L12 21 L10 14 L3 12 L10 10 Z" />,
  halfmoon: <path d="M14 4 A8 8 0 1 0 14 20 A6 6 0 1 1 14 4 Z" />,
  bucket: <path d="M6 6 L18 6 L15 20 L9 20 Z" />,
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
  arrow: <path d="M12 3 L18 9 L15 21 L9 21 L6 9 Z" />,
  shield: <path d="M12 3 L19 6 L19 13 C19 18 12 21 12 21 C12 21 5 18 5 13 L5 6 Z" />,
  trapezoid: <path d="M6 6 L18 6 L21 18 L3 18 Z" />,
  baguette: <rect x="5" y="8" width="14" height="8" />
};

export default function ShapeIcon({ iconKey, size = 16 }: { iconKey: string | null | undefined; size?: number }) {
  const shape = (iconKey && PATHS[iconKey]) || PATHS.diamond;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {shape}
    </svg>
  );
}
