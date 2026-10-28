import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedFetch } from '../lib/bounded-fetch';

// A stand-in for fetch: `hang` requests never answer (until aborted).
function fakeFetch(plan: ('ok' | 'hang' | 503)[]) {
  let live = 0;
  const state = { calls: 0, peak: 0 };
  const fn = ((_input: any, init?: RequestInit) => {
    const step = plan[state.calls++] ?? 'ok';
    live++; state.peak = Math.max(state.peak, live);
    return new Promise<Response>((resolve, reject) => {
      const done = () => { live--; };
      if (step === 'hang') {
        init?.signal?.addEventListener('abort', () => { done(); reject(init.signal!.reason); });
        return;
      }
      setTimeout(() => { done(); resolve(new Response(step === 503 ? 'busy' : '[1]', { status: step === 503 ? 503 : 200 })); }, 5);
    });
  }) as typeof fetch;
  return { fn, state };
}

test('a stalled read times out and is tried again instead of hanging forever', async () => {
  const f = fakeFetch(['hang', 'ok']);
  const get = boundedFetch({ maxConcurrent: 4, timeoutMs: 50, retries: 1 }, () => f.fn);
  const res = await get('https://x.test/rest/v1/t');
  assert.equal(await res.text(), '[1]');
  assert.equal(f.state.calls, 2);
});

test('a read that keeps stalling fails after its retries rather than hanging', async () => {
  const f = fakeFetch(['hang', 'hang', 'hang']);
  const get = boundedFetch({ maxConcurrent: 4, timeoutMs: 30, retries: 1 }, () => f.fn);
  await assert.rejects(get('https://x.test/rest/v1/t'));
  assert.equal(f.state.calls, 2);
});

test('gateway errors on reads are retried; writes are never retried', async () => {
  const r = fakeFetch([503, 'ok']);
  assert.equal((await boundedFetch({ maxConcurrent: 4, timeoutMs: 1000, retries: 1 }, () => r.fn)('https://x.test')).status, 200);
  const w = fakeFetch(['hang', 'ok']);
  await assert.rejects(boundedFetch({ maxConcurrent: 4, timeoutMs: 30, retries: 1 }, () => w.fn)('https://x.test', { method: 'POST' }));
  assert.equal(w.state.calls, 1);
});

test('no more than maxConcurrent requests are in flight at once', async () => {
  const f = fakeFetch([]);
  const get = boundedFetch({ maxConcurrent: 3, timeoutMs: 1000, retries: 0 }, () => f.fn);
  const all = await Promise.all(Array.from({ length: 20 }, () => get('https://x.test').then((r) => r.text())));
  assert.equal(all.length, 20);
  assert.equal(f.state.calls, 20);
  assert.equal(f.state.peak, 3);
});
