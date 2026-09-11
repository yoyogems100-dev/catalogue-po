import test from 'node:test';
import assert from 'node:assert/strict';
import { isHot, rankOptions } from '../lib/hot-selling';
test('hot options precede selected regular options, with stable order inside each group', () => {
 const options = [1,2,3,4,5].map(id=>({id}));
 assert.deepEqual(rankOptions(options,new Set([1,4]),o=>o.id===3||o.id===4).map(o=>o.id),[4,3,1,2,5]);
 assert.deepEqual(options.map(o=>o.id),[1,2,3,4,5]);
});
test('grouped sizes use real database IDs, and flag types cannot collide', () => {
 const flags = {'size:91':true,'color:2':true};
 assert.equal(isHot(flags,'size',[90,91]),true);
 assert.equal(isHot(flags,'size',[0]),false);
 assert.equal(isHot(flags,'shape',[2]),false);
 assert.equal(isHot(flags,undefined,[2]),false);
 assert.equal(isHot({},'color',[2]),false);
});
