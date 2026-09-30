import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { safeNext } from '../lib/safe-next';
import LoginClient from '../app/po/account/login/LoginClient';

test('a returned-to path may only ever be a path on this site', () => {
  // The whole point of ?next= is that a shared link to a category survives the
  // sign-in it now triggers.
  assert.equal(safeNext('/po/category/crushed-ice-cut'), '/po/category/crushed-ice-cut');
  assert.equal(safeNext('/po/cart?open=1'), '/po/cart?open=1');

  // Anything a browser would resolve to another origin is dropped rather than
  // followed -- otherwise a yoyogems.co.in link could land the buyer elsewhere
  // the moment they logged in.
  assert.equal(safeNext('//evil.example/phish'), null);
  assert.equal(safeNext('https://evil.example'), null);
  assert.equal(safeNext('/\\evil.example'), null);
  assert.equal(safeNext('javascript:alert(1)'), null);

  // No destination at all is a normal case (someone opening the front page),
  // not an error -- the caller supplies its own default.
  assert.equal(safeNext(undefined), null);
  assert.equal(safeNext(''), null);
});

test('the sign-in screen is the brand plus number and PIN (trial phase)', () => {
  // Owner, 2026-09-30: WhatsApp codes are off and the team explains access to
  // each buyer directly, so the screen carries no instructions -- just the
  // brand, WhatsApp number + PIN, and Sign up (a request for access).
  const html = renderToStaticMarkup(<LoginClient next="/po" whatsappUrl="https://wa.me/919079914601" />);
  assert.match(html, /Synthetic Gemstones\. Infinite Choices\. One Trusted Name\./);
  assert.match(html, />PIN</);
  assert.match(html, /Sign up/);
  assert.doesNotMatch(html, /one-time code|WhatsApp code|Forgot|Trouble signing in|trade buyers/i);
});
