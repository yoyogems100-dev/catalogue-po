import type { ReactNode } from 'react';
import { splitUsual } from '@/lib/usual-picks';

/**
 * <option>s for a native <select>, with this buyer's usual ones (lib/usual-picks)
 * first under a "Their usual" group. With none saved, the plain list as before.
 */
export default function UsualOptions<T extends { id: number }>({ options, usualIds, render, label = 'Their usual' }: {
  options: T[];
  usualIds: readonly number[] | null | undefined;
  render: (option: T) => ReactNode;
  label?: string;
}) {
  const [usual, rest] = splitUsual(options, usualIds);
  if (!usual.length) return <>{options.map(render)}</>;
  return <>
    <optgroup label={label}>{usual.map(render)}</optgroup>
    {rest.length > 0 && <optgroup label="All">{rest.map(render)}</optgroup>}
  </>;
}
