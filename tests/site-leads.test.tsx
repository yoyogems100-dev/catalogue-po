import test from 'node:test';
import assert from 'node:assert/strict';
import { checkLead, cleanReply, cleanWhatsapp, displayWhatsapp, leadsCsv, rateAllows, replyHref, replyText, RATE, type Lead } from '../lib/site/leads';

const choices = [{ id: 1, name: 'CZ' }, { id: 2, name: 'CZ › White CZ' }, { id: 5, name: 'Moissanite' }];
const now = 1_800_000_000_000;
const form = { name: '  Ravi   Kumar ', business_city: 'Shree Jewels, Surat', whatsapp: '+91 98765-43210', category_ids: [2, 99, 5, 2], monthly_requirement: '5,000 pcs', started_at: now - 20_000, source_path: '/products/cz/white-cz' };

test('a WhatsApp number is required and stored in one form', () => {
  assert.equal(cleanWhatsapp('98765 43210'), '9876543210');
  assert.equal(cleanWhatsapp('+91 98765 43210'), '9876543210');
  assert.equal(cleanWhatsapp('098765 43210'), '9876543210');
  assert.equal(cleanWhatsapp('+971 50 123 4567'), '971501234567');
  assert.equal(cleanWhatsapp('12345'), null);
  assert.equal(cleanWhatsapp('5551234567'), null); // not an Indian mobile, no + country code
  assert.equal(cleanWhatsapp('call me'), null);
  assert.equal(cleanWhatsapp(undefined), null);
  assert.equal(displayWhatsapp('9876543210'), '+91 98765 43210');
});

test('a request is cleaned and its categories checked against the live list', () => {
  const r = checkLead(form, choices, now);
  assert.ok(r.ok);
  assert.deepEqual(r.lead, {
    name: 'Ravi Kumar', business_city: 'Shree Jewels, Surat', whatsapp: '9876543210',
    category_ids: [2, 5], category_names: ['CZ › White CZ', 'Moissanite'],
    monthly_requirement: '5,000 pcs', source_path: '/products/cz/white-cz'
  });
  assert.equal((checkLead({ ...form, source_path: 'https://evil.test' }, choices, now) as any).lead.source_path, null);
  assert.equal((checkLead({ ...form, whatsapp: '' }, choices, now) as any).field, 'whatsapp');
  assert.equal((checkLead({ ...form, name: ' ' }, choices, now) as any).field, 'name');
  assert.equal((checkLead({ ...form, business_city: '' }, choices, now) as any).field, 'business_city');
  assert.equal(checkLead(null, choices, now).ok, false);
});

test('bots are caught without a captcha', () => {
  assert.deepEqual(checkLead({ ...form, company_website: 'http://spam.test' }, choices, now), { ok: false, spam: true });
  assert.deepEqual(checkLead({ ...form, started_at: now - 800 }, choices, now), { ok: false, spam: true });
  assert.ok(checkLead({ ...form, started_at: undefined }, choices, now).ok);
  assert.ok(rateAllows(RATE.perVisitor - 1, 0));
  assert.ok(!rateAllows(RATE.perVisitor, 0));
  assert.ok(!rateAllows(0, RATE.siteWide));
});

test('the WhatsApp reply is drafted from the owner’s template', () => {
  const lead = { name: 'Ravi Kumar', business_city: 'Shree Jewels, Surat', category_names: ['Moissanite'], whatsapp: '9876543210' };
  assert.equal(replyText('Hi {first_name} of {business}: {categories} {link} {unknown}', lead, 'https://x.test/c'),
    'Hi Ravi of Shree Jewels, Surat: Moissanite https://x.test/c {unknown}');
  assert.equal(replyText('Hi {first_name}.\n\nCatalogue: {link}\n\nThanks', lead, ''), 'Hi Ravi.\n\nThanks');
  assert.equal(replyHref('Hi {first_name}', lead, ''), 'https://wa.me/919876543210?text=Hi%20Ravi');
  assert.equal(replyHref('Hi', { ...lead, whatsapp: '971501234567' }, ''), 'https://wa.me/971501234567?text=Hi');
  assert.deepEqual(cleanReply({ catalogue_link: 'http://x.test', message: 'Hi' }), { error: 'The catalogue link must be a full web address starting with https://' });
  assert.deepEqual(cleanReply({ catalogue_link: '', message: '  ' }), { error: 'Write the reply message first.' });
  assert.deepEqual(cleanReply({ catalogue_link: ' https://x.test/c ', message: 'Hi\r\nthere' }), { value: { catalogue_link: 'https://x.test/c', message: 'Hi\nthere' } });
});

test('the CSV export is safe to open in Excel', () => {
  const lead: Lead = { id: 1, name: '=HYPERLINK("x")', business_city: 'Jaipur, "Main" Rd', whatsapp: '9876543210', category_names: ['CZ', 'Moissanite'], monthly_requirement: '+5000', status: 'sent', notes: 'line1\nline2', source_path: null, created_at: '2026-09-25T06:30:00Z' };
  const csv = leadsCsv([lead]);
  assert.ok(csv.startsWith('﻿Date,Name,'));
  const row = csv.split('\r\n')[1];
  assert.ok(row.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(row.includes('"Jaipur, ""Main"" Rd"'));
  assert.ok(row.includes(",'+5000,"));
  assert.ok(row.includes(',91 98765 43210,CZ; Moissanite'));
  assert.ok(row.includes(',Sent,"line1\nline2",'));
});
