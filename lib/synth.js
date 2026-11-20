// Spec to algorithm: find the chains of fragments that give every example's output from its input.
//
//   synthesise(examples, { leads, maxSteps, limit }) -> [{ steps: [{ frag, param }], score }]
//     examples: [{ in, out }]   leads: the approved leads from digest() (they come first)
//   program(solution, { name, methodology, sentence }) -> Prolog text
//   check(steps, examples) -> [{ in, want, got, ok }]   (got undefined: the Prolog would fail)
//
// A chain a, b, c is the nested call c(b(a(In))): in Prolog, a(In, A), b(A, B), c(B, Out).

import { FRAGMENTS, methodologies, predName, stepProlog, stepSays } from './fragments.js';
import { same, show } from './types.js';

export function runSteps(steps, x) {
  let v = x;
  for (const s of steps) {
    if (v === undefined) return undefined;
    try { v = s.frag.run(v, s.param); } catch { return undefined; }
  }
  return v;
}

export function check(steps, examples) {
  return examples.map((e) => { const got = runSteps(steps, e.in); return { in: e.in, want: e.out, got, ok: got !== undefined && same(got, e.out) }; });
}

// every fragment with each of its choices: the steps the search can use
export function allSteps(numbers = []) {
  const out = [];
  for (const f of FRAGMENTS) {
    if (!f.params) { out.push({ frag: f, param: null }); continue; }
    const vs = f.params[0].name === 'n' ? [...new Set([...numbers, ...f.params[0].values])] : f.params[0].values;
    for (const v of vs) out.push({ frag: f, param: v });
  }
  return out;
}

const keyOf = (s) => `${s.frag.id}:${s.param}`;

export function synthesise(examples, { leads = [], numbers = [], maxSteps = 3, limit = 6 } = {}) {
  if (!examples.length) return [];
  const steps = allSteps(numbers);
  const leadKeys = new Set(leads.map((l) => `${l.frag}:${l.param}`));
  const leadFrags = new Set(leads.map((l) => l.frag));
  const weight = (s) => (leadKeys.has(keyOf(s)) ? 3 : leadFrags.has(s.frag.id) ? 1 : 0);
  // steps the first example can go through: each level keeps only the values it reached
  const found = [];
  const seenSig = new Set();
  let level = [{ chain: [], vals: examples.map((e) => e.in) }];
  for (let depth = 1; depth <= maxSteps && found.length < limit * 4; depth++) {
    const next = [];
    // past two steps, only the leads (else the search grows too fast to be worth it)
    const pool = depth <= 2 ? steps : steps.filter((s) => weight(s) > 0);
    for (const node of level) {
      for (const s of pool) {
        const vals = [];
        let ok = true;
        for (const v of node.vals) {
          let r;
          try { r = s.frag.run(v, s.param); } catch { r = undefined; }
          if (r === undefined) { ok = false; break; }
          vals.push(r);
        }
        if (!ok) continue;
        const chain = [...node.chain, s];
        if (vals.every((v, k) => same(v, examples[k].out))) { found.push(chain); continue; }
        // the same values by another chain already: going on from here finds nothing new
        const sig = JSON.stringify(vals);
        if (seenSig.has(sig)) continue;
        seenSig.add(sig);
        if (depth < maxSteps) next.push({ chain, vals });
      }
    }
    level = next;
  }
  // a chain with a step that changes nothing the examples can see is not kept (take the step out
  // and it still works): what's left are the shortest ways, each with a reason for every step
  // (a step you approved as a lead stays, as it says what you mean). Two steps of a kind that
  // join into one (add 1, then add 2) are left to the one step (add 3).
  const JOIN = new Set(['addeach', 'timeseach', 'plus', 'times', 'reverse', 'sort', 'set']);
  const minimal = (chain) => chain.every((s, k) => k === 0 || !(s.frag.id === chain[k - 1].frag.id && JOIN.has(s.frag.id))) && chain.every((s, k) => {
    if (chain.length < 2 || weight(s) >= 3) return true;
    const less = chain.filter((__, j) => j !== k);
    return !examples.every((e) => { const g = runSteps(less, e.in); return g !== undefined && same(g, e.out); });
  });
  // each approved lead the chain uses counts once; each step costs more than a near-lead earns, so
  // a longer chain wins only by using more of what you said
  const score = (chain) => {
    const leadsUsed = new Set(chain.filter((s) => weight(s) >= 3).map(keyOf)).size;
    const near = chain.filter((s) => weight(s) === 1).length;
    return leadsUsed * 10 + near * 2 - chain.length * 6 - chain.filter((s) => typeof s.param === 'number' && Math.abs(s.param) > 2 && !leadKeys.has(keyOf(s))).length;
  };
  return found
    .filter(minimal)
    .map((chain) => ({ steps: chain, score: score(chain) }))
    .sort((a, b) => b.score - a.score || a.steps.length - b.steps.length)
    .slice(0, limit);
}

// another case to ask about: an input on which the ways found give different answers, so your
// answer says which way you mean (inputs near your examples: one more, one less, changed order)
export function probe(solutions, examples) {
  if (solutions.length < 2) return null;
  const tries = [];
  const extra = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (const e of examples) {
    const x = e.in;
    if (Array.isArray(x)) {
      for (const n of extra) tries.push([...x, n], [n, ...x]);
      for (let k = 0; k < x.length; k++) tries.push(x.filter((_, j) => j !== k));
      tries.push([...x].reverse(), []);
    } else if (typeof x === 'number') for (const n of extra) tries.push(x + n);
    else if (typeof x === 'string') tries.push(x + 'a', x.slice(1), '');
  }
  const known = new Set(examples.map((e) => JSON.stringify(e.in)));
  const fresh = tries.filter((t) => !known.has(JSON.stringify(t)));
  const k = (v) => (v === undefined ? '(false)' : JSON.stringify(v));
  // the first way against the second, then against the others: the best two matter most
  for (let j = 1; j < solutions.length; j++) {
    for (const t of fresh) {
      if (k(runSteps(solutions[0].steps, t)) === k(runSteps(solutions[j].steps, t))) continue;
      const distinct = new Map();
      for (const [i, sol] of solutions.entries()) { const out = runSteps(sol.steps, t); if (!distinct.has(k(out))) distinct.set(k(out), { i, out }); }
      return { input: t, answers: [...distinct.values()] };
    }
  }
  return null;
}

// the clause for the whole algorithm, and the fragments' clauses in the methodology chosen
// names SWI-Prolog already has (or a fragment uses): the algorithm is called my_<name> instead
const TAKEN = new Set(['reverse', 'append', 'length', 'sort', 'msort', 'sum_list', 'sumlist', 'max_list', 'min_list', 'last', 'member', 'memberchk', 'nth0', 'nth1', 'maplist', 'foldl', 'include', 'exclude', 'atom_length', 'list_to_set', 'succ', 'plus', 'is', 'number', 'atom', 'call', 'not', 'halt', 'true', 'fail', 'false', 'flatten', 'delete', 'subtract', 'select', 'permutation', 'between', 'numlist', 'max_member', 'min_member', 'sumlist', 'string', 'format', 'write', 'print', 'read', 'copy_term', 'findall', 'forall', 'aggregate_all']);
export function safeName(name, steps = []) {
  let n = String(name || 'algorithm').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^[^a-z]+/, '') || 'algorithm';
  if (TAKEN.has(n) || steps.some((s) => predName(s) === n)) n = `my_${n}`;
  return n;
}

export function program(sol, { name = 'algorithm', methodology = 'recursion', sentence = '' } = {}) {
  const steps = sol.steps;
  name = safeName(name, steps);
  const vars = steps.map((_, k) => (k === steps.length - 1 ? 'Out' : String.fromCharCode(65 + k)));
  const calls = steps.map((s, k) => `${predName(s)}(${k ? vars[k - 1] : 'In'}, ${vars[k]})`);
  const head = `% ${name}(+In, -Out)${sentence ? `: ${sentence.trim()}` : ''}\n% ${steps.map((s) => stepSays(s)).join(', then ')}.\n${name}(In, Out) :-\n    ${calls.join(',\n    ')}.`;
  const used = new Map();
  for (const s of steps) {
    const m = methodologies(s.frag).includes(methodology) ? methodology : methodologies(s.frag)[0];
    used.set(predName(s), stepProlog(s, m));
  }
  return [head, ...used.values()].join('\n\n') + '\n';
}

// the nested-call view: count(keep_even(In))
export function nested(steps) {
  return steps.reduce((inner, s) => `${predName(s)}(${inner})`, 'In');
}

// a Prolog goal that is true when the program gives every example's output
export function proofGoal(name, examples) {
  const pairs = examples.map((e) => `${show(e.in)}-${show(e.out)}`).join(', ');
  return `forall(member(I-O, [${pairs}]), (${name}(I, X), X == O))`;
}

// one example as the query you would type, and its answer
export function query(name, e, got) {
  return `?- ${name}(${show(e.in)}, Out).\nOut = ${got === undefined ? '(false)' : show(got)}.`;
}
