import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { adminColorLabel, cleanAdminColorCode } from '../lib/color-admin-codes';

test('admin colour label: code in brackets after the name, plain name without one', () => {
  assert.equal(adminColorLabel('YOTCF-05', '39'), 'YOTCF-05 (#39)');
  assert.equal(adminColorLabel('YOTCF-05', '#39'), 'YOTCF-05 (#39)');
  assert.equal(adminColorLabel('YOTCF-18', null), 'YOTCF-18');
  assert.equal(adminColorLabel('YOTCF-18', '  '), 'YOTCF-18');
});

test('admin colour codes are cleaned before saving', () => {
  assert.equal(cleanAdminColorCode(' # 3125 '), '3125');
  assert.equal(cleanAdminColorCode(''), null);
  assert.equal(cleanAdminColorCode(42), null);
  assert.equal(cleanAdminColorCode('x'.repeat(40))!.length, 30);
});

// The codes are for the owner only: nothing a buyer, invoice or PDF reaches
// may read them. Only admin pages and admin API routes may import the helper.
test('only admin code reads colour admin codes', () => {
  const root = path.resolve(__dirname, '..');
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) { if (!['node_modules', '.next', '.git'].includes(f)) walk(p); continue; }
      if (!/\.(ts|tsx)$/.test(f)) continue;
      const src = readFileSync(p, 'utf8');
      if (src.includes('color-admin-codes') || src.includes('color_admin_codes')) hits.push(path.relative(root, p));
    }
  };
  for (const d of ['app', 'components', 'lib']) walk(path.join(root, d));
  const outside = hits.filter((h) => !h.startsWith('app/admin/') && !h.startsWith('app/api/admin/') && h !== 'lib/color-admin-codes.ts');
  assert.deepEqual(outside, []);
});
