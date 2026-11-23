// Reads the hand-built Accessories page (public/po/accessories/index.html) and
// returns its ranges and styles as plain data, without the embedded photos.
// Admin > Accessories lists, searches and exports from this; the page itself
// stays the source of truth. After adding ranges to the page, run
// `npm run accessories:index` (a test fails until lib/accessories/catalogue.json
// matches the page again).
import fs from 'node:fs';
import vm from 'node:vm';

export function extractAccessories(html) {
  // The photo maps (FILES, COVF) sit just above CATS on the current page.
  const files = html.indexOf('const FILES = {');
  const cats = html.indexOf('const CATS = [');
  const start = files >= 0 && files < cats ? files : cats;
  // Stop before the block that applies Admin edits: this reads the page as built.
  const edits = html.indexOf('/* Admin > Accessories edits');
  const end = edits >= 0 ? edits : html.indexOf('const CAT = Object.fromEntries');
  if (cats < 0 || end < cats) throw new Error('Accessories page: could not find CATS / P in index.html');
  const ctx = {};
  vm.runInNewContext(`${html.slice(start, end)}\n;globalThis.__out = { CATS, P, FAM, SHADE, FILES: typeof FILES === 'object' ? FILES : {}, COVF: typeof COVF === 'object' ? COVF : {} };`, ctx, { timeout: 20000 });
  const { CATS, P, FAM, SHADE, FILES, COVF } = ctx.__out;
  const BASE = '/po/accessories/';
  const catViews = new Map(CATS.map((c) => [c.id, c.views || []]));
  // The card picture the page shows: the first view's small webp copy under t/.
  const thumbOf = (p) => {
    const views = (p.views || catViews.get(p.cat) || []).filter(([, l]) => !/^(Original|Another) photo$/.test(l));
    const f = views.length ? FILES[`${p.sku}/${views[0][0]}`] : null;
    return f ? `${BASE}t/${f.replace(/\.\w+$/, '.webp')}` : '';
  };
  const ranges = CATS.map((c) => ({
    id: String(c.id),
    series: String(c.series || ''),
    name: String(c.name || ''),
    text: String(c.text || ''),
    finish: String(c.finish || ''),
    views: (c.views || []).map(([, label]) => String(label)),
    cover: COVF[c.id] ? `${BASE}f/${COVF[c.id]}` : ''
  }));
  const styles = P.map((p) => ({
    sku: String(p.sku),
    cat: String(p.cat),
    code: String(p.code || ''),
    name: String(p.name || ''),
    style: String(p.style || ''),
    colours: (p.colours || []).map(String),
    dots: (p.colours || []).map((c, i) => (p.dots && p.dots[i]) || SHADE[String(c).toLowerCase()] || (i === 0 && p.hex) || '#cccccc'),
    families: (p.fam || []).map((f) => FAM[f] || f),
    thumb: thumbOf(p)
  }));
  return { ranges, styles };
}

export function extractAccessoriesFile(path) {
  return extractAccessories(fs.readFileSync(path, 'utf8'));
}
