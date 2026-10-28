// Concurrent calls with the same arguments share one promise instead of each
// starting the same work. Nothing is kept once it settles -- this only joins
// calls that overlap, so freshness is exactly what the wrapped function gives.
//
// Used where many pages ask for the same expensive data at the same moment:
// every website page's footer reads every category page ("Popular searches"),
// so a cold cache meant dozens of identical loads at once -- each ~15 queries.
export function shareInFlight<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  const pending = new Map<string, Promise<R>>();
  return (...args: A) => {
    const key = JSON.stringify(args);
    const existing = pending.get(key);
    if (existing) return existing;
    const p = fn(...args).finally(() => pending.delete(key));
    pending.set(key, p);
    return p;
  };
}
