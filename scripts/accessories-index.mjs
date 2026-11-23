// Regenerates lib/accessories/catalogue.json from the Accessories page.
// Run after adding or changing ranges in public/po/accessories/index.html.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractAccessoriesFile } from '../lib/accessories/extract.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = extractAccessoriesFile(path.join(root, 'public/po/accessories/index.html'));
fs.writeFileSync(path.join(root, 'lib/accessories/catalogue.json'), JSON.stringify(data, null, 1) + '\n');
console.log(`Accessories index: ${data.ranges.length} ranges, ${data.styles.length} styles`);
