// Digesting a sentence, by hand. The sentence's own words come back with small changes that are
// definitely leads: each one names a Prolog predicate that a fragment provides, so approving it
// gives the search something real to try.
//
//   digest('count the even numbers') ->
//     { words: ['count','the','even','numbers'], content: ['count','even','numbers'],
//       numbers: [], dataType: 'list(int)', name: 'count_even',
//       leads: [{ word, frag, param, pred: 'count/2', says, change }] }

import { FRAGMENTS, TESTS, predName, stepSays } from './fragments.js';

const STOP = new Set(['the', 'a', 'an', 'of', 'in', 'to', 'and', 'all', 'my', 'some', 'it', 'its', 'them', 'they', 'this', 'that', 'is', 'are', 'be', 'up', 'give', 'me', 'find', 'get', 'make', 'then', 'list', 'numbers', 'number', 'words', 'word', 'from', 'with', 'by', 'for', 'each', 'every', 'how', 'many', 'what', 'which', 'those', 'ones', 'there', 'so', 'far', 'please']);
// words for the data (they say the type, not the operation)
const DATA = [
  [/^(numbers|integers|ints|values|marks|scores|ages|digits)$/, 'list(int)'],
  [/^(lists)$/, 'list(list(int))'],
  [/^(words|names|atoms)$/, 'list(atom)'],
  [/^(word|name|atom|string)$/, 'atom'],
  [/^(number|integer|value)$/, 'int']
];
// kept as a content word even though it is also a stop word, when it is the only operation word
const OPERATION = new Set(['count', 'how', 'many', 'number', 'each', 'every', 'so', 'far', 'up']);

export function words(sentence) {
  return String(sentence ?? '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
}

// a word's plain form: numbers -> number, doubled -> double, keeping -> keep
export function lemma(w) {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && /[^aeiou]ed$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

const NUMBER_WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twice: 2, double: 2, triple: 3, half: null };

// the fragments a word could stand for, best first
export function leadsFor(w, numbers = [], named0 = []) {
  const forms = [...new Set([w, lemma(w)])];
  const out = [];
  for (const f of FRAGMENTS) {
    const hit = f.words.some((x) => forms.includes(x) || forms.includes(lemma(x)));
    if (!hit) continue;
    if (!f.params) { out.push({ word: w, frag: f.id, param: null, change: f.name }); continue; }
    const p = f.params[0];
    if (p.name === 'test') {
      // the test the sentence names, else each test
      // the test the word itself names, else the tests the sentence names, else each test
      const own = Object.keys(TESTS).filter((t) => forms.includes(t));
      const named = own.length ? own : named0;
      for (const t of named.length ? named : Object.keys(TESTS)) out.push({ word: w, frag: f.id, param: t, change: `${f.name.replace('…', '')} ${TESTS[t].says}` });
    } else {
      const ns = numbers.length ? numbers : [NUMBER_WORDS[w] ?? 2];
      for (const n of ns) if (n !== null && n !== undefined) out.push({ word: w, frag: f.id, param: n, change: `${f.name.replace('a number', String(n))}` });
    }
  }
  return out;
}

export function digest(sentence) {
  const ws = words(sentence);
  const numbers = [];
  for (const w of ws) {
    if (/^-?\d+$/.test(w)) numbers.push(Number(w));
    else if (w in NUMBER_WORDS && NUMBER_WORDS[w] !== null && !['double', 'triple', 'twice'].includes(w)) numbers.push(NUMBER_WORDS[w]);
  }
  let dataType = null;
  for (const w of ws) for (const [re, t] of DATA) if (!dataType && re.test(w)) dataType = t;
  const content = ws.filter((w) => !/^-?\d+$/.test(w) && (!STOP.has(w) || (OPERATION.has(w) && !ws.some((x) => !STOP.has(x) && x !== w))));
  const leads = [];
  const seen = new Set();
  // a test word (even, odd...) goes with keep (or with drop after "remove", "without", "not")
  const dropping = ws.some((w) => ['remove', 'without', 'except', 'not', 'drop', 'exclude', 'delete'].includes(w));
  for (const w of [...content, ...ws.filter((w) => OPERATION.has(w) && !content.includes(w))]) {
    for (const l of leadsFor(w, numbers, ws.map(lemma).filter((x) => x in TESTS).concat(ws.filter((x) => x in TESTS)))) {
      if (dropping && l.frag === 'keep') continue;
      if (!dropping && l.frag === 'drop' && TESTS[w]) continue;
      const step = { frag: FRAGMENTS.find((f) => f.id === l.frag), param: l.param };
      const key = `${l.frag}:${l.param}`;
      if (seen.has(key)) continue;
      seen.add(key);
      leads.push({ ...l, pred: `${predName(step)}/2`, says: stepSays(step) });
    }
  }
  const named = content.filter((w) => !DATA.some(([re]) => re.test(w)));
  const name = (named.slice(0, 2).map(lemma).join('_') || 'algorithm').replace(/[^a-z0-9_]/g, '_').replace(/^(\d)/, 'p$1');
  return { words: ws, content, numbers, dataType, name, leads };
}
