// Melting down: a new discovery as an optimisation. Rules that make a chain of fragments do less
// work and give the same answers, each with its law (why it's the same) and a check on your
// examples and on more data.
//
//   meltdowns(steps) -> [{ rule, before, after: steps | null, prolog: text | null, law, saves }]
//   sameOn(stepsA, stepsB | fn, inputs) -> { ok, inputs, counter }   (counter: an input where they differ)

import { byId, predName } from './fragments.js';
import { runSteps } from './synth.js';
import { same } from './types.js';

const S = (id, param = null) => ({ frag: byId(id), param });
const is = (s, id) => s.frag.id === id;

// each rule looks at two steps side by side (a, b) and says what does the same in one
const RULES = [
  { id: 'reverse-twice', when: (a, b) => is(a, 'reverse') && is(b, 'reverse'), to: () => [], law: 'Reversing twice gives back the list you started with.', saves: 'two passes over the list' },
  { id: 'reverse-first', when: (a, b) => is(a, 'reverse') && is(b, 'first'), to: () => [S('last')], law: 'The first of the reversed list is the last of the list.', saves: 'building a reversed copy' },
  { id: 'reverse-last', when: (a, b) => is(a, 'reverse') && is(b, 'last'), to: () => [S('first')], law: 'The last of the reversed list is the first of the list.', saves: 'a pass and a copy' },
  { id: 'sort-first', when: (a, b) => is(a, 'sort') && is(b, 'first'), to: () => [S('minimum')], law: 'The first of the sorted list is the smallest: one pass finds it without sorting.', saves: 'sorting (n log n steps) for one pass (n steps)' },
  { id: 'sort-last', when: (a, b) => is(a, 'sort') && is(b, 'last'), to: () => [S('maximum')], law: 'The last of the sorted list is the biggest: one pass finds it without sorting.', saves: 'sorting for one pass' },
  { id: 'sort-sort', when: (a, b) => (is(a, 'sort') || is(a, 'set')) && (is(b, 'sort') || is(b, 'set')), to: (a, b) => [is(a, 'set') || is(b, 'set') ? S('set') : S('sort')], law: 'Sorting a sorted list changes nothing more.', saves: 'a second sort' },
  { id: 'sort-count', when: (a, b) => (is(a, 'sort') || is(a, 'reverse')) && is(b, 'count'), to: () => [S('count')], law: 'Putting the list in another order keeps its length.', saves: 'the reordering' },
  { id: 'sort-sum', when: (a, b) => (is(a, 'sort') || is(a, 'reverse')) && (is(b, 'sum') || is(b, 'product') || is(b, 'maximum') || is(b, 'minimum')), to: (a, b) => [b], law: 'The order of the numbers does not change their sum, product, biggest or smallest.', saves: 'the reordering' },
  { id: 'add-add', when: (a, b) => is(a, 'addeach') && is(b, 'addeach'), to: (a, b) => [S('addeach', a.param + b.param)], law: 'Adding a then b to each is adding a + b to each.', saves: 'a pass and a list' },
  { id: 'times-times', when: (a, b) => is(a, 'timeseach') && is(b, 'timeseach'), to: (a, b) => [S('timeseach', a.param * b.param)], law: 'Multiplying by a then b is multiplying by a × b.', saves: 'a pass and a list' },
  {
    id: 'keep-count', when: (a, b) => is(a, 'keep') && is(b, 'count'), to: null,
    prolog: (a) => `count_${a.param}(L, N) :- foldl([X, C0, C]>>( ${a.frag.prolog.builtin(a.param).match(/>>\((.*)\), L, R\)/)[1]} -> C is C0 + 1 ; C = C0 ), L, 0, N).`,
    fn: (a) => (l) => (Array.isArray(l) ? l.filter((x) => a.frag.run([x], a.param)?.length === 1).length : undefined),
    law: 'Counting the ones you keep can be done while going through the list once, without making the kept list.', saves: 'the list of kept numbers'
  },
  {
    id: 'square-sum', when: (a, b) => is(a, 'squareeach') && is(b, 'sum'), to: null,
    prolog: () => 'sum_squares(L, S) :- foldl([X, A0, A]>>(A is A0 + X * X), L, 0, S).',
    fn: () => (l) => (Array.isArray(l) && l.every((x) => typeof x === 'number') ? l.reduce((s, x) => s + x * x, 0) : undefined),
    law: 'Squaring each then adding is adding each square as you go: one pass, no list of squares.', saves: 'the list of squares'
  },
  {
    id: 'add-sum', when: (a, b) => is(a, 'addeach') && is(b, 'sum'), to: null,
    prolog: (a) => `sum_plus(L, S) :- sum_list(L, S0), length(L, N), S is S0 + N * ${a.param}.`,
    fn: (a) => (l) => (Array.isArray(l) && l.every((x) => typeof x === 'number') ? l.reduce((s, x) => s + x, 0) + l.length * a.param : undefined),
    law: 'Adding n to each of k numbers adds k × n to their total (the distributive law).', saves: 'the list with n added'
  },
  {
    id: 'times-sum', when: (a, b) => is(a, 'timeseach') && is(b, 'sum'), to: null,
    prolog: (a) => `sum_times(L, S) :- sum_list(L, S0), S is S0 * ${a.param}.`,
    fn: (a) => (l) => (Array.isArray(l) && l.every((x) => typeof x === 'number') ? l.reduce((s, x) => s + x, 0) * a.param : undefined),
    law: 'Multiplying each by n then adding is adding then multiplying by n (the distributive law).', saves: 'a pass and a list'
  }
];

export function meltdowns(steps) {
  const out = [];
  for (let k = 0; k + 1 < steps.length; k++) {
    const a = steps[k], b = steps[k + 1];
    for (const r of RULES) {
      if (!r.when(a, b)) continue;
      if (r.to) {
        const after = [...steps.slice(0, k), ...r.to(a, b), ...steps.slice(k + 2)];
        out.push({ rule: r.id, at: k, before: steps, after, prolog: null, law: r.law, saves: r.saves });
      } else {
        const fused = r.fn(a, b);
        out.push({ rule: r.id, at: k, before: steps, after: null, fused: { steps: [...steps.slice(0, k)], fn: fused, rest: steps.slice(k + 2) }, prolog: r.prolog(a, b), law: r.law, saves: r.saves });
      }
    }
  }
  // the naive reverse in Prolog is quadratic: the accumulator version is the discovery
  for (const s of steps) if (is(s, 'reverse')) out.push({ rule: 'naive-reverse', at: steps.indexOf(s), before: steps, after: steps, methodology: { from: 'naive', to: 'recursion' }, prolog: s.frag.prolog.recursion, law: 'Appending to the end of the list each time goes through the list again and again; carrying the reversed part in an accumulator goes through it once.', saves: 'about n²/2 steps for n' });
  return out;
}

// runs a melt-down's new version (steps, or the fused function between steps)
export function runMelted(m, x) {
  if (m.after) return runSteps(m.after, x);
  let v = runSteps(m.fused.steps, x);
  if (v === undefined) return undefined;
  v = m.fused.fn(v);
  return v === undefined ? undefined : runSteps(m.fused.rest, v);
}

// more data to check on: your inputs, and lists made from them (seeded, so the check repeats)
export function moreInputs(examples, count = 40, seed = 7) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const out = examples.map((e) => e.in);
  const listy = out.some(Array.isArray);
  for (let k = 0; k < count; k++) {
    if (listy) out.push(Array.from({ length: Math.floor(rnd() * 7) }, () => Math.floor(rnd() * 21) - 10));
    else out.push(Math.floor(rnd() * 41) - 20);
  }
  return out;
}

export function checkMeltdown(m, inputs) {
  for (const x of inputs) {
    const a = runSteps(m.before, x), b = runMelted(m, x);
    if (!(a === undefined && b === undefined) && !(a !== undefined && b !== undefined && same(a, b))) return { ok: false, counter: { input: x, before: a, after: b }, inputs: inputs.length };
  }
  return { ok: true, inputs: inputs.length };
}

export const ruleIds = () => [...RULES.map((r) => r.id), 'naive-reverse'];
export const stepName = predName;
