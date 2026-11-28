'use client';

import { useId, useMemo, useRef, useState } from 'react';
import PdfPreviewDialog, { saveBlobUrl, type PdfPreviewFile } from '@/components/admin/PdfPreview';
import { DEFAULT_WHATSAPP, type AccessoryCatalogue, type AccessoryOverrides } from '@/lib/accessories/overrides';
import { pdfSelection, picturesOf, planCatalogue, type PdfOptions } from '@/lib/accessories/pdf/plan';

// Admin > Accessories > Download PDF: pick whole shop sections or single
// categories and get the catalogue PDF for just those -- cover, contents
// (every look and category with its colours), colour finder, the category pages and a How to order page.
// Built in this browser from the saved Accessories page (names, sections,
// hidden and out-of-stock as buyers see them), so nothing runs on the server.

const DEFAULT_TITLE = 'Bracelets & Necklaces';
const DEFAULT_SUB = 'Cords, braids, leather, charms and chains';
type Quality = 'standard' | 'small';
// Longest side in px and JPEG quality, per picture kind.
const SIZES: Record<Quality, { thumb: number; cover: number; swatch: number; q: number }> = {
  standard: { thumb: 520, cover: 700, swatch: 400, q: 0.74 },
  small: { thumb: 340, cover: 460, swatch: 300, q: 0.66 }
};

const cache = new Map<string, Promise<string>>();
/** A photo as a JPEG data URL on white (react-pdf can't read WebP), kept for the visit. */
function loadJpeg(url: string, px: number, q: number): Promise<string> {
  const key = `${px}:${q}:${url}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      const bmp = await createImageBitmap(await res.blob());
      const s = Math.min(1, px / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bmp.width * s));
      canvas.height = Math.max(1, Math.round(bmp.height * s));
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close();
      return canvas.toDataURL('image/jpeg', q);
    })();
    hit.catch(() => cache.delete(key));
    cache.set(key, hit);
  }
  return hit;
}
/**
 * The site's photos carry the tiled YOYO GEMS watermark; the PDF has its own page
 * watermark, so it uses the clean copy of each photo the build keeps under c/,
 * named after the watermarked file (thumbs and category covers; swatches are never
 * marked). Falls back to the site file when there is no clean copy.
 */
const cleanOf = (url: string) => url.replace(/^\/po\/accessories\/[ft]\//, '/po/accessories/c/');
async function loadPng(url: string) {
  const blob = await (await fetch(url)).blob();
  return new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = bad; r.readAsDataURL(blob); });
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;
const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();

export default function AccessoriesPdfButton({ catalogue, overrides }: { catalogue: AccessoryCatalogue; overrides: AccessoryOverrides }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const uid = useId();
  // Everything the picker lists: sections as buyers see them, without hidden/deleted ranges and styles.
  const all = useMemo(() => pdfSelection(catalogue, overrides, new Set(catalogue.ranges.map((r) => r.id)), true), [catalogue, overrides]);
  const countOf = useMemo(() => {
    const m = new Map<string, { all: number; inStock: number }>();
    for (const s of all.styles) { const c = m.get(s.cat) || { all: 0, inStock: 0 }; c.all++; if (!s.out) c.inStock++; m.set(s.cat, c); }
    return m;
  }, [all]);
  const sections = useMemo(() => all.sections.map((s) => ({ ...s, cats: s.cats.filter((c) => countOf.get(c.id)?.all) })).filter((s) => s.cats.length), [all, countOf]);

  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [openSec, setOpenSec] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [preparedFor, setPreparedFor] = useState('');
  const [inc, setInc] = useState({ index: true, finder: true, howToOrder: true });
  const [includeOut, setIncludeOut] = useState(false);
  const [quality, setQuality] = useState<Quality>('standard');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PdfPreviewFile | null>(null);

  const busy = progress !== '';
  const pickedSections = sections.filter((s) => s.cats.some((c) => picked.has(c.id)));
  const whole = (s: (typeof sections)[number]) => s.cats.every((c) => picked.has(c.id));
  // The cover title follows the choice until it is typed over.
  const autoTitle = picked.size === 0 || pickedSections.length !== 1 ? DEFAULT_TITLE : whole(pickedSections[0]) ? pickedSections[0].name
    : pickedSections[0].cats.filter((c) => picked.has(c.id)).length === 1 ? pickedSections[0].cats.find((c) => picked.has(c.id))!.name : pickedSections[0].name;
  const autoSub = pickedSections.length === 1 ? pickedSections[0].sub : DEFAULT_SUB;
  const nCats = [...picked].filter((id) => countOf.has(id)).length;
  const nStyles = [...picked].reduce((a, id) => a + (includeOut ? countOf.get(id)?.all ?? 0 : countOf.get(id)?.inStock ?? 0), 0);

  function toggleCats(ids: string[], on: boolean) {
    setPicked((p) => { const n = new Set(p); for (const id of ids) if (on) n.add(id); else n.delete(id); return n; });
  }
  function open() {
    setError('');
    dialogRef.current?.showModal();
  }

  async function build() {
    setError('');
    setProgress('Getting ready…');
    try {
      const opt: PdfOptions = {
        title: title.trim() || autoTitle, subtitle: subtitle.trim() || autoSub, preparedFor: preparedFor.trim(), ...inc,
        whatsapp: overrides.page.whatsapp || DEFAULT_WHATSAPP,
        edition: `${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} edition`
      };
      const sel = pdfSelection(catalogue, overrides, picked, includeOut);
      const plan = planCatalogue(sel.sections, sel.styles, opt);
      if (!plan.order.length) throw new Error('Nothing to print: the chosen categories have no styles on the page.');
      const [{ pdf }, mod] = await Promise.all([import('@react-pdf/renderer'), import('@/lib/accessories/pdf/CataloguePdf')]);
      mod.registerPdfFonts(`${window.location.origin}/po/pdf`);

      const z = SIZES[quality];
      const pics = picturesOf(plan);
      const jobs: [string, number, number][] = [
        ...pics.covers.map((u) => [u, z.cover, z.q] as [string, number, number]),
        ...pics.thumbs.map((u) => [u, z.thumb, z.q] as [string, number, number]),
        ...pics.swatches.map((u) => [u, z.swatch, Math.min(0.85, z.q + 0.08)] as [string, number, number])
      ];
      const marked = new Set([...pics.covers, ...pics.thumbs]);
      const img: Record<string, string> = {};
      let done = 0, failed = 0;
      const queue = [...jobs];
      setProgress(`Loading photos 0 / ${jobs.length}`);
      await Promise.all(Array.from({ length: 8 }, async () => {
        for (let j = queue.shift(); j; j = queue.shift()) {
          try { img[j[0]] = await (marked.has(j[0]) && cleanOf(j[0]) !== j[0] ? loadJpeg(cleanOf(j[0]), j[1], j[2]).catch(() => loadJpeg(...j)) : loadJpeg(...j)); } catch { failed++; }
          done++;
          if (done % 10 === 0 || done === jobs.length) setProgress(`Loading photos ${done} / ${jobs.length}`);
        }
      }));
      img.logo = await loadPng('/po/accessories/brand/logo-white.png').catch(() => '');
      setProgress(`Building ${plural(plan.total, 'page')}…`);
      await new Promise((r) => setTimeout(r, 30));
      const React = await import('react');
      const blob = await pdf(React.createElement(mod.default, { plan, opt, img }) as any).toBlob();
      const url = URL.createObjectURL(blob);
      const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const fileName = `${safeName(`YOYO GEMS Accessories - ${opt.title}${opt.preparedFor ? ` - ${opt.preparedFor}` : ''} - ${date}`)}.pdf`;
      setPreview({ url, fileName, title: `${plural(plan.total, 'page')} · ${plural(plan.styleCount, 'style')} · ${(blob.size / 1048576).toFixed(1)} MB${failed ? ` · ${failed} photos missing` : ''}` });
    } catch (e) {
      setError((e as Error).message || 'Could not make the PDF.');
    } finally {
      setProgress('');
    }
  }
  function closePreview() {
    if (preview) { const url = preview.url; setTimeout(() => URL.revokeObjectURL(url), 10_000); }
    setPreview(null);
  }
  function download() {
    if (!preview) return;
    saveBlobUrl(preview.url, preview.fileName);
    closePreview();
    dialogRef.current?.close();
  }

  return (
    <>
      <button type="button" className="btn-ghost" onClick={open}>Download PDF</button>
      <dialog ref={dialogRef} className="price-list-dialog accpdf-dialog" aria-labelledby={`${uid}-t`} onCancel={(e) => { if (busy) e.preventDefault(); }}>
        <header className="price-list-dialog-head">
          <h2 id={`${uid}-t`}>Download PDF catalogue</h2>
          <button type="button" aria-label="Close" disabled={busy} onClick={() => dialogRef.current?.close()}>×</button>
        </header>
        <div className="price-list-dialog-body">
          <div className="accpdf-pickhead">
            <strong>Choose sections or categories</strong>
            <span>
              <button type="button" className="accpdf-link" onClick={() => setPicked(new Set(sections.flatMap((s) => s.cats.map((c) => c.id))))}>Everything</button>
              <button type="button" className="accpdf-link" onClick={() => setPicked(new Set())}>Clear</button>
            </span>
          </div>
          <ul className="accpdf-sections">
            {sections.map((s) => {
              const ids = s.cats.map((c) => c.id), n = ids.filter((id) => picked.has(id)).length;
              const expanded = openSec.has(s.id);
              const styles = ids.reduce((a, id) => a + (countOf.get(id)?.all ?? 0), 0);
              return (
                <li key={s.id}>
                  <div className="accpdf-sec">
                    <label>
                      <input type="checkbox" checked={n === ids.length} ref={(el) => { if (el) el.indeterminate = n > 0 && n < ids.length; }}
                        onChange={(e) => toggleCats(ids, e.target.checked)} />
                      <span><b>{s.name}</b><small>{plural(ids.length, 'category', 'categories')} · {plural(styles, 'style')}{n && n < ids.length ? ` · ${n} chosen` : ''}</small></span>
                    </label>
                    <button type="button" className="accpdf-more" aria-expanded={expanded}
                      onClick={() => setOpenSec((o) => { const x = new Set(o); if (x.has(s.id)) x.delete(s.id); else x.add(s.id); return x; })}>
                      {expanded ? 'Hide' : 'Pick'} <span aria-hidden>{expanded ? '▴' : '▾'}</span>
                    </button>
                  </div>
                  {expanded && (
                    <ul className="accpdf-cats">
                      {s.cats.map((c) => (
                        <li key={c.id}>
                          <label>
                            <input type="checkbox" checked={picked.has(c.id)} onChange={(e) => toggleCats([c.id], e.target.checked)} />
                            <span><em>{c.series}</em> {c.name} <small>{plural(countOf.get(c.id)?.all ?? 0, 'colour')}</small></span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="price-list-fields accpdf-fields">
            <label>
              <span>Cover title</span>
              <input value={title} placeholder={autoTitle} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              <span>Prepared for <em>optional</em></span>
              <input value={preparedFor} placeholder="e.g. Sharma Jewellers" maxLength={60} onChange={(e) => setPreparedFor(e.target.value)} />
            </label>
            <label className="accpdf-wide">
              <span>Cover line <em>optional</em></span>
              <input value={subtitle} placeholder={autoSub || DEFAULT_SUB} maxLength={90} onChange={(e) => setSubtitle(e.target.value)} />
            </label>
          </div>

          <fieldset className="accpdf-opts">
            <legend>Include</legend>
            {([['index', 'Contents (every look and category, colours as dots)'], ['finder', 'Colour finder'], ['howToOrder', 'How to order page']] as const).map(([k, label]) => (
              <label key={k}><input type="checkbox" checked={inc[k]} onChange={(e) => setInc((o) => ({ ...o, [k]: e.target.checked }))} /> {label}</label>
            ))}
            <label><input type="checkbox" checked={includeOut} onChange={(e) => setIncludeOut(e.target.checked)} /> Out-of-stock styles (marked “Out of stock”)</label>
          </fieldset>
          <fieldset className="accpdf-opts accpdf-row">
            <legend>Photos</legend>
            <label><input type="radio" name={`${uid}-q`} checked={quality === 'standard'} onChange={() => setQuality('standard')} /> Sharp</label>
            <label><input type="radio" name={`${uid}-q`} checked={quality === 'small'} onChange={() => setQuality('small')} /> Smaller file, for WhatsApp &amp; email</label>
          </fieldset>

          <p className="price-list-note">
            {nCats ? `${plural(nCats, 'category', 'categories')} · ${plural(nStyles, 'style')}. ` : 'Nothing chosen yet. '}
            Hidden styles never print. Uses the saved Accessories page: save first if you have changes.
          </p>
          {progress && <p className="accpdf-progress" role="status">{progress}</p>}
          {error && <p className="price-list-error" role="alert">{error}</p>}
        </div>
        <footer className="price-list-dialog-foot">
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => dialogRef.current?.close()}>Cancel</button>
          <button type="button" className="btn" onClick={build} disabled={busy || !nStyles}>{busy ? 'Making PDF…' : 'Make PDF'}</button>
        </footer>
      </dialog>
      <PdfPreviewDialog file={preview} onClose={closePreview} onDownload={download} downloading={false} />
    </>
  );
}
