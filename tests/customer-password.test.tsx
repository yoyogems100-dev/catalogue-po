import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { checkPassword, decryptForAdmin, encryptForAdmin, generatePassword, hashPassword, passwordProblem } from '../lib/customer-password';
import { middleware } from '../middleware';

test('customer passwords: hashed for sign-in, encrypted copy readable only with the key', async () => {
  const saved = { admin: process.env.ADMIN_SESSION_SECRET, own: process.env.CUSTOMER_PASSWORD_KEY };
  process.env.ADMIN_SESSION_SECRET = 'test-only-secret-not-used-by-any-deployment';
  delete process.env.CUSTOMER_PASSWORD_KEY;
  try {
    const hash = await hashPassword('Sharma@123');
    assert.ok(!hash.includes('Sharma@123'));
    assert.equal(await checkPassword('Sharma@123', hash), true);
    assert.equal(await checkPassword('sharma@123', hash), false, 'case matters');
    assert.equal(await checkPassword('Sharma@123', null), false);
    assert.equal(await checkPassword('Sharma@123', 'garbage'), false);
    assert.notEqual(await hashPassword('Sharma@123'), hash, 'salted: same password, different hash');

    const enc = encryptForAdmin('Sharma@123')!;
    assert.ok(enc && !enc.includes('Sharma'));
    assert.equal(decryptForAdmin(enc), 'Sharma@123');
    assert.equal(decryptForAdmin(enc.slice(0, -4) + 'AAAA'), null, 'tampered copy is rejected');

    // A different key can't read it (sign-in is unaffected: that uses the hash).
    process.env.ADMIN_SESSION_SECRET = 'a-different-secret';
    assert.equal(decryptForAdmin(enc), null);
  } finally {
    if (saved.admin === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = saved.admin;
    if (saved.own !== undefined) process.env.CUSTOMER_PASSWORD_KEY = saved.own;
  }
});

test('password rules and suggestions', () => {
  // Any characters, 4 or more.
  assert.ok(passwordProblem('abc'));
  for (const ok of ['1234', 'abcd', ' a b ', 'राम1']) assert.equal(passwordProblem(ok), null, ok);
  assert.ok(passwordProblem('x'.repeat(129)));
  assert.ok(passwordProblem(undefined));
  const p = generatePassword();
  assert.equal(p.length, 8);
  assert.equal(passwordProblem(p), null);
  assert.ok(!/[0O1lI]/.test(p), 'no look-alike characters');
});

test('password sign-in and reset are reachable signed out; changing it is not', async () => {
  const secret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = 'test-only-secret-not-used-by-any-deployment';
  try {
    const get = (path: string) => middleware(new NextRequest(`http://localhost${path}`));
    assert.equal((await get('/api/account/password/login')).status, 200);
    assert.equal((await get('/api/account/password/reset')).status, 200);
    assert.equal((await get('/api/account/password')).status, 401);
    assert.equal((await get('/api/admin/customers/1/password')).status, 401);
  } finally {
    if (secret === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = secret;
  }
});
