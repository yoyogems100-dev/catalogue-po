import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import OrderStepper from '../components/OrderStepper';
import {
  DEFAULT_ORDER_STAGES, milestoneLabel, renderStageMessage, resolveOrderStages, statusChoices, stageUsesPin, visibleMilestones
} from '../lib/order-milestones';

test('default stages follow the owner list, Delivered starts hidden', () => {
  assert.deepEqual(visibleMilestones(DEFAULT_ORDER_STAGES).map((s) => s.label), [
    'Order placed', 'Order received', 'Confirmed by supplier', 'Dispatched from China', 'Goods received in Jaipur', 'Parcel sent'
  ]);
  // An order already at a hidden stage still sees it in the dropdown.
  assert.ok(statusChoices(DEFAULT_ORDER_STAGES, 'delivered').some((s) => s.key === 'delivered'));
  assert.ok(!statusChoices(DEFAULT_ORDER_STAGES, 'placed').some((s) => s.key === 'delivered'));
  assert.ok(statusChoices(DEFAULT_ORDER_STAGES, 'placed').some((s) => s.key === 'cancelled'));
});

test('saved stages override per field; junk falls back to defaults', () => {
  const stages = resolveOrderStages(JSON.stringify([
    { key: 'confirmed', label: '  Got it  ', message: 'Hi {name}', hidden: true },
    { key: 'placed', label: '' },
    { key: 'cancelled', hidden: true },
    { key: 'nonsense', label: 'x' }
  ]));
  assert.equal(stages.length, DEFAULT_ORDER_STAGES.length);
  assert.equal(milestoneLabel('confirmed', stages), 'Got it');
  assert.equal(stages.find((s) => s.key === 'confirmed')!.hidden, true);
  assert.equal(milestoneLabel('placed', stages), 'Order placed');
  assert.equal(stages.find((s) => s.key === 'cancelled')!.hidden, false);
  assert.deepEqual(resolveOrderStages('{not json'), DEFAULT_ORDER_STAGES);
});

test('order placed message carries the login details', () => {
  const text = renderStageMessage(DEFAULT_ORDER_STAGES, 'placed', {
    name: 'Rajesh', order: 55, link: 'https://www.yoyogems.co.in/po/account/orders/55', login: '919876543210', pin: '4821'
  });
  assert.match(text, /^Hi Rajesh, your YOYO GEMS order #55 has been placed\./);
  assert.match(text, /https:\/\/www\.yoyogems\.co\.in\/po\/account\/orders\/55/);
  assert.match(text, /Login: 919876543210\nPIN: 4821/);
  assert.match(text, /dispatched from China\.$/);
  assert.ok(stageUsesPin(DEFAULT_ORDER_STAGES, 'placed'));
});

test('a line whose placeholders are empty is left out', () => {
  const text = renderStageMessage(DEFAULT_ORDER_STAGES, 'placed', { name: '', order: 7, link: 'L', login: '9198', pin: null });
  assert.ok(!/PIN/.test(text));
  assert.match(text, /^Hi, your YOYO GEMS order #7/);
  assert.ok(!/\n{3}/.test(text));
});

test('buyer tracker uses edited names and skips hidden stages', () => {
  const stages = resolveOrderStages([{ key: 'sourcing', label: 'Supplier OK' }]);
  const html = renderToStaticMarkup(<OrderStepper status="sourcing" stages={stages} />);
  assert.match(html, /Supplier OK/);
  assert.ok(!/Delivered/.test(html));
  assert.equal((html.match(/stepper-step done/g) || []).length, 3);
});

test('courier lines appear only once a courier is chosen', async () => {
  const sent = renderStageMessage(DEFAULT_ORDER_STAGES, 'shipped', { name: 'Rajesh', order: 7, courier: 'Sainath Courier' });
  assert.equal(sent, 'Hi Rajesh, your YOYO GEMS order #7 parcel has been sent.\nSent through Sainath Courier.');
  const none = renderStageMessage(DEFAULT_ORDER_STAGES, 'shipped', { name: 'Rajesh', order: 7 });
  assert.equal(none, 'Hi Rajesh, your YOYO GEMS order #7 parcel has been sent.');
  assert.match(renderStageMessage(DEFAULT_ORDER_STAGES, 'packed', { name: 'R', order: 7, courier: 'DTDC' }), /received in Jaipur[\s\S]*It will be sent through DTDC\./);
});

test('Jaipur dispatch skips the China stages and names the courier', async () => {
  const { DEFAULT_JAIPUR_STAGES, resolveJaipurStages, stagesFor } = await import('../lib/order-milestones');
  assert.deepEqual(visibleMilestones(DEFAULT_JAIPUR_STAGES).map((s) => s.label), ['Order placed', 'Order received', 'Dispatched from Jaipur']);
  assert.doesNotMatch(DEFAULT_JAIPUR_STAGES.find((s) => s.key === 'placed')!.message, /China/);
  assert.equal(
    renderStageMessage(DEFAULT_JAIPUR_STAGES, 'confirmed', { name: 'Rajesh', order: 9 }),
    'Hi Rajesh, your YOYO GEMS order #9 is received and being prepared.'
  );
  assert.equal(
    renderStageMessage(DEFAULT_JAIPUR_STAGES, 'shipped', { name: 'Rajesh', order: 9, courier: 'BVC' }),
    'Hi Rajesh, your YOYO GEMS order #9 has been dispatched from Jaipur.\nSent through BVC.'
  );
  // A save can't switch the China stages back on for Jaipur orders.
  const saved = resolveJaipurStages(JSON.stringify([{ key: 'sourcing', hidden: false }, { key: 'shipped', label: 'Sent from JPR' }]));
  assert.equal(saved.find((s) => s.key === 'sourcing')!.hidden, true);
  assert.equal(milestoneLabel('shipped', saved), 'Sent from JPR');
  const sets = { china: DEFAULT_ORDER_STAGES, jaipur: DEFAULT_JAIPUR_STAGES };
  assert.equal(stagesFor(sets, true), DEFAULT_JAIPUR_STAGES);
  assert.equal(stagesFor(sets, false), DEFAULT_ORDER_STAGES);
  // China route list is unchanged by the Jaipur one.
  assert.equal(milestoneLabel('shipped', DEFAULT_ORDER_STAGES), 'Parcel sent');
});

test('courier list: defaults, trimming and no repeats', async () => {
  const { resolveCouriers, DEFAULT_COURIERS } = await import('../lib/couriers');
  assert.equal(resolveCouriers(null).length, 13);
  assert.deepEqual(resolveCouriers('bad json'), DEFAULT_COURIERS);
  assert.deepEqual(resolveCouriers(JSON.stringify(['  DTDC ', 'dtdc', '', 5, 'Shyam   Parcel'])), ['DTDC', 'Shyam Parcel']);
  assert.deepEqual(resolveCouriers('[]'), []);
});
