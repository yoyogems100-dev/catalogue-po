/** A stone outline with its holes, for a hole count that has no photo yet. */
export default function HoleDots({ count, size = 44 }: { count: number; size?: number }) {
  const spots = count === 1 ? [[22, 13]] : count === 2 ? [[14, 13], [30, 13]] : [[11, 15], [22, 11], [33, 15]];
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} aria-hidden="true" className="hole-dots">
      <path d="M8 6h28l6 9-20 26L2 15z" fill="#eef1f6" stroke="#8a94a6" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2 15h40M8 6l6 9 8-9 8 9 6-9M14 15l8 26 8-26" fill="none" stroke="#c3cad6" strokeWidth="0.9" />
      {spots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.6" fill="#141418" stroke="#fff" strokeWidth="0.9" />)}
    </svg>
  );
}
