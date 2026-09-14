import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllRows } from '../lib/fetch-all-rows';

function fakeTable(totalRows: number) {
  const rows = Array.from({ length: totalRows }, (_, i) => ({ id: i + 1 }));
  const calls: Array<[number, number]> = [];
  return {
    calls,
    query: (from: number, to: number) => {
      calls.push([from, to]);
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
    }
  };
}

test('a table larger than one page is paged through completely, not truncated at 1000', async () => {
  const table = fakeTable(2113);
  const { data, error } = await fetchAllRows((from, to) => table.query(from, to));
  assert.equal(error, null);
  assert.equal(data?.length, 2113);
  assert.equal(data?.[0].id, 1);
  assert.equal(data?.[2112].id, 2113);
  assert.equal(table.calls.length, 3); // 1000 + 1000 + 113
});

test('a table exactly one page long is fetched in full, with one trailing empty request to confirm the end', async () => {
  const table = fakeTable(1000);
  const { data } = await fetchAllRows((from, to) => table.query(from, to));
  assert.equal(data?.length, 1000);
  assert.equal(table.calls.length, 2); // 1000, then an empty page confirming there's no more
});

test('an empty table returns an empty array, not null', async () => {
  const table = fakeTable(0);
  const { data, error } = await fetchAllRows((from, to) => table.query(from, to));
  assert.equal(error, null);
  assert.deepEqual(data, []);
});

test('a page-boundary error short-circuits and surfaces the error without partial data', async () => {
  let call = 0;
  const { data, error } = await fetchAllRows((from, to) => {
    call += 1;
    if (call === 2) return Promise.resolve({ data: null, error: { message: 'boom' } });
    return Promise.resolve({ data: Array.from({ length: 1000 }, (_, i) => ({ id: from + i })), error: null });
  });
  assert.equal(data, null);
  assert.equal(error?.message, 'boom');
  assert.equal(call, 2);
});
