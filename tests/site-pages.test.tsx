import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byMm, chartPages } from '../lib/site/chart-pages';
import { pageDefaults } from '../lib/site/defaults';
import { pageSchemas } from '../lib/site/page-schemas';
import { cleanContent } from '../lib/site/schema';
import { cleanAnswer, cleanQuestion } from '../lib/site/faq';

test('chart pages: fixed charts plus the configured colour charts, with safe unique addresses', () => {
  const content = { colours: { charts: [
    { title: 'CZ Colours', slug: 'cz-colours', intro: '', categories: [7] },
    { title: 'Nano Colours', slug: ' Nano Colours ', intro: '', categories: [17] },
    { title: 'Clash', slug: 'grades', intro: '', categories: [] },        // would hide the Grades page
    { title: 'Twice', slug: 'cz-colours', intro: '', categories: [] },    // duplicate address
    { title: '', slug: 'untitled', intro: '', categories: [] }
  ] } };
  assert.deepEqual(chartPages(content).map((c) => c.slug), ['shapes', 'sizes', 'cz-colours', 'nano-colours', 'grades']);
  // The starting setup has the brief's five colour charts.
  assert.deepEqual(chartPages(pageDefaults.charts).map((c) => c.title), [
    'Shape chart', 'Size & MM → carat chart', 'CZ Colours', 'Moissanite Colours', 'Corundum & Spinel Colours',
    'Nano Colours', 'Glass & Opal Colours', 'Quality grades explained'
  ]);
});

test('sizes sort by first dimension, then second', () => {
  assert.deepEqual(['1.1', '1x2', '10', '1', '2.5x5', '1x1.5', '2'].sort(byMm), ['1', '1x1.5', '1x2', '1.1', '2', '2.5x5', '10']);
});

test('category pickers keep only real ids', () => {
  const clean = cleanContent(pageSchemas.charts, { colours: { charts: [{ title: 'X', slug: 'x', intro: '', categories: [3, '4', 3, -1, 'x', 2.5, null] }] } });
  assert.deepEqual(clean.colours.charts[0].categories, [3, 4]);
});

test('FAQ text is trimmed and answers are reduced to the allowed formatting', () => {
  assert.equal(cleanQuestion('  Do   you ship? '), 'Do you ship?');
  assert.equal(cleanQuestion(42), '');
  assert.equal(cleanAnswer('<p onclick="x()">Yes <script>alert(1)</script><strong>fast</strong><img src=x></p>'), '<p>Yes <strong>fast</strong></p>');
});

test('the About page keeps the owner’s copy as written', () => {
  const html = pageDefaults.about.story.blocks.map((b: any) => b.body).join(' ');
  for (const line of ['We started YOYO GEMS to take that problem off your desk.', 'We are actually in China.', 'The second order matches the first.',
    'One supplier, one conversation.', 'We keep stock.']) assert.ok(html.includes(line), line);
  assert.equal(pageDefaults.about.cta.heading, 'That’s the whole idea. One trusted name.');
});

test('seeded grade and FAQ text follows the brand voice', () => {
  const sql = readFileSync('supabase/migrations/20260926090000_site_grade_faq_text.sql', 'utf8').toLowerCase();
  for (const word of ['elevate', 'unparalleled', 'embark', 'dazzling', 'exquisite', 'curated', 'seamless', 'unlock', 'journey', 'testament', 'delve', 'best in india'])
    assert.ok(!sql.includes(word), word);
});
