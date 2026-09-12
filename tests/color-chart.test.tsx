import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import OrderReferenceCarousel from '../components/OrderReferenceCarousel';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

test('chart remains available without product photos and beside filtered product photos', () => {
  const props = { categoryName: 'Crushed Ice', shapeIds: [2], sizeIds: [], colorIds: [], shapes: [], colors: [], colorChartUrl: '/chart.jpg' };
  const chartOnly = renderToStaticMarkup(<OrderReferenceCarousel {...props} photos={[]} />);
  assert.match(chartOnly, /Enlarge Crushed Ice color chart/);
  assert.doesNotMatch(chartOnly, /Next reference photo/);
  const both = renderToStaticMarkup(<OrderReferenceCarousel {...props} photos={[
    { id: 1, url: '/one.jpg', shapeIds: [1], sizeIds: [], colorIds: [] },
    { id: 2, url: '/two.jpg', shapeIds: [2], sizeIds: [], colorIds: [] }
  ]} />);
  assert.match(both, /src="\/two.jpg"/);
  assert.match(both, /src="\/chart.jpg"/);
  assert.doesNotMatch(both, /src="\/one.jpg"/);
  assert.equal(renderToStaticMarkup(<OrderReferenceCarousel {...props} colorChartUrl={null} photos={[]} />), '');
});

test('chart migration preserves existing charts and category covers', async () => {
  const db = new PGlite();
  try {
    await db.exec("CREATE TABLE categories (id int primary key, slug text, thumbnail_photo_id int); INSERT INTO categories VALUES (1,'crushed-ice-cut',77),(2,'glass-pearls',88);");
    const sql = readFileSync('supabase/migrations/20260912120000_category_color_charts.sql', 'utf8');
    await db.exec(sql);
    await db.exec("UPDATE categories SET color_chart_url='/custom.jpg' WHERE id=1;");
    await db.exec(sql);
    const {rows} = await db.query('SELECT * FROM categories ORDER BY id');
    assert.equal(rows[0].color_chart_url, '/custom.jpg');
    assert.equal(rows[0].thumbnail_photo_id, 77);
    assert.equal(rows[1].color_chart_url, null);
    assert.equal(rows[1].thumbnail_photo_id, 88);
  } finally { await db.close(); }
});
