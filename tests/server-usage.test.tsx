import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { shareInFlight } from '../lib/in-flight';

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? routeFiles(full) : /^route\.tsx?$/.test(name) ? [full] : [];
  });
}

test('every admin write expires the cached catalogue, so an edit shows on the next load', () => {
  const missing: string[] = [];
  for (const file of routeFiles(path.join(process.cwd(), 'app/api'))) {
    const src = readFileSync(file, 'utf8');
    const handlers = [...src.matchAll(/export\s+(?:async\s+)?function\s+(POST|PATCH|PUT|DELETE)\b/g)];
    for (const h of handlers) {
      const rest = src.slice(h.index!);
      const next = rest.slice(1).search(/export\s+(?:async\s+)?function\s+\w+/);
      const body = next === -1 ? rest : rest.slice(0, next + 1);
      const admin = /isAdminAuthed\(\)|requireAdmin\(\)/.test(body);
      if (admin && !/catalogueChanged\(\)/.test(body)) missing.push(`${path.relative(process.cwd(), file)} ${h[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('overlapping calls share one load; nothing is kept once it settles', async () => {
  let runs = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const load = shareInFlight(async (slug: string) => { runs++; await gate; return `${slug}:${runs}`; });
  const [a, b, c] = [load('ruby'), load('ruby'), load('cz')];
  release();
  assert.deepEqual(await Promise.all([a, b, c]), ['ruby:2', 'ruby:2', 'cz:2']);
  assert.equal(runs, 2, 'one load per distinct argument');
  await load('ruby');
  assert.equal(runs, 3, 'a later call loads again');
});

test('a stored file is named by what it was made from', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co';
  const { generatedPath, publicFileUrl } = await import('../lib/generated-files');
  const a = generatedPath('size-chart/34', { rows: [1, 2] }, 'pdf');
  assert.match(a, /^generated\/size-chart\/34-[0-9a-f]{16}\.pdf$/);
  assert.equal(generatedPath('size-chart/34', { rows: [1, 2] }, 'pdf'), a, 'same source, same file');
  assert.notEqual(generatedPath('size-chart/34', { rows: [1, 3] }, 'pdf'), a, 'changed source, new file');
  assert.match(publicFileUrl(a, 'YOYO GEMS.pdf'), /\/storage\/v1\/object\/public\/photos\/generated\/.+\?download=YOYO%20GEMS\.pdf$/);
});
