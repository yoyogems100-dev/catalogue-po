import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { BIN, OVERVIEW, WORKSPACES, currentHref, workspaceOf } from '../components/admin/nav-config';

const links = [OVERVIEW, BIN, ...WORKSPACES.flatMap((w) => w.groups.flatMap((g) => g.links))];

test('every admin section is in the side pane, and every link has a page', () => {
  const hrefs = links.map((l) => l.href);
  assert.equal(new Set(hrefs).size, hrefs.length, 'no duplicates');
  for (const h of hrefs) assert.ok(existsSync(`app${h}/page.tsx`), `${h} has a page`);
  for (const dir of readdirSync('app/admin', { withFileTypes: true }).filter((d) => d.isDirectory())) {
    assert.ok(hrefs.some((h) => h === `/admin/${dir.name}` || h.startsWith(`/admin/${dir.name}/`)), `/admin/${dir.name} is reachable`);
  }
});

test('website pages sit under the Website workspace only', () => {
  const site = WORKSPACES.find((w) => w.key === 'site')!.groups.flatMap((g) => g.links);
  const po = WORKSPACES.find((w) => w.key === 'po')!.groups.flatMap((g) => g.links);
  assert.ok(site.every((l) => l.href.startsWith('/admin/site')));
  assert.ok(po.every((l) => !l.href.startsWith('/admin/site')));
  assert.equal(workspaceOf('/admin/site/categories/12'), 'site');
  assert.equal(workspaceOf('/admin/categories/12'), 'po');
  assert.equal(workspaceOf('/admin'), 'po');
});

test('the most specific link is highlighted', () => {
  assert.equal(currentHref('/admin/site/leads'), '/admin/site/leads');
  assert.equal(currentHref('/admin/site'), '/admin/site');
  assert.equal(currentHref('/admin/site/categories/4'), '/admin/site/categories');
  assert.equal(currentHref('/admin/content/most-ordered'), '/admin/content/most-ordered');
  assert.equal(currentHref('/admin/orders/9'), '/admin/orders');
  assert.equal(currentHref('/admin'), '/admin');
});
