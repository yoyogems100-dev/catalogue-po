import type { ReactNode } from 'react';
import { splitUsual } from '@/lib/usual-picks';

/**
 * <option>s for a native <select>, with this buyer's usual ones (lib/usual-picks)
 * first under a "Their usual" group, then their last order's. With none saved, the plain list as before.
 */
export default function UsualOptions<T extends { id: number }>({ options, usualIds, recentIds, render, label = 'Their usual', recentLabel = 'Their last order' }: {
  options: T[];
  usualIds: readonly number[] | null | undefined;
  /** From the buyer's last order: a group of its own after the saved ones. */
  recentIds?: readonly number[] | null;
  render: (option: T) => ReactNode;
  label?: string;
  recentLabel?: string;
}) {
  const [usual, recent, rest] = splitUsual(options, usualIds, recentIds);
  if (!usual.length && !recent.length) return <>{options.map(render)}</>;
  return <>
    {usual.length > 0 && <optgroup label={label}>{usual.map(render)}</optgroup>}
    {recent.length > 0 && <optgroup label={recentLabel}>{recent.map(render)}</optgroup>}
    {rest.length > 0 && <optgroup label="All">{rest.map(render)}</optgroup>}
  </>;
}
