'use client';

import { threeView } from '@/lib/three-view';

/**
 * A shape's line drawing from three sides -- top, side and bottom -- as on
 * the Preciosa price list (lib/three-view.ts). Plain strokes in the current
 * text colour, no background. `size` is the drawing's height; it is about
 * three times as wide, and shrinks to fit a narrower box.
 */
export default function ShapeIcon({ iconKey, size = 16 }: { iconKey: string | null | undefined; size?: number }) {
  const view = threeView(iconKey);
  return (
    <svg
      className="shape-three-view"
      width={Math.round((size * view.width) / view.height)}
      height={size}
      viewBox={`0 0 ${view.width} ${view.height}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={size < 20 ? 0.7 : 0.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d={view.d} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
