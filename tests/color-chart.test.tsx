import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import OrderReferenceCarousel from '../components/OrderReferenceCarousel';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

test('one reference beside the order form: the chart when there is one, filtered photos otherwise', () => {
  // Previously the chart rendered NEXT TO the product carousel, so a category
  // with a chart showed two carousels side by side, and a photo grid was
  // repeated again under the form. While choosing a colour the chart is the
  // reference that matters, so it now stands alone; browsing photos lives on
  // the Explore Photos tab.
  const props = { categoryName: 'Crushed Ice', shapeIds: [2], sizeIds: [], colorIds: [], shapes: [], colors: [], colorChartUrl: '/chart.jpg' };
  const photos = [
    { id: 1, url: '/one.jpg', shapeIds: [1], sizeIds: [], colorIds: [] },
    { id: 2, url: '/two.jpg', shapeIds: [2], sizeIds: [], colorIds: [] }
  ];

  const chartOnly = renderToStaticMarkup(<OrderReferenceCarousel {...props} photos={[]} />);
  assert.match(chartOnly, /Enlarge Crushed Ice color chart/);
  assert.doesNotMatch(chartOnly, /Next reference photo/);

  // A chart wins even when matching photos exist -- one reference, not two.
  const withChart = renderToStaticMarkup(<OrderReferenceCarousel {...props} photos={photos} />);
  assert.match(withChart, /src="\/chart.jpg"/);
  assert.doesNotMatch(withChart, /src="\/two.jpg"/);
  assert.doesNotMatch(withChart, /src="\/one.jpg"/);

  // Without a chart, the filtered product photos take its place, still
  // filtered to the selected shape (two.jpg matches shape 2; one.jpg doesn't).
  const noChart = renderToStaticMarkup(<OrderReferenceCarousel {...props} colorChartUrl={null} photos={photos} />);
  assert.match(noChart, /src="\/two.jpg"/);
  assert.doesNotMatch(noChart, /src="\/one.jpg"/);

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
