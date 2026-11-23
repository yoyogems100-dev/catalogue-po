import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import CategoryLink from '../components/CategoryLink';

// The accessories catalogue is a static page in public/po/accessories. A Next
// <Link> to it navigates client-side and lands on "Page not found", so the
// card must be a plain link straight to the page.
test('the Accessories card links straight to the static accessories catalogue', () => {
  const html = renderToStaticMarkup(<CategoryLink slug="accessories" className="browse-photo-tile">Accessories</CategoryLink>);
  assert.equal(html, '<a href="/po/accessories" class="browse-photo-tile">Accessories</a>');
});

test('other category cards still link to their category page', () => {
  const html = renderToStaticMarkup(<CategoryLink slug="moissanite">Moissanite</CategoryLink>);
  assert.match(html, /href="\/po\/category\/moissanite"/);
});
