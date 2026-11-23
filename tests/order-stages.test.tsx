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
