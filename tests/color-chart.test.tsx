import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import OrderReferenceCarousel from '../components/OrderReferenceCarousel';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

test('the color chart closes the reference strip without hiding the other photos', () => {
  // Two earlier versions of this were both wrong. First, a category with a
  // chart showed ONLY the chart, with no way to reach its explore/matching
  // photos from the order composer. Then the chart led the strip -- but the
  // strip shows about one tile on a phone, so the whole reference area was a
  // grid of swatch codes far too small to read, and a buyer had to swipe past
  // it to see any stone. Photos lead now; the chart is the last tile, still
  // one tap from its zoomable full-screen view.
  const props = { categoryName: 'Crushed Ice', shapeIds: [2], sizeIds: [], colorIds: [], shapes: [], colors: [], colorChartUrl: '/chart.jpg' };
  const photos = [
    { id: 1, url: '/one.jpg', shapeIds: [1], sizeIds: [], colorIds: [] },
    { id: 2, url: '/two.jpg', shapeIds: [2], sizeIds: [], colorIds: [] }
  ];

  const chartOnly = renderToStaticMarkup(<OrderReferenceCarousel {...props} photos={[]} />);
  assert.match(chartOnly, /Enlarge Crushed Ice color chart/);

  // The photo matching the selected shape (two.jpg, shape 2) leads the strip,
  // the unmatched photo stays available behind it, and the chart still renders
  // last so it never displaces the stone a buyer opened the category to see.
  const withChart = renderToStaticMarkup(<OrderReferenceCarousel {...props} photos={photos} />);
  assert.match(withChart, /src="\/chart.jpg"/);
  assert.match(withChart, /src="\/two.jpg"/);
  assert.match(withChart, /src="\/one.jpg"/);
  assert.ok(withChart.indexOf('/two.jpg') < withChart.indexOf('/one.jpg'), 'the matching photo should lead');
  assert.ok(withChart.indexOf('/one.jpg') < withChart.indexOf('/chart.jpg'), 'photo tiles should render before the chart tile');

  // Without a chart the product photos take its place, still ranked by the
  // selected shape rather than filtered down to it.
  const noChart = renderToStaticMarkup(<OrderReferenceCarousel {...props} colorChartUrl={null} photos={photos} />);
  assert.match(noChart, /src="\/two.jpg"/);
  assert.ok(noChart.indexOf('/two.jpg') < noChart.indexOf('/one.jpg'), 'the matching photo should lead');
  assert.doesNotMatch(noChart, /color-chart/);

  // Neither chart nor photos: render nothing rather than an empty frame.
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
    const {rows} = await db.query<{ color_chart_url: string | null; thumbnail_photo_id: number }>('SELECT * FROM categories ORDER BY id');
    assert.equal(rows[0].color_chart_url, '/custom.jpg');
    assert.equal(rows[0].thumbnail_photo_id, 77);
    assert.equal(rows[1].color_chart_url, null);
    assert.equal(rows[1].thumbnail_photo_id, 88);
  } finally { await db.close(); }
});
