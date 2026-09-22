import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildPhotoGroups, groupMemberIds } from '../lib/photo-groups';
import ProductSheet from '../components/ProductSheet';

test('a group is one card of many angles, and a stray angle still shows up', () => {
  const photos = [
    { id: 1, parentId: null },
    { id: 2, parentId: 1 },
    { id: 3, parentId: 1 },
    { id: 4, parentId: null },
    // Its lead isn't in this list -- filtered out, or left behind by a partial
    // move. It stands on its own rather than vanishing with its missing parent.
    { id: 5, parentId: 99 }
  ];
  const groups = buildPhotoGroups(photos);
  assert.deepEqual(groups.map((g) => g.lead.id), [1, 4, 5]);
  // The lead leads its own gallery, so the cover is always the first view.
  assert.deepEqual(groups[0].media.map((p) => p.id), [1, 2, 3]);
  assert.deepEqual(groups[1].media.map((p) => p.id), [4]);
  assert.deepEqual(groups[2].media.map((p) => p.id), [5]);

  // A bulk action on any member has to take the whole group with it, or a move
  // would leave angles in a category that can never show them.
  assert.deepEqual(groupMemberIds(photos, 2).sort(), [1, 2, 3]);
  assert.deepEqual(groupMemberIds(photos, 1).sort(), [1, 2, 3]);
  assert.deepEqual(groupMemberIds(photos, 4), [4]);
  assert.deepEqual(groupMemberIds(photos, 404), []);
});

const shapes = [{ id: 1, name: 'Round' }, { id: 2, name: 'Oval' }];
const colors = [{ id: 7, name: 'Ruby Red', hex: '#a00' }, { id: 8, name: 'White' }];
const sizes = [
  { id: 91, shape_id: 1, size_mm: '2.00' },
  { id: 92, shape_id: 1, size_mm: '3.00' },
  { id: 93, shape_id: 2, size_mm: '4x6' }
];
const lead = {
  id: 10, url: '/stone.jpg', parentId: null,
  shapeIds: [1], sizeIds: [], colorIds: [7], tag_ids: [],
  productCode: 'RC-100', notes: null
};

function sheet(props: Partial<Parameters<typeof ProductSheet>[0]> = {}) {
  return renderToStaticMarkup(
    <ProductSheet
      categoryId={5}
      categoryName="Rainbow Corundum"
      group={{ lead, media: [lead] }}
      shapes={shapes}
      colors={colors}
      tags={[]}
      sizes={sizes}
      onClose={() => {}}
      {...props}
    />
  );
}

test('what the photo already says is stated, and what it never said is asked for', () => {
  // The photo names one shape and one colour, so those are facts on the sheet,
  // not questions. It never recorded a size, which is exactly the case the
  // owner described -- so the size becomes a searchable dropdown of the sizes
  // that shape actually comes in, chosen at order time.
  const markup = sheet();
  assert.match(markup, /RC-100/);
  assert.match(markup, /Round/);
  assert.match(markup, /Ruby Red/);
  assert.match(markup, /Select size/);
  // Nothing can be added until the size is answered.
  assert.match(markup, /Choose a size to add this/);
  assert.match(markup, /Add to requirement/);

  // Sizes are scoped to the shape, which shows in the observable output: Oval
  // comes in one size in this catalogue, so the same untagged-size photo needs
  // no dropdown at all once its shape is Oval, and 4x6 is stated as a fact.
  // (Round's own sizes live inside a closed dropdown panel, which renders only
  // when it is opened, so they cannot be asserted from this markup.)
  const oval = sheet({ group: { lead: { ...lead, shapeIds: [2] }, media: [{ ...lead, shapeIds: [2] }] } });
  assert.match(oval, /4x6/);
  assert.doesNotMatch(oval, /Select size/);
  assert.doesNotMatch(oval, /2\.00 mm/);
});

test('a single tagged size is settled for the buyer rather than asked again', () => {
  const markup = sheet({ group: { lead: { ...lead, sizeIds: [92] }, media: [{ ...lead, sizeIds: [92] }] } });
  assert.match(markup, /3\.00 mm/);
  assert.doesNotMatch(markup, /Select size/);
  // Shape, size and colour all settled, so the line can be added straight away.
  assert.doesNotMatch(markup, /to add this/);
});

test('a category with its own order options sends the buyer to the composer', () => {
  // Rainbow Corundum (29) orders by complete strips and Hole Punched Stones
  // (20) needs a drill type -- neither is collected here, so this sheet must
  // not create a line that silently omits them.
  const rainbow = sheet({ categoryId: 29, onRaiseOrder: () => {} });
  assert.match(rainbow, /complete strips/);
  assert.match(rainbow, /Raise Purchase Order/);
  assert.doesNotMatch(rainbow, /Add to requirement/);

  const drilled = sheet({ categoryId: 20, onRaiseOrder: () => {} });
  assert.match(drilled, /drill type/);
  assert.doesNotMatch(drilled, /Add to requirement/);
});

test('the gallery only offers view controls when there is more than one view', () => {
  const single = sheet();
  assert.doesNotMatch(single, /Next view/);
  const angle = { ...lead, id: 11, parentId: 10, url: '/stone-side.jpg' };
  const grouped = sheet({ group: { lead, media: [lead, angle] } });
  assert.match(grouped, /Next view/);
  assert.match(grouped, /1 \/ 2/);
  assert.match(grouped, /stone-side\.jpg/);
});
