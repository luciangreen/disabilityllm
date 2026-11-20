// The 200 inputs and outputs (io/ios.jsonl) still come out the same from the JavaScript.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeIos } from '../io/engine.mjs';
import { cases } from '../io/cases.mjs';

test('the 200 recorded inputs give the recorded outputs', async () => {
  const want = fs.readFileSync(new URL('../io/ios.jsonl', import.meta.url), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(want.length, 200);
  const got = await makeIos(cases);
  for (let k = 0; k < 200; k++) assert.deepEqual(got[k], want[k], `example ${k + 1} (${want[k].name})`);
});
