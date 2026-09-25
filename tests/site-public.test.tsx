import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
import { pageDefaults } from '../lib/site/defaults';
import { pageSchemas } from '../lib/site/page-schemas';
import { categorySchema } from '../lib/site/schemas';
import { cleanContent, withDefaults } from '../lib/site/schema';

const get = (path: string) => middleware(new NextRequest(`http://localhost${path}`));

test('the marketing website is public while the catalogue stays private', async () => {
  const secret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = 'test-only-secret-not-used-by-any-deployment';
  try {
    for (const path of ['/', '/products', '/products/cz', '/products/cz/white-cz', '/charts', '/charts/grades', '/about', '/quality',
      '/how-to-order', '/request-catalogue', '/faq', '/contact', '/api/site/lead']) {
      assert.equal((await get(path)).status, 200, `${path} should be public`);
    }
    // Look-alike paths are not swept in by the prefix match.
    assert.notEqual((await get('/productsx')).status, 200);
    assert.notEqual((await get('/api/site-admin')).status, 200);
    // The catalogue and admin are still behind sign-in.
    assert.equal((await get('/po')).status, 307);
    assert.equal((await get('/admin/site')).status, 307);
    assert.equal((await get('/api/categories')).status, 401);
  } finally {
    process.env.ADMIN_SESSION_SECRET = secret;
  }
});

// The owner's brand voice rules: these words never appear on the site.
const BANNED = ['elevate', 'unparalleled', 'embark', 'dazzling', 'exquisite', 'curated', 'seamless', 'unlock', 'journey',
  'testament', 'delve', "in today's fast-paced world", 'we are passionate about'];

test('built-in page copy fits its fields and follows the brand voice', () => {
  for (const [key, value] of Object.entries(pageDefaults)) {
    const schema = pageSchemas[key];
    assert.ok(schema, `defaults for unknown page ${key}`);
    // Cleaning must not change the defaults: every field exists and is within its limits.
    assert.deepEqual(cleanContent(schema, value), withDefaults(schema, value), `${key} defaults do not match the schema`);
    const text = JSON.stringify(value).toLowerCase();
    for (const word of BANNED) assert.ok(!text.includes(word), `${key} uses banned word "${word}"`);
    assert.ok(!/best in india/.test(text), `${key} claims "best in India"`);
  }
  assert.ok(categorySchema.sections.length === 9, 'category pages have 8 content blocks plus SEO');
});
