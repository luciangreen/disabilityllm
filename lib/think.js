// The working pane's assistant: the ways of thinking that help most when writing an algorithm,
// done as algorithms on your Prolog (no language model):
//   1. say what it is for: a signature (name, arguments, modes) and examples;
//   2. base case first, then the recursive case that makes the data smaller;
//   3. check each clause: names defined, singletons, arithmetic in the right order;
//   4. see a known pattern (a fold, a map, a filter) and say it;
//   5. explain it back, and suggest the one next step.
//
//   analyse(text) -> { ok, error?, preds: [{ name, arity, clauses, base, recursive }], notes: [note], next: note | null }
//   note: { kind, pred?, clause?, text, fix?: { label, insert } }
//   skeleton(name, types) -> Prolog text for a predicate on those argument types

import { readClauses, write } from './term.js';
import { abstract } from './abstract.js';
import { FRAGMENTS } from './fragments.js';

export const BUILTINS = new Set(['is/2', '=/2', '\\=/2', '==/2', '\\==/2', '=:=/2', '=\\=/2', '</2', '>/2', '=</2', '>=/2', '=../2', ',/2', ';/2', '->/2', '\\+/1', 'true/0', 'fail/0', 'false/0', '!/0',
  'append/3', 'append/2', 'length/2', 'member/2', 'memberchk/2', 'reverse/2', 'nth0/3', 'nth1/3', 'last/2', 'msort/2', 'sort/2', 'sort/4', 'predsort/3', 'sum_list/2', 'sumlist/2', 'max_list/2', 'min_list/2', 'list_to_set/2', 'numlist/3', 'exclude/3', 'include/3', 'partition/4',
  'maplist/2', 'maplist/3', 'maplist/4', 'maplist/5', 'foldl/4', 'foldl/5', 'foldl/6', 'forall/2', 'findall/3', 'findall/4', 'bagof/3', 'setof/3', 'aggregate_all/3', 'between/3', 'succ/2', 'plus/3', 'call/1', 'call/2', 'call/3', 'call/4', 'call/5', 'once/1', 'ignore/1', 'not/1',
  'atom/1', 'number/1', 'integer/1', 'float/1', 'var/1', 'nonvar/1', 'compound/1', 'is_list/1', 'atomic/1', 'callable/1', 'ground/1', 'string/1',
  'atom_length/2', 'atom_chars/2', 'atom_codes/2', 'atom_string/2', 'atom_number/2', 'number_codes/2', 'number_string/2', 'char_code/2', 'atom_concat/3', 'atomic_list_concat/2', 'atomic_list_concat/3', 'sub_atom/5', 'upcase_atom/2', 'downcase_atom/2',
  'string_concat/3', 'string_chars/2', 'string_codes/2', 'string_length/2', 'split_string/4', 'sub_string/5', 'string_lower/2', 'string_upper/2', 'term_to_atom/2', 'term_string/2', 'code_type/2', 'char_type/2',
  'write/1', 'writeln/1', 'print/1', 'nl/0', 'format/1', 'format/2', 'format/3', 'read/1', 'read_term/2', 'read_line_to_string/2', 'write_canonical/1', 'writeq/1', 'tab/1',
  'assert/1', 'asserta/1', 'assertz/1', 'retract/1', 'retractall/1', 'copy_term/2', 'functor/3', 'arg/3', 'phrase/2', 'phrase/3', 'select/3', 'selectchk/3', 'subtract/3', 'intersection/3', 'union/3', 'delete/3', 'exclude/3', 'permutation/2', 'flatten/2', 'sumlist/3', 'max_member/2', 'min_member/2', 'nb_getval/2', 'b_getval/2', 'nb_setval/2', 'b_setval/2', 'tab/2', 'halt/0', 'halt/1', 'catch/3', 'throw/1', 'string_code/3', 'number_vars/3', 'succ_or_fail/0', 'dif/2']);

const flatGoals = (g, out = []) => { if ('f' in g && (g.f === ',' || g.f === ';' || g.f === '->') && g.args.length === 2) { flatGoals(g.args[0], out); flatGoals(g.args[1], out); } else if ('f' in g && g.f === '\\+' && g.args.length === 1) flatGoals(g.args[0], out); else out.push(g); return out; };
const keyOf = (t) => ('f' in t ? `${t.f}/${t.args.length}` : 'a' in t ? `${t.a}/0` : null);
const varsOf = (t, out = []) => { if ('v' in t) out.push(t.v); else if ('f' in t) for (const a of t.args) varsOf(a, out); return out; };

function headBody(c) {
  if ('f' in c && c.f === ':-' && c.args.length === 2) return [c.args[0], c.args[1]];
  if ('f' in c && c.f === '-->' ) return [null, null];
  return [c, null];
}

// a lambda's body or a meta call's goal: not checked as a call to your own predicates
const META = new Set(['>>/2', 'findall/3', 'forall/2', 'maplist/2', 'maplist/3', 'maplist/4', 'foldl/4', 'foldl/5', 'foldl/6', 'include/3', 'exclude/3', 'aggregate_all/3', 'call/1', 'call/2', 'call/3', 'once/1', 'ignore/1', '\\+/1', 'bagof/3', 'setof/3', 'catch/3']);

export function analyse(text) {
  if (!String(text).trim()) return { ok: true, preds: [], notes: [], next: { kind: 'start', text: 'Start with what it is for: write a comment like % total(+List, -Sum): adds up the numbers. Then I can give you a skeleton.' } };
  let cs;
  try { cs = readClauses(text); } catch (e) { const n = { kind: 'read', text: `It doesn't read as Prolog yet: ${e.message}. Look for a missing full stop, comma or bracket.` }; return { ok: false, error: e.message, preds: [], notes: [n], next: n }; }
  const notes = [];
  const preds = new Map();
  cs.forEach((c, i) => {
    const [h, b] = headBody(c);
    if (!h) return; // grammar rules are left as they are
    const k = keyOf(h);
    if (!k) return;
    if (!preds.has(k)) preds.set(k, { key: k, name: k.split('/')[0], arity: Number(k.split('/')[1]), clauses: [], base: 0, recursive: 0 });
    const p = preds.get(k);
    const goals = b ? flatGoals(b) : [];
    const rec = goals.some((g) => keyOf(g) === k);
    p.clauses.push({ i, head: h, goals, rec });
    if (rec) p.recursive++; else p.base++;
  });
  const defined = new Set(preds.keys());
  // dcg rules define name/(arity+2)
  for (const c of cs) if ('f' in c && c.f === '-->') { const h = c.args[0]; const k = keyOf(h); if (k) defined.add(`${k.split('/')[0]}/${Number(k.split('/')[1]) + 2}`); }

  for (const p of preds.values()) {
    for (const cl of p.clauses) {
      // 3a. names called but not defined
      for (const g of cl.goals) {
        const k = keyOf(g);
        if (!k || defined.has(k) || BUILTINS.has(k) || META.has(k) || 'v' in g) continue;
        notes.push({ kind: 'undefined', pred: p.key, clause: cl.i, text: `Clause ${cl.i + 1} calls ${k}, which isn't defined here.`, fix: { label: `Add a clause for ${k}`, insert: `\n${write(g)} :-\n    true. % TODO: say when ${k} is true\n` } });
      }
      // 3b. singletons: a variable used once is usually a misspelling, or should be _
      const all = varsOf(cl.head).concat(...cl.goals.map((g) => varsOf(g)));
      const counts = new Map(); for (const v of all) counts.set(v, (counts.get(v) ?? 0) + 1);
      for (const [v, n] of counts) if (n === 1 && !v.startsWith('_')) notes.push({ kind: 'singleton', pred: p.key, clause: cl.i, text: `In clause ${cl.i + 1} of ${p.key}, ${v} appears only once: is it a misspelling, or should it be _${v}?` });
      // 3c. arithmetic: the right of is must be known (from the head or an earlier goal)
      const known = new Set(varsOf(cl.head));
      for (const g of cl.goals) {
        if ('f' in g && g.f === 'is' && g.args.length === 2) {
          const unknown = varsOf(g.args[1]).filter((v) => !known.has(v));
          if (unknown.length) notes.push({ kind: 'order', pred: p.key, clause: cl.i, text: `In clause ${cl.i + 1} of ${p.key}, ${write(g)} needs ${unknown.join(', ')} first: put the goal that makes ${unknown.length > 1 ? 'them' : 'it'} before it.` });
        }
        for (const v of varsOf(g)) known.add(v);
      }
      // 2b. a recursive call should be on something smaller
      if (cl.rec) {
        const call = cl.goals.find((g) => keyOf(g) === p.key);
        const same = call.args.every((a, k) => write(a) === write(cl.head.args[k]));
        if (same) notes.push({ kind: 'loop', pred: p.key, clause: cl.i, text: `Clause ${cl.i + 1} of ${p.key} calls itself with the same arguments: it would never stop. Call it on a smaller part (the tail of a list, N - 1).` });
      }
    }
    // 2a. recursion needs a base case
    if (p.recursive && !p.base) notes.push({ kind: 'base', pred: p.key, text: `${p.key} always calls itself: it needs a base case (for the empty list, or 0) to stop.`, fix: { label: 'Add a base case for []', insert: `\n${p.name}([]${', _'.repeat(Math.max(0, p.arity - 1))}). % TODO: what is true for the empty list?\n` } });
  }

  // 4. known patterns: your predicate is a fragment's recursion with a different number or operation
  const srcOf = (p) => p.clauses.map((cl) => write(cs[cl.i]) + '.').join('\n');
  for (const p of preds.values()) {
    if (!p.recursive) continue;
    for (const f of FRAGMENTS) {
      const r = f.prolog.recursion;
      if (typeof r !== 'string' || p.clauses.length !== r.split('\n').length) continue;
      const a = abstract(srcOf(p), r, 'gen');
      if (a.ok && a.params.length <= 2) {
        const same = a.params.every((x) => x.a === x.b);
        notes.push({ kind: 'pattern', pred: p.key, text: same ? `${p.key} works like the ${f.id} fragment (${f.says}).` : `${p.key} is the ${f.id} pattern with ${a.params.map((x) => `${x.a} where ${f.id} has ${x.b}`).join(' and ')}: a fold. Its one-line form: ${foldForm(p, a)}`, pattern: f.id });
        break;
      }
    }
  }

  const order = ['read', 'undefined', 'base', 'loop', 'order', 'singleton', 'pattern'];
  const next = [...notes].sort((x, y) => order.indexOf(x.kind) - order.indexOf(y.kind))[0] ?? { kind: 'examples', text: 'It reads well. Next, give an example to try: a query and the answer you expect.' };
  return { ok: true, preds: [...preds.values()].map(({ key, name, arity, clauses, base, recursive }) => ({ key, name, arity, clauses: clauses.length, base, recursive })), notes, next };
}

function foldForm(p, a) {
  const op = a.params.find((x) => x.kind === 'op')?.a ?? '+';
  const id = a.params.find((x) => x.kind === 'value')?.a ?? '0';
  return `${p.name}(L, R) :- foldl([X, A0, A]>>(A is A0 ${op} X), L, ${id}, R).`;
}

// a skeleton from what you said: the base case and the recursive case for the first argument's type
export function skeleton(name, types) {
  const n = String(name || 'algorithm').replace(/[^a-z0-9_]/g, '_');
  const others = types.slice(1).map((t, k) => (k === types.length - 2 ? 'Out' : `A${k + 1}`));
  const rest = others.length ? `, ${others.join(', ')}` : '';
  if (/^list/.test(types[0] ?? '')) {
    return `% ${n}(+List${types.slice(1).map((t, k) => (k === types.length - 2 ? ', -Out' : `, +A${k + 1}`)).join('')})\n${n}([]${others.length ? `, ${others.map((v) => (v === 'Out' ? 'Out0' : v)).join(', ')}` : ''}) :-\n    true. % TODO: the answer for the empty list (Out0)\n${n}([X|Xs]${rest}) :-\n    ${n}(Xs${others.length ? `, ${others.map((v) => (v === 'Out' ? 'Out1' : v)).join(', ')}` : ''}),\n    true. % TODO: Out from X and Out1\n`;
  }
  if (types[0] === 'int') return `% ${n}(+N${others.length ? ', -Out' : ''})\n${n}(0${others.length ? ', Out' : ''}) :-\n    true. % TODO: the answer for 0\n${n}(N${rest}) :-\n    N > 0, N1 is N - 1,\n    ${n}(N1${others.length ? ', Out1' : ''}),\n    true. % TODO: Out from N and Out1\n`;
  return `% ${n}(+In, -Out)\n${n}(In, Out) :-\n    Out = In. % TODO\n`;
}

// "?- p([1,2], X). X = 3." -> { goal: 'p([1,2], X)', expect: { X: '3' } } (several on separate lines)
export function readExamples(text) {
  const out = [];
  const lines = String(text).split('\n');
  for (let k = 0; k < lines.length; k++) {
    const q = /^\s*\?-\s*(.+)$/.exec(lines[k]);
    if (!q) continue;
    // the goal ends at its full stop; its answer is on the same line after it, or on the next line
    const [goal, after] = splitStop(q[1]);
    if (!goal) continue;
    const answer = after.trim() || (lines[k + 1] && !/^\s*\?-/.test(lines[k + 1]) ? lines[k + 1] : '');
    const expect = {};
    const ans = /^\s*([A-Z_][A-Za-z0-9_]*\s*=\s*.+?)\.?\s*$/.exec(answer);
    let fails = false;
    if (ans) for (const part of splitTop(ans[1])) { const mm = /^\s*([A-Z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/.exec(part); if (mm) expect[mm[1]] = mm[2]; }
    else if (/^\s*(false|no)\.?\s*$/.test(answer)) fails = true;
    out.push({ goal, expect, fails });
  }
  return out;
}

// "p(X). X = 3." -> ['p(X)', ' X = 3.']: the first full stop outside brackets and quotes
function splitStop(s) {
  let depth = 0, quote = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === "'" || c === '"') { quote = c; continue; }
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === '.' && depth === 0 && (i + 1 === s.length || /\s/.test(s[i + 1]))) return [s.slice(0, i).trim(), s.slice(i + 1)];
  }
  return [null, ''];
}

function splitTop(s) {
  const out = []; let depth = 0, cur = '';
  for (const c of s) { if ('([{'.includes(c)) depth++; if (')]}'.includes(c)) depth--; if (c === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += c; }
  if (cur.trim()) out.push(cur);
  return out;
}

// a goal that prints each example's result as a line: ok, fail or got(Values)
export function examplesGoal(examples) {
  return examples.map((e, k) => {
    const vs = Object.keys(e.expect);
    const want = vs.map((v) => `${v} == ${e.expect[v]}`).join(', ');
    if (e.fails) return `\\+ \\+ ( \\+ (${e.goal}) -> writeln(ex(${k}, ok)) ; writeln(ex(${k}, unexpected_true)) )`;
    // each in \+ \+ ( ... ), so one example's variables don't carry into the next
    return `\\+ \\+ ( catch((${e.goal}), Err, (print_message(error, Err), fail)) -> ( ${want || 'true'} -> writeln(ex(${k}, ok)) ; ${vs.length ? `print(ex(${k}, got([${vs.join(', ')}]))), nl` : 'true'} ) ; writeln(ex(${k}, failed)) )`;
  }).join(', ');
}
