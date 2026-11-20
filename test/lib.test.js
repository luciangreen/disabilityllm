import { test } from 'node:test';
import assert from 'node:assert/strict';
import { digest } from '../lib/parse.js';
import { synthesise, nested, probe, program, safeName, check } from '../lib/synth.js';
import { abstract } from '../lib/abstract.js';
import { induce, accepts } from '../lib/grammar.js';
import { meltdowns, checkMeltdown, moreInputs } from '../lib/meltdown.js';
import { analyse, readExamples, skeleton } from '../lib/think.js';
import { germs, keywords } from '../lib/germs.js';
import { byId } from '../lib/fragments.js';
import { read, show, typeOf } from '../lib/types.js';

const ex = (pairs) => pairs.map(([i, o]) => ({ in: i, out: o }));

test('a sentence and examples give the algorithm, in Prolog', () => {
  const d = digest('count the even numbers');
  assert.deepEqual(d.leads.map((l) => l.pred), ['count/2', 'keep_even/2']);
  const sols = synthesise(ex([[[1, 2, 3, 4], 2], [[2, 4, 6], 3], [[], 0]]), { leads: d.leads });
  assert.equal(nested(sols[0].steps), 'count(keep_even(In))');
  const code = program(sols[0], { name: d.name, methodology: 'recursion' });
  assert.match(code, /count_even\(In, Out\) :-\n    keep_even\(In, A\),\n    count\(A, Out\)\./);
  assert.match(code, /keep_even\(\[\], \[\]\)\./);
});

test('when ways differ, it asks about the case that decides', () => {
  const e = ex([[[1, 8, 3, 4], 8], [[2, 6, 5], 6]]);
  const sols = synthesise(e, { leads: digest('biggest even number').leads });
  const p = probe(sols, e);
  assert.ok(p);
  assert.ok(new Set(p.answers.map((a) => JSON.stringify(a.out))).size >= 2);
  const sols2 = synthesise([...e, { in: p.input, out: 8 }], { leads: digest('biggest even number').leads });
  assert.equal(nested(sols2[0].steps), 'maximum(keep_even(In))');
});

test('the shortest chain wins unless more of what you said is used', () => {
  const sols = synthesise(ex([[[1, 2], [2, 4]], [[0, 5], [0, 10]], [[], []]]), { leads: digest('double each number').leads });
  assert.equal(nested(sols[0].steps), 'times_each_2(In)');
});

test('names SWI-Prolog has are not used for your algorithm', () => {
  assert.equal(safeName('reverse'), 'my_reverse');
  assert.equal(safeName('count_even'), 'count_even');
});

test('going up a level: sum and product become one fold', () => {
  const r = abstract(byId('sum').prolog.recursion, byId('product').prolog.recursion, 'fold');
  assert.ok(r.ok);
  assert.deepEqual(r.params.map((p) => [p.a, p.b]), [['0', '1'], ['+', '*']]);
  assert.deepEqual(r.instances, ['sum(A, B) :- fold(0, +, A, B).', 'product(A, B) :- fold(1, *, A, B).']);
  assert.equal(abstract(byId('count').prolog.recursion, byId('sum').prolog.recursion).ok, false);
});

test('strings to grammar, and its state machine', () => {
  const g = induce(['ab', 'abab', 'ababab']);
  assert.equal(g.kind, 'repeat');
  assert.equal(g.unit, 'ab');
  assert.ok(accepts(g, 'abababab'));
  assert.ok(!accepts(g, 'aba'));
  const h = induce(['xaby', 'xababy']);
  assert.equal(h.prefix, 'xab'); assert.equal(h.suffix, 'y');
  assert.ok(accepts(h, 'xabababy'));
});

test('melting down: each discovery gives the same answers', () => {
  for (const pair of [['sort', 'first'], ['keep', 'count'], ['squareeach', 'sum'], ['reverse', 'reverse']]) {
    const steps = pair.map((id) => ({ frag: byId(id), param: id === 'keep' ? 'even' : null }));
    const m = meltdowns(steps).find((x) => x.rule !== 'naive-reverse');
    assert.ok(m, pair.join(' '));
    assert.ok(checkMeltdown(m, moreInputs([{ in: [1, 2, 3] }])).ok, m.rule);
  }
});

test('Applaud finds what is missing, and the one next step', () => {
  const r = analyse('total([X|Xs], S) :- total(Xs, S0), S is S0 + X.');
  assert.ok(r.notes.some((n) => n.kind === 'base'));
  assert.equal(r.next.kind, 'base');
  const ok = analyse('total([], 0).\ntotal([X|Xs], S) :- total(Xs, S0), S is S0 + X.');
  assert.ok(ok.notes.some((n) => n.kind === 'pattern'));
  assert.equal(analyse('p(X :- .').next.kind, 'read');
  assert.match(skeleton('total', ['list(int)', 'int']), /total\(\[\], Out0\)/);
  assert.deepEqual(readExamples('?- total([1,2], S). S = 3.\n?- total(a, S).\nfalse.'), [{ goal: 'total([1,2], S)', expect: { S: '3' }, fails: false }, { goal: 'total(a, S)', expect: {}, fails: true }]);
});

test('germs say which thought they came from', () => {
  assert.deepEqual(keywords('Prolog is slow and needs optimisation through MNNs'), ['prolog', 'optimisation', 'mnns']);
  const gs = germs(['Prolog is slow and needs optimisation through MNNs'], { seed: 5, count: 3 });
  assert.equal(gs.length, 3);
  for (const g of gs) assert.equal(g.from, 'Prolog is slow and needs optimisation through MNNs');
});

test('values read and written as Prolog', () => {
  assert.deepEqual(read('[1, -2, [a]]'), [1, -2, ['a']]);
  assert.equal(show(['a', 'Hello there', 3]), "[a,'Hello there',3]");
  assert.equal(typeOf([[1], []]), 'list(list(int))');
  assert.equal(read('[1,'), null);
  assert.ok(check([{ frag: byId('sum'), param: null }], ex([[[1, 2], 3]]))[0].ok);
});
