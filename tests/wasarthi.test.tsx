import test from 'node:test';
import assert from 'node:assert/strict';
import { providerReply, replySaysFailed } from '../lib/wasarthi';

test('a WhatsApp provider reply is logged safely and explicit failures are caught', () => {
  // Our token never reaches the log, and the reply stays one short line.
  assert.equal(providerReply('{"error":"bad token abc123"}\n', 'abc123'), '{"error":"bad token [token]"}');
  assert.equal(providerReply('x'.repeat(1000), 't').length, 400);

  // A 200 that says it failed is not a delivery.
  for (const body of ['{"success":false}', '{"status":false}', '{"status":"error","message":"Insufficient balance"}', '{"status":"FAILED"}']) {
    assert.equal(replySaysFailed(body), true, body);
  }
  // Anything else on a 200 still counts as accepted, as before.
  for (const body of ['', 'OK', '{"status":"success"}', '{"success":true}', '{"message":"queued"}', '[]']) {
    assert.equal(replySaysFailed(body), false, body);
  }
});
