// Renders the Accessories PDF catalogue (the same document Admin > Accessories >
// Download PDF builds in the browser) to a file from the local public/ photos, to
// check the layout without the admin page. react-pdf has to load as ES modules, so:
//   npx esbuild scripts/accessories-pdf-sample.tsx --bundle --platform=node --format=esm \
//     --packages=external --jsx=automatic --outfile=.pdf-sample.mjs
//   node .pdf-sample.mjs out.pdf [range ids, comma separated]   (then delete .pdf-sample.mjs)
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { execFileSync } from 'node:child_process';
import { renderToFile } from '@react-pdf/renderer';
import { ACCESSORIES, DEFAULT_WHATSAPP, emptyOverrides } from '../lib/accessories/overrides';
import { pdfSelection, picturesOf, planCatalogue } from '../lib/accessories/pdf/plan';
import CataloguePdf, { registerPdfFonts } from '../lib/accessories/pdf/CataloguePdf';

const root = process.cwd();
const [out = 'accessories-sample.pdf', only] = process.argv.slice(2);
const picked = new Set(only ? only.split(',') : ACCESSORIES.ranges.map((r) => r.id));

// Photos are converted to JPEG by a Python helper (PIL), so this script needs no native image module:
//   PDF_PY=/path/to/python-with-PIL (default: python3)
const cache = path.join(process.env.TMPDIR || '/tmp', 'acc-pdf-sample');
function convertAll(jobs: [string, number, number][]) {
  fs.mkdirSync(cache, { recursive: true });
  const code = `import sys,json,os\nfrom PIL import Image\nfor u,px,q,o in json.load(sys.stdin):\n  if os.path.exists(o): continue\n  im=Image.open(u).convert('RGBA'); bg=Image.new('RGB',im.size,(255,255,255)); bg.paste(im,mask=im.split()[3]); bg.thumbnail((px,px)); bg.save(o,'JPEG',quality=q)`;
  const list = jobs.map(([u, px, q]) => [path.join(root, 'public', u), px, q, path.join(cache, `${px}-${u.replace(/\W/g, '_')}.jpg`)]);
  execFileSync(process.env.PDF_PY || 'python3', ['-c', code], { input: JSON.stringify(list) });
  return Object.fromEntries(jobs.map(([u], i) => [u, `data:image/jpeg;base64,${fs.readFileSync(list[i][3] as string).toString('base64')}`]));
}

(async () => {
  registerPdfFonts(path.join(root, 'public/po/pdf'));
  const { sections, styles } = pdfSelection(ACCESSORIES, emptyOverrides(), picked, false);
  const opt = { title: 'Bracelets & Necklaces', subtitle: 'Cords, braids, leather, charms and chains', preparedFor: '', index: true, finder: true, howToOrder: true, whatsapp: DEFAULT_WHATSAPP, edition: 'November 2026 edition' };
  const plan = planCatalogue(sections, styles, opt);
  const pics = picturesOf(plan);
  const img: Record<string, string> = convertAll([...pics.covers.map((u) => [u, 700, 72]), ...pics.thumbs.map((u) => [u, 520, 72]), ...pics.swatches.map((u) => [u, 400, 80])] as [string, number, number][]);
  img.logo = `data:image/png;base64,${fs.readFileSync(path.join(root, 'public/po/accessories/brand/logo-white.png')).toString('base64')}`;
  console.log(`${plan.order.length} categories, ${plan.styleCount} styles, ${plan.total} pages`);
  console.time('render');
  await renderToFile(React.createElement(CataloguePdf, { plan, opt, img }) as any, out);
  console.timeEnd('render');
})();
