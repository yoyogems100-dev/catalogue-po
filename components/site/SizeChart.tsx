'use client';

import { useEffect, useState } from 'react';
import type { ChartShape } from '@/lib/site/chart-data';
import p from './pages.module.css';

// One shape at a time: its sizes, with the carat weight where we have one.
export default function SizeChart({ shapes, initial }: { shapes: ChartShape[]; initial: string }) {
  const [active, setActive] = useState(initial);
  useEffect(() => {
    const fromHash = () => { const h = decodeURIComponent(location.hash.slice(1)); if (shapes.some((x) => x.slug === h)) setActive(h); };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [shapes]);
  function choose(slug: string) {
    setActive(slug);
    history.replaceState(null, '', `#${slug}`);
  }
  const shape = shapes.find((x) => x.slug === active) ?? shapes[0];
  if (!shape) return null;
  const hasCt = shape.sizes.some((z) => z.ct != null);
  const hasDe = shape.sizes.some((z) => z.de != null);
  const fmt = (n: number | null) => (n == null ? '—' : `${n} ct`);

  return (
    <div className={p.sizeChart}>
      <label className={p.selectLabel} htmlFor="size-shape">Shape</label>
      <select id="size-shape" className={p.select} value={shape.slug} onChange={(e) => choose(e.target.value)}>
        {shapes.map((x) => <option key={x.slug} value={x.slug}>{x.name} ({x.sizes.length})</option>)}
      </select>
      <div className={p.tableWrap}>
        <table className={p.table}>
          <caption>{shape.name}: {shape.sizes.length} sizes</caption>
          <thead>
            <tr>
              <th scope="col">Size (mm)</th>
              {hasCt && <th scope="col">Approx. carat</th>}
              {hasDe && <th scope="col">Moissanite: diamond-equivalent</th>}
            </tr>
          </thead>
          <tbody>
            {shape.sizes.map((z) => (
              <tr key={z.mm}>
                <th scope="row">{z.mm}</th>
                {hasCt && <td>{fmt(z.ct)}</td>}
                {hasDe && <td>{fmt(z.de)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
