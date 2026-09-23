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

test('the sign-in screen explains itself, since it is the whole signed-out site', () => {
  // A signed-out visitor now sees this page and nothing else. A bare phone
  // field on an otherwise empty page reads as a broken site, so the brand,
  // a line of context and a way to reach the business all have to be here.
  const html = renderToStaticMarkup(<LoginClient next="/po" whatsappUrl="https://wa.me/919079914601" />);
  assert.match(html, /Synthetic Gemstones\. Infinite Choices\. One Trusted Name\./);
  assert.match(html, /trade buyers/i);
  assert.match(html, /wa\.me/);

  // With no WhatsApp number configured the help line is omitted rather than
  // rendered as a dead link.
  const noContact = renderToStaticMarkup(<LoginClient next="/po" whatsappUrl={null} />);
  assert.doesNotMatch(noContact, /Trouble signing in/);
});
