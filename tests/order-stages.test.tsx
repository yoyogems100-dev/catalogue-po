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
  assert.match(text, /^Hi Rajesh,\nYour YOYO GEMS \*Order #55\* has been \*Placed\*\./);
  assert.match(text, /https:\/\/www\.yoyogems\.co\.in\/po\/account\/orders\/55/);
  assert.match(text, /Login: 919876543210\nPIN: 4821/);
  assert.match(text, /We'll notify you once your order is \*Received\* by our team\.$/);
  assert.ok(stageUsesPin(DEFAULT_ORDER_STAGES, 'placed'));
});

test('a line whose placeholders are empty is left out', () => {
  const text = renderStageMessage(DEFAULT_ORDER_STAGES, 'placed', { name: '', order: 7, link: 'L', login: '9198', pin: null });
  assert.ok(!/PIN/.test(text));
  assert.match(text, /^Your YOYO GEMS \*Order #7\*/);
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
  const link = 'https://www.yoyogems.co.in/po/account/orders/7';
  const sent = renderStageMessage(DEFAULT_ORDER_STAGES, 'shipped', { name: 'Rajesh', order: 7, link, courier: 'Sainath Courier' });
  assert.equal(sent, `Hi Rajesh,\nYour YOYO GEMS *Order #7* has been *Sent* via *Sainath Courier*.\n\nYou can view your order here:\n${link}`);
  const none = renderStageMessage(DEFAULT_ORDER_STAGES, 'shipped', { name: 'Rajesh', order: 7, link });
  assert.match(none, /^Hi Rajesh,\nYour YOYO GEMS \*Order #7\* has been \*Sent\*\.\n/);
  assert.match(renderStageMessage(DEFAULT_ORDER_STAGES, 'packed', { name: 'R', order: 7, courier: 'DTDC' }), /\*Received in Jaipur\*[\s\S]*parcel is \*Sent\* via \*DTDC\*\./);
  assert.match(renderStageMessage(DEFAULT_ORDER_STAGES, 'packed', { name: 'R', order: 7 }), /parcel is \*Sent\*\.$/);
});

test('Jaipur dispatch skips the China stages and names the courier', async () => {
  const { DEFAULT_JAIPUR_STAGES, resolveJaipurStages, stagesFor } = await import('../lib/order-milestones');
  assert.deepEqual(visibleMilestones(DEFAULT_JAIPUR_STAGES).map((s) => s.label), ['Order placed', 'Order received', 'Dispatched from Jaipur']);
  assert.doesNotMatch(DEFAULT_JAIPUR_STAGES.find((s) => s.key === 'placed')!.message, /China/);
  assert.equal(
    renderStageMessage(DEFAULT_JAIPUR_STAGES, 'confirmed', { name: 'Rajesh', order: 9 }),
    "Hi Rajesh,\nYour YOYO GEMS *Order #9* has been *Received* and is being prepared.\n\nWe'll notify you once it is *Dispatched*."
  );
  assert.equal(
    renderStageMessage(DEFAULT_JAIPUR_STAGES, 'shipped', { name: 'Rajesh', order: 9, link: 'L', courier: 'BVC' }),
    'Hi Rajesh,\nYour YOYO GEMS *Order #9* has been *Dispatched* from Jaipur via *BVC*.\n\nYou can view your order here:\nL'
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

test('Jaipur order placed message names the courier in the first line', async () => {
  const { DEFAULT_JAIPUR_STAGES } = await import('../lib/order-milestones');
  const values = { name: 'Lodhiya GO. Ajit Ji', order: 33, link: 'https://www.yoyogems.co.in/po/account/orders/33', login: '9429500358', pin: '5003' };
  assert.equal(renderStageMessage(DEFAULT_JAIPUR_STAGES, 'placed', { ...values, courier: 'Sainath Courier' }), [
    'Hi Lodhiya GO. Ajit Ji,',
    'Your YOYO GEMS *Order #33* has been *Placed* and *Dispatched* via *Sainath Courier*.',
    '',
    'You can view your order and explore more using this link:',
    'https://www.yoyogems.co.in/po/account/orders/33',
    '',
    'Login: 9429500358',
    'PIN: 5003'
  ].join('\n'));
  // No courier yet: the greeting stays, only the bracketed part goes.
  assert.match(renderStageMessage(DEFAULT_JAIPUR_STAGES, 'placed', values), /^Hi Lodhiya GO\. Ajit Ji,\nYour YOYO GEMS \*Order #33\* has been \*Placed\*\.\n/);
  // No name: the greeting line goes, the rest stays.
  assert.match(renderStageMessage(DEFAULT_JAIPUR_STAGES, 'placed', { ...values, name: '', courier: 'BVC' }), /^Your YOYO GEMS \*Order #33\* has been \*Placed\* and \*Dispatched\* via \*BVC\*\.\n/);
  // Brackets without a placeholder are left alone.
  const custom = [{ ...DEFAULT_JAIPUR_STAGES[0], message: 'Order #{order} [urgent]' }];
  assert.equal(renderStageMessage(custom, 'placed', { order: 1 }), 'Order #1 [urgent]');
});
