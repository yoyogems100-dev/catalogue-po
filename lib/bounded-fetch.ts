// A fetch for the website's Supabase reads that can neither pile up nor hang.
//
// A cold build renders many website pages at once, and every page's footer
// reads every category page ("Popular searches"), so one build process fired
// ~900 Supabase requests with ~200 in flight together. Plain fetch has no
// timeout: when one of those sockets stalled, the request never settled, and
// because concurrent pages share one load (lib/in-flight.ts) every page
// waiting on it -- and Next's retries of those pages -- sat until the 60s
// export limit and failed the deploy.
//
// So: at most `maxConcurrent` requests run at once (the rest queue), each
// attempt -- body included -- gets `timeoutMs`, and a read that times out,
// drops, or gets a gateway error is tried again `retries` times.

type Options = { maxConcurrent: number; timeoutMs: number; retries: number };

const RETRY_STATUS = new Set([502, 503, 504]);
const NULL_BODY_STATUS = new Set([101, 204, 205, 304]);

export function boundedFetch({ maxConcurrent, timeoutMs, retries }: Options, base: () => typeof fetch = () => globalThis.fetch): typeof fetch {
  let running = 0;
  const waiting: (() => void)[] = [];
  const acquire = () => (running < maxConcurrent ? (running++, Promise.resolve()) : new Promise<void>((resolve) => waiting.push(resolve)));
  const release = () => { const next = waiting.shift(); if (next) next(); else running--; };

  async function attempt(input: Parameters<typeof fetch>[0], init: RequestInit | undefined): Promise<Response> {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    const res = await base()(input, { ...init, signal });
    // Read the body here, under the same timeout, so a stalled body can't hang the caller either.
    const body = NULL_BODY_STATUS.has(res.status) ? null : await res.arrayBuffer();
    return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
  }

  return async (input, init) => {
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const tries = method === 'GET' || method === 'HEAD' ? retries + 1 : 1;
    await acquire();
    try {
      for (let i = 1; ; i++) {
        try {
          const res = await attempt(input, init);
          if (i < tries && RETRY_STATUS.has(res.status)) continue;
          return res;
        } catch (err) {
          if (i >= tries || init?.signal?.aborted) throw err;
        }
      }
    } finally {
      release();
    }
  };
}
