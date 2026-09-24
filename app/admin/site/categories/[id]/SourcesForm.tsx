'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import s from '@/components/admin/site/site-admin.module.css';

type Source = { category_id: number; grade_id: number | null; color_ids: number[] | null };
type Named = { id: number; name: string };
type Color = Named & { hex_value: string | null; ref_photo_url: string | null };

// Which catalogue categories feed this page, which filters it shows and which
// grades apply. Shapes, sizes and colours are read live from those catalogue
// categories, so they are managed in one place (Shapes / Colors admin).
export default function SourcesForm({ siteCategoryId, filters: initialFilters, catalogue, grades, initialSources, initialGrades, colors, shapes, categoryColors, categoryShapes }: {
  siteCategoryId: number; filters: Record<string, boolean>; catalogue: Named[]; grades: Named[];
  initialSources: Source[]; initialGrades: number[]; colors: Color[]; shapes: Named[];
  categoryColors: { category_id: number; color_id: number }[]; categoryShapes: { category_id: number; shape_id: number }[];
}) {
  const router = useRouter();
  const [filters, setFilters] = useState({ shape: !!initialFilters?.shape, size: !!initialFilters?.size, colour: !!initialFilters?.colour, grade: !!initialFilters?.grade });
  const [sources, setSources] = useState<Source[]>(initialSources);
  const [gradeIds, setGradeIds] = useState<number[]>(initialGrades);
  const [adding, setAdding] = useState('');
  const [message, setMessage] = useState('');
  const [narrowing, setNarrowing] = useState<number | null>(null);

  const colorsOf = (cid: number) => categoryColors.filter((r) => r.category_id === cid).map((r) => colors.find((c) => c.id === r.color_id)).filter(Boolean) as Color[];
  const derived = useMemo(() => {
    const colorIds = new Set<number>();
    const shapeIds = new Set<number>();
    for (const src of sources) {
      categoryColors.filter((r) => r.category_id === src.category_id && (!src.color_ids || src.color_ids.includes(r.color_id))).forEach((r) => colorIds.add(r.color_id));
      categoryShapes.filter((r) => r.category_id === src.category_id).forEach((r) => shapeIds.add(r.shape_id));
    }
    return { colors: colors.filter((c) => colorIds.has(c.id)), shapes: shapes.filter((x) => shapeIds.has(x.id)) };
  }, [sources, categoryColors, categoryShapes, colors, shapes]);

  async function save() {
    setMessage('Saving…');
    const [a, b] = await Promise.all([
      fetch(`/api/admin/site/categories/${siteCategoryId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filters }) }),
      fetch(`/api/admin/site/categories/${siteCategoryId}/sources`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sources, grade_ids: gradeIds }) })
    ]);
    const err = !a.ok ? (await a.json().catch(() => ({}))).error : !b.ok ? (await b.json().catch(() => ({}))).error : null;
    setMessage(err || 'Saved. The live page uses these settings immediately.');
    if (!err) router.refresh();
  }

  const unused = catalogue.filter((c) => !sources.some((x) => x.category_id === c.id));

  return (
    <div className={s.split}>
      <div>
        <div className={s.card}>
          <h2>Catalogue categories on this page</h2>
          <p className={s.help}>Their shapes, sizes, colours and photos appear on this page. A grade here powers the grade filter (e.g. 5A Quality CZ → 5A).</p>
          {sources.map((src, i) => {
            const cat = catalogue.find((c) => c.id === src.category_id);
            const all = colorsOf(src.category_id);
            return (
              <div key={src.category_id}>
                <div className={s.sourceRow}>
                  <strong>{cat?.name || `#${src.category_id}`}</strong>
                  <select aria-label={`Grade for ${cat?.name}`} value={src.grade_id ?? ''} onChange={(e) => setSources(sources.map((x, j) => j === i ? { ...x, grade_id: e.target.value ? Number(e.target.value) : null } : x))}>
                    <option value="">No grade</option>
                    {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <span>
                    {all.length > 1 && <button type="button" className={s.linkBtn} style={{ color: 'var(--navy)' }} onClick={() => setNarrowing(narrowing === i ? null : i)}>
                      {src.color_ids ? `${src.color_ids.length} of ${all.length} colours` : 'All colours'}
                    </button>}
                    <button type="button" className={s.linkBtn} onClick={() => setSources(sources.filter((_, j) => j !== i))}>Remove</button>
                  </span>
                </div>
                {narrowing === i && (
                  <div className={s.checks} style={{ padding: '6px 0 10px' }}>
                    {all.map((c) => {
                      const on = !src.color_ids || src.color_ids.includes(c.id);
                      return <label key={c.id} className={s.toggle}><input type="checkbox" checked={on} onChange={() => {
                        const current = src.color_ids ?? all.map((x) => x.id);
                        const next = on ? current.filter((x) => x !== c.id) : [...current, c.id];
                        setSources(sources.map((x, j) => j === i ? { ...x, color_ids: next.length === all.length ? null : next } : x));
                      }} /> {c.name}</label>;
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {!sources.length && <p className={s.note}>Not linked to the catalogue yet. The page will show its text and a Request Catalogue button, without photos or filters.</p>}
          <div className={s.addRow}>
            <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Catalogue category to add">
              <option value="">Add a catalogue category…</option>
              {unused.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" className="btn-ghost" disabled={!adding} onClick={() => { setSources([...sources, { category_id: Number(adding), grade_id: null, color_ids: null }]); setAdding(''); }}>Add</button>
          </div>
        </div>
        <div className={s.card}>
          <h2>Filters shown on the page</h2>
          <div className={s.checks}>
            {(['shape', 'size', 'colour', 'grade'] as const).map((k) => (
              <label key={k} className={s.toggle}><input type="checkbox" checked={filters[k]} onChange={(e) => setFilters({ ...filters, [k]: e.target.checked })} /> {k[0].toUpperCase() + k.slice(1)}</label>
            ))}
          </div>
        </div>
        <div className={s.card}>
          <h2>Grades that apply</h2>
          <p className={s.help}>Also shown in the “Our range” block. Grades set on a catalogue link above are included automatically.</p>
          <div className={s.checks}>
            {grades.map((g) => (
              <label key={g.id} className={s.toggle}><input type="checkbox" checked={gradeIds.includes(g.id) || sources.some((x) => x.grade_id === g.id)}
                disabled={sources.some((x) => x.grade_id === g.id)}
                onChange={(e) => setGradeIds(e.target.checked ? [...gradeIds, g.id] : gradeIds.filter((x) => x !== g.id))} /> {g.name}</label>
            ))}
          </div>
        </div>
        <button type="button" className="btn" onClick={save}>Save catalogue & filters</button>
        {message && <p className={s.note} role="status">{message}</p>}
      </div>
      <div>
        <div className={s.card}>
          <h2>Visitors will see</h2>
          <p className={s.help}>From the linked catalogue categories. Change these under <a href="/admin/shapes">Shapes</a>, <a href="/admin/colors">Colors</a> or the <a href="/admin/categories">catalogue category</a>.</p>
          <p className={s.label}>{derived.shapes.length} shapes</p>
          <div className={s.derived}>{derived.shapes.map((x) => <span key={x.id}>{x.name}</span>)}</div>
          <p className={s.label} style={{ marginTop: 12 }}>{derived.colors.length} colours</p>
          <div className={s.derived}>{derived.colors.map((c) => (
            <span key={c.id}>{c.ref_photo_url ? <img className={s.swatch} src={c.ref_photo_url} alt="" /> : null}{c.name}{!c.ref_photo_url && ' (no stone photo)'}</span>
          ))}</div>
        </div>
      </div>
    </div>
  );
}
