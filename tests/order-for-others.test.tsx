import test from 'node:test';
import assert from 'node:assert/strict';
import { parseActingToken, signActingToken, signCustomerToken } from '../lib/customer-auth';

test('a switch token only means what was signed, and cannot pass as a session', () => {
  const saved = process.env.CUSTOMER_SESSION_SECRET;
  process.env.CUSTOMER_SESSION_SECRET = 'test-only-secret-not-used-by-any-deployment';
  try {
    const token = signActingToken(1, 7);
    assert.deepEqual(parseActingToken(token), { actorId: 1, buyerId: 7 });
    // Changing who it is for breaks the signature.
    assert.equal(parseActingToken(token.replace(/^1:7/, '1:8')), null);
    assert.equal(parseActingToken(token.replace(/^1:7/, '2:7')), null);
    // A plain session token is not a switch token.
    assert.equal(parseActingToken(signCustomerToken(7)), null);
    assert.equal(parseActingToken('garbage'), null);
  } finally {
    if (saved === undefined) delete process.env.CUSTOMER_SESSION_SECRET; else process.env.CUSTOMER_SESSION_SECRET = saved;
  }
});
