// Reads the hand-built Accessories page (public/po/accessories/index.html) and
// returns its ranges and styles as plain data, without the embedded photos.
// Admin > Accessories lists, searches and exports from this; the page itself
// stays the source of truth. After adding ranges to the page, run
// `npm run accessories:index` (a test fails until lib/accessories/catalogue.json
// matches the page again).
import fs from 'node:fs';
import vm from 'node:vm';

export function extractAccessories(html) {
  const start = html.indexOf('const CATS = [');
  // Stop before the block that applies Admin edits: this reads the page as built.
  const edits = html.indexOf('/* Admin > Accessories edits');
  const end = edits >= 0 ? edits : html.indexOf('const CAT = Object.fromEntries');
  if (start < 0 || end < start) throw new Error('Accessories page: could not find CATS / P in index.html');
  const ctx = {};
  vm.runInNewContext(`${html.slice(start, end)}\n;globalThis.__out = { CATS, P, FAM, SHADE };`, ctx, { timeout: 20000 });
  const { CATS, P, FAM, SHADE } = ctx.__out;
  const ranges = CATS.map((c) => ({
    id: String(c.id),
    series: String(c.series || ''),
    name: String(c.name || ''),
    text: String(c.text || ''),
    finish: String(c.finish || ''),
    views: (c.views || []).map(([, label]) => String(label))
  }));
  const styles = P.map((p) => ({
    sku: String(p.sku),
    cat: String(p.cat),
    code: String(p.code || ''),
    name: String(p.name || ''),
    style: String(p.style || ''),
    colours: (p.colours || []).map(String),
    dots: (p.colours || []).map((c, i) => (p.dots && p.dots[i]) || SHADE[String(c).toLowerCase()] || (i === 0 && p.hex) || '#cccccc'),
    families: (p.fam || []).map((f) => FAM[f] || f)
  }));
  return { ranges, styles };
}

export function extractAccessoriesFile(path) {
  return extractAccessories(fs.readFileSync(path, 'utf8'));
}
