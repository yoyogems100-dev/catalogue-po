import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { BIN, NOTIFICATIONS, OVERVIEW, WORKSPACES, currentHref, poCategoryPages, workspaceOf } from '../components/admin/nav-config';

const links = [OVERVIEW, NOTIFICATIONS, BIN, ...WORKSPACES.flatMap((w) => w.groups.flatMap((g) => g.links))];

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
  assert.equal(currentHref('/admin/content/home-sections'), '/admin/content/home-sections');
  assert.equal(currentHref('/admin/orders/9'), '/admin/orders');
  assert.equal(currentHref('/admin'), '/admin');
});

test('the side pane stays short: a few entries per workspace, the rest drill down', () => {
  // The owner asked for Categories, Photos, Shapes & sizes and Colours as
  // their own entries; tags & specifications live on the Overview instead.
  const po = WORKSPACES.find((w) => w.key === 'po')!;
  for (const title of ['Categories', 'Photos', 'Shapes & sizes', 'Colours']) assert.ok(po.groups.some((g) => g.title === title), `${title} is in the PO pane`);
  assert.ok(!po.groups.some((g) => /tag/i.test(g.title)), 'no Tags page in the pane');
  for (const w of WORKSPACES) {
    assert.ok(w.groups.length <= 8, `${w.label} shows at most 8 entries`);
    assert.equal(w.groups.filter((g) => g.list).length, 1, `${w.label} has one Categories drill-down`);
  }
  assert.deepEqual(poCategoryPages(5).map((l) => l.label), ['Photos', 'Shapes & sizes', 'Colours', 'Pricing', 'Suppliers']);
  assert.ok(poCategoryPages(29).some((l) => l.href === '/admin/categories/29?tab=strip-counts'), 'Rainbow Corundum has Strip counts');
});
