// The functions the 200 inputs and outputs come from (npm run ios). proofs/ios.pl checks every
// recorded output against the Prolog spec in proofs/spec.pl; the programs, grammars, melt-downs and
// abstractions the app writes are also run in Prolog there, on their own examples.
import { typeOf, join } from '../lib/types.js';
import { lemma, digest } from '../lib/parse.js';
import { synthesise, program, safeName } from '../lib/synth.js';
import { predict, skip, remember } from '../lib/predict.js';
import { decide } from '../lib/companion.js';
import { COURSES } from '../lib/lessons.js';
import * as P from '../lib/progress.js';
import { band } from '../lib/explain.js';
import { induce, accepts } from '../lib/grammar.js';
import { meltdowns, checkMeltdown, moreInputs } from '../lib/meltdown.js';
import { abstract } from '../lib/abstract.js';
import { byId } from '../lib/fragments.js';
import { analyse } from '../lib/think.js';

export const title = 'Disability LLM';

const VALUES = [0, 3, -2, 'a', 'cat', [], [1, 2], [1, -3, 5], ['a', 'b'], [[1], [2, 3]], [1, 'a'], [[], []], 2.5, [2.5, 1]];
const WORDS = ['numbers', 'counting', 'doubled', 'keeps', 'squares', 'lists', 'biggest', 'sorted', 'ss', 'add', 'evenly', 'families', 'running', 'bus', 'class'];
const SENTENCES = [
  ['count the even numbers', [[[1, 2, 3, 4], 2], [[2, 4, 6], 3], [[], 0]]],
  ['add up the squares', [[[1, 2, 3], 14], [[4], 16], [[], 0]]],
  ['reverse the list', [[[1, 2, 3], [3, 2, 1]], [[5], [5]], [[], []]]],
  ['add 3 to each number', [[[1, 2], [4, 5]], [[0], [3]], [[], []]]],
  ['how many different numbers', [[[1, 1, 2, 3, 3], 3], [[5], 1], [[], 0]]],
  ['biggest even number', [[[1, 8, 3, 4, 9], 8], [[2, 6, 5], 6]]],
  ['keep the positive numbers', [[[1, -2, 3], [1, 3]], [[-1], []], [[], []]]],
  ['sort the numbers', [[[3, 1, 2], [1, 2, 3]], [[2, 2, 1], [1, 2, 2]], [[], []]]],
  ['double each number', [[[1, 2], [2, 4]], [[0, 5], [0, 10]], [[], []]]],
  ['the last number', [[[1, 2, 3], 3], [[7], 7]]],
  ['running totals', [[[1, 2, 3], [1, 3, 6]], [[5], [5]], [[], []]]],
  ['join the lists', [[[[1], [2, 3]], [1, 2, 3]], [[[], [4]], [4]], [[], []]]],
  ['smallest number', [[[3, 1, 2], 1], [[5], 5]]],
  ['count the odd numbers', [[[1, 2, 3], 2], [[2, 4], 0], [[], 0]]],
  ['total of the numbers', [[[1, 2, 3], 6], [[], 0], [[-1, 1], 0]]],
  ['remove the negative numbers', [[[1, -2, 3], [1, 3]], [[-1], []], [[], []]]]
];
const STRINGS = [['ab', 'abab', 'ababab'], ['xaby', 'xababy'], ['a', 'aa', 'aaa'], ['cat', 'dog'], ['hi'], ['abcabc', 'abcabcabc'], ['0', '01', '011', '0111'], ['yes', 'no', 'maybe']];
const MELTS = [['sort', 'first'], ['reverse', 'reverse'], ['reverse', 'first'], ['keep:even', 'count'], ['squareeach', 'sum'], ['addeach:3', 'sum'], ['timeseach:2', 'sum'], ['sort', 'last'], ['addeach:1', 'addeach:2'], ['sort', 'sum'], ['set', 'sort'], ['timeseach:2', 'timeseach:3']];
const PAIRS = [['sum', 'product'], ['keep:even', 'keep:odd'], ['addeach:1', 'timeseach:2'], ['keep:positive', 'drop:negative'], ['count', 'sum'], ['addeach:2', 'addeach:5']];
const CODES = [
  'len([], 0).\nlen([_|T], N) :- len(T, N0), N is N0 + 1.',
  'bad(X, Y) :- Y is Z + 1, foo(X).',
  'loop(X) :- loop(X).',
  'p([H|T], S) :- p(T, S0), S is S0 + H.',
  'total([], 0).\ntotal([X|Xs], S) :- total(Xs, S0), S is S0 + X.',
  'q(X) :- r(X), s(Y).',
  'oops(X :- .',
  'mul([], 1).\nmul([X|Xs], P) :- mul(Xs, P0), P is P0 * X.'
];

const step = (s) => { const [id, p] = s.split(':'); return { frag: byId(id), param: p === undefined ? null : Number.isNaN(Number(p)) ? p : Number(p) }; };
const memOf = (rnd) => Array.from({ length: rnd.int(0, 6) }, () => ({ kind: rnd.pick(['lead', 'methodology']), context: rnd.pick(['', 'sum:null', 'keep:even']), choice: rnd.pick(['yes', 'no', 'recursion', 'builtin']) }));

export const cases = [
  { name: 'typeOf', make: (r) => [r.pick(VALUES)], run: (v) => typeOf(v) },
  { name: 'join', make: (r) => [r.pick(['int', 'float', 'number', 'atom', 'any', 'list(int)', 'list(any)', 'list(float)', 'list(atom)']), r.pick(['int', 'float', 'any', 'atom', 'list(int)', 'list(any)', 'list(number)'])], run: (a, b) => join(a, b) },
  { name: 'lemma', make: (r) => [r.pick(WORDS)], run: (w) => lemma(w) },
  { name: 'digest', make: (r) => [r.pick(SENTENCES)[0]], run: (s) => { const d = digest(s); return { name: d.name, numbers: d.numbers, dataType: d.dataType, leads: d.leads.map((l) => l.pred) }; } },
  {
    name: 'synthesise', make: (r) => [r.pick(SENTENCES), r.pick(['recursion', 'builtin', 'foldl'])],
    run: ([s, exs], m) => {
      const examples = exs.map(([i, o]) => ({ in: i, out: o }));
      const d = digest(s);
      const sol = synthesise(examples, { leads: d.leads, numbers: d.numbers })[0];
      if (!sol) return { found: false };
      const name = safeName(d.name, sol.steps);
      return { found: true, name, chain: sol.steps.map((x) => `${x.frag.id}:${x.param}`), program: program(sol, { name, methodology: m, sentence: s }), examples: exs };
    }
  },
  { name: 'predict', make: (r) => [memOf(r), r.pick(['lead', 'methodology']), r.pick(['', 'sum:null', 'keep:even'])], run: (m, k, c) => predict(m, k, c) },
  { name: 'skip', make: (r) => [memOf(r), r.pick(['lead', 'methodology']), r.pick(['', 'sum:null']), r.chance(0.8)], run: (m, k, c, on) => skip(m, k, c, on) },
  { name: 'remember', make: (r) => [memOf(r), { kind: r.pick(['lead', '']), context: r.pick(['', 'x']), choice: r.pick(['yes', '', 'no']) }], run: (m, e) => remember(m, e).length },
  {
    name: 'decide', make: (r) => [{ lastInput: r.int(0, 30) * 1000, lastResolved: r.chance(0.7) ? r.int(0, 30) * 1000 : 0, lastSpoke: r.chance(0.5) ? r.int(0, 30) * 1000 : 0, problem: r.chance(0.2) ? 'an example fails' : null, thoughts: r.chance(0.5) ? ['tea', 'logic'] : [], turn: r.int(0, 7), concentrating: r.chance(0.15) }, r.int(10, 45) * 1000],
    run: (st, now) => decide(st, now)
  },
  {
    name: 'answer', make: (r) => { const c = r.pick(COURSES); return [c.id, r.int(0, c.steps.length), r.chance(0.6)]; },
    run: (cid, at, right) => { const c = COURSES.find((x) => x.id === cid); const pl = { course: cid, step: at, done: c.steps.slice(0, at).map((s) => s.id), wrong: {} }; const n = P.answer(c, pl, right); return { step: n.step, done: n.done.length, wrong: Object.values(n.wrong).reduce((a, b) => a + b, 0) }; }
  },
  { name: 'band', make: (r) => [r.int(0, 16)], run: (y) => band(y) },
  { name: 'progress', make: (r) => [r.int(0, 22)], run: (n) => P.progress(COURSES, { done: COURSES.flatMap((c) => c.steps.map((x) => x.id)).slice(0, n) }) },
  { name: 'induce', make: (r) => [r.pick(STRINGS)], run: (ss) => { const g = induce(ss); return { kind: g.kind, prefix: g.prefix ?? null, unit: g.unit ?? null, suffix: g.suffix ?? null, min: g.min ?? null, dcg: g.dcg }; } },
  { name: 'accepts', make: (r) => [r.pick(STRINGS), r.pick(['ab', 'abababab', 'aba', '', 'xabababy', 'aaaa', 'cat', 'dogs', '01111', 'abcabcabcabc', 'maybe'])], run: (ss, t) => accepts(induce(ss), t) },
  {
    name: 'meltdown', make: (r) => [r.pick(MELTS)],
    run: (chain) => { const steps = chain.map(step); const ms = meltdowns(steps).filter((m) => m.rule !== 'naive-reverse'); const m = ms[0]; if (!m) return { found: false }; const c = checkMeltdown(m, moreInputs([{ in: [1, 2, 3] }], 20)); return { found: true, rule: m.rule, after: m.after ? m.after.map((s) => `${s.frag.id}:${s.param}`) : null, prolog: m.prolog, ok: c.ok }; }
  },
  {
    name: 'abstract', make: (r) => [r.pick(PAIRS)],
    run: ([a, b]) => { const code = (s) => { const st = step(s); const r = st.frag.prolog.recursion; return typeof r === 'function' ? r(st.param) : r; }; const x = abstract(code(a), code(b), 'gen'); return x.ok ? { ok: true, from: x.from, params: x.params.map((p) => [p.name, p.a, p.b]), general: x.general, instances: x.instances, originals: [code(a), code(b)] } : { ok: false, why: x.why, originals: [code(a), code(b)] }; }
  },
  { name: 'analyse', make: (r) => [r.pick(CODES)], run: (t) => { const a = analyse(t); return { ok: a.ok, kinds: a.notes.map((n) => n.kind).sort(), next: a.next.kind }; } }
];
