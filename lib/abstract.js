// Going up a level: two predicates that work the same way become one higher-order predicate, and
// each of them becomes a call to it. This is anti-unification (the least general generalisation):
// where the two differ, the general one has a variable (a number or name it is given), or, where
// they apply different operations (+ and *), an operation it is given.
//
//   abstract(sumText, productText, 'fold') ->
//     { ok, name, params: [{ name: 'Id', a: '0', b: '1' }, { name: 'Op', a: '+', b: '*' }],
//       general: 'fold(Id, Op, [], Id).\n...', instances: ['sum(A, B) :- fold(0, +, A, B).', ...] }

import { readClauses, write } from './term.js';

const headOf = (c) => (c.f === ':-' || c.f === '-->' ? c.args[0] : c);
const keyOf = (t) => ('f' in t ? `${t.f}/${t.args.length}` : 'a' in t ? `${t.a}/0` : null);

export function abstract(textA, textB, newName = 'general') {
  let ca, cb;
  try { ca = readClauses(textA); cb = readClauses(textB); } catch (e) { return { ok: false, why: `One of them doesn't read as Prolog: ${e.message}` }; }
  if (!ca.length || ca.length !== cb.length) return { ok: false, why: `They have ${ca.length} and ${cb.length} clauses: to go up a level they need the same number, in the same order.` };
  const ka = keyOf(headOf(ca[0])), kb = keyOf(headOf(cb[0]));
  if (!ka || !kb) return { ok: false, why: 'A clause has no head.' };
  if (ca.some((c) => keyOf(headOf(c)) !== ka) || cb.some((c) => keyOf(headOf(c)) !== kb)) return { ok: false, why: 'Each one should define one predicate (its clauses all with the same name).' };
  if (ka.split('/')[1] !== kb.split('/')[1]) return { ok: false, why: `${ka} and ${kb} take different numbers of arguments.` };
  const nameA = ka.split('/')[0], nameB = kb.split('/')[0];

  const params = [];            // differences that become arguments: { name, a, b, kind }
  const pairVar = new Map();    // a pair of differing subterms -> the variable for it (shared across clauses)
  const PARAMS = ['P', 'Q', 'R', 'S', 'T'];
  let fresh = 0;

  function param(a, b, kind) {
    const k = `${kind}:${write(a)}|${write(b)}`;
    if (!pairVar.has(k)) {
      const name = kind === 'op' ? (params.some((p) => p.kind === 'op') ? `Op${params.filter((p) => p.kind === 'op').length + 1}` : 'Op') : PARAMS[params.filter((p) => p.kind === 'value').length] ?? `V${params.length}`;
      params.push({ name, a: write(a), b: write(b), kind });
      pairVar.set(k, name);
    }
    return { v: pairVar.get(k) };
  }

  // within one clause pair: their variables, paired (X in one with Y in the other: one variable)
  let localVars;
  function lgg(a, b) {
    if ('v' in a && 'v' in b) {
      const k = `${a.v}|${b.v}`;
      if (!localVars.has(k)) localVars.set(k, a.v === b.v ? a.v : `${a.v}${b.v === a.v ? '' : '_' + (++fresh)}`);
      return { v: localVars.get(k) };
    }
    if ('n' in a && 'n' in b && a.n === b.n) return a;
    if ('a' in a && 'a' in b && a.a === b.a) return a;
    if ('f' in a && 'f' in b && a.args.length === b.args.length) {
      // the predicate itself (in a head or a recursive call): the general name, given the parameters
      if (a.f === nameA && b.f === nameB) return { f: newName, args: a.args.map((x, k) => lgg(x, b.args[k])), gen: true };
      if (a.f === b.f) return { f: a.f, args: a.args.map((x, k) => lgg(x, b.args[k])) };
      // two operations: applied the same way, so the operation is given
      if (a.args.length === 2 && /^[+\-*/^]|^(max|min|mod|\/\/)$/.test(a.f) && /^[+\-*/^]|^(max|min|mod|\/\/)$/.test(b.f)) {
        return { app: param({ a: a.f }, { a: b.f }, 'op'), args: a.args.map((x, k) => lgg(x, b.args[k])) };
      }
    }
    if (('n' in a || 'a' in a) && ('n' in b || 'a' in b)) return param(a, b, 'value');
    return null; // too different to say how they are the same
  }

  const general = [];
  for (let k = 0; k < ca.length; k++) {
    localVars = new Map();
    const g = lgg(ca[k], cb[k]);
    if (!g || JSON.stringify(g).includes('null')) return { ok: false, why: `Clause ${k + 1} of each is too different (more than a number or an operation apart).` };
    general.push(g);
  }
  if (!params.length) return { ok: false, why: 'They are the same apart from their names: nothing to go up to.' };

  // write the general clauses: the parameters go first in each call; an applied operation is
  // built with =.. just before the goal that uses it
  const pv = params.map((p) => ({ v: p.name }));
  let tmp = 0;
  function body(t, pre) {
    if (t.app) { const name = `E${++tmp}`; pre.push({ f: '=..', args: [{ v: name }, { f: '[|]', args: [t.app, t.args.map((x) => body(x, pre)).reduceRight((tl, h) => ({ f: '[|]', args: [h, tl] }), { a: '[]' })] }] }); return { v: name }; }
    if ('f' in t) { const args = t.args.map((x) => body(x, pre)); return { f: t.f, args: t.gen ? [...pv, ...args] : args }; }
    return t;
  }
  function goal(t) {
    if ('f' in t && (t.f === ',' || t.f === ';' || t.f === '->')) return { f: t.f, args: t.args.map(goal) };
    const pre = []; const g = body(t, pre);
    return [...pre, g].reduceRight((acc, x) => (acc ? { f: ',', args: [x, acc] } : x), null);
  }
  const clauses = general.map((c) => {
    if (c.f === ':-') { const pre = []; const head = body(c.args[0], pre); return { f: ':-', args: [head, goal(c.args[1])] }; }
    const pre = []; return body(c, pre);
  });
  const arity = Number(ka.split('/')[1]);
  const args = Array.from({ length: arity }, (_, k) => ({ v: String.fromCharCode(65 + k) }));
  const inst = (nm, side) => write({ f: ':-', args: [{ f: nm, args }, { f: newName, args: [...params.map((p) => side === 'a' ? readOne(p.a) : readOne(p.b)), ...args] }] }) + '.';
  return {
    ok: true, name: newName, from: [nameA, nameB], params,
    general: clauses.map((c) => write(c) + '.').join('\n'),
    instances: [inst(nameA, 'a'), inst(nameB, 'b')]
  };
}

function readOne(text) { try { return readClauses(`x(${text}) .`)[0].args[0]; } catch { return { a: text }; } }

// the levels above an algorithm (the paradigms the app can go up to), with what each one adds
export const PARADIGMS = [
  { id: 'fold', name: 'Higher-order predicates', from: 'two predicates that differ by a number or an operation', adds: 'one predicate given the number and operation (foldl, maplist)' },
  { id: 'grammar', name: 'Strings to grammar', from: 'example strings', adds: 'a grammar (DCG) that makes them, which is also a state machine' },
  { id: 'statemachine', name: 'State machines', from: 'a grammar with one repeating part', adds: 'states and moves you can draw and run' },
  { id: 'spec', name: 'Spec to algorithm', from: 'a sentence and examples', adds: 'a chain of fragments, nested predicate calls' },
  { id: 'format', name: 'Predicate format finder', from: 'example calls', adds: 'the types and modes of each argument' },
  { id: 'combine', name: 'Combination algorithm writer', from: 'fragments that each work on part of the data', adds: 'their combinations, checked against your examples' }
];
