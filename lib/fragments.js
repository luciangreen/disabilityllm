// Algorithm fragments: small Prolog predicates that each do one thing, with the same thing done in
// JavaScript so the app can try them on your data at once. Each one has:
//   id, name, words (what a sentence might say for it), in/out types,
//   params (a fragment with a choice in it, such as which test to keep by),
//   run(value, param) -> the output, or undefined when the Prolog would fail,
//   prolog: { methodology: clauses }  (the same predicate written different ways),
//   says: what it does, in a sentence for any reader.
// Prolog arithmetic is followed exactly: mod takes the divisor's sign, integers stay integers.

const mod = (a, b) => ((a % b) + b) % b;
const isNum = (x) => typeof x === 'number';
const nums = (l) => Array.isArray(l) && l.every(isNum);

export const TESTS = {
  even: { says: 'is even', js: (x) => isNum(x) && Number.isInteger(x) && mod(x, 2) === 0, pl: 'X mod 2 =:= 0' },
  odd: { says: 'is odd', js: (x) => isNum(x) && Number.isInteger(x) && mod(x, 2) === 1, pl: 'X mod 2 =:= 1' },
  positive: { says: 'is more than zero', js: (x) => isNum(x) && x > 0, pl: 'X > 0' },
  negative: { says: 'is less than zero', js: (x) => isNum(x) && x < 0, pl: 'X < 0' },
  nonzero: { says: 'is not zero', js: (x) => isNum(x) && x !== 0, pl: 'X =\\= 0' }
};
// the tests' JavaScript needs whole numbers for even and odd, as Prolog's mod does
const testable = (l, t) => Array.isArray(l) && l.every((x) => isNum(x) && (!['even', 'odd'].includes(t) || Number.isInteger(x)));

const SMALL = [1, 2, 3, 4, 5, 10, -1];

export const FRAGMENTS = [
  {
    id: 'sum', name: 'add them up', words: ['sum', 'total', 'add', 'plus', 'altogether', 'addition'], in: 'list(number)', out: 'number',
    run: (l) => (nums(l) ? l.reduce((a, b) => a + b, 0) : undefined),
    prolog: {
      builtin: 'sum(L, S) :- sum_list(L, S).',
      recursion: 'sum([], 0).\nsum([X|Xs], S) :- sum(Xs, S0), S is S0 + X.',
      foldl: 'sum(L, S) :- foldl([X, A0, A]>>(A is A0 + X), L, 0, S).'
    },
    says: 'adds all the numbers together'
  },
  {
    id: 'product', name: 'multiply them together', words: ['product', 'multiply', 'times', 'multiplied'], in: 'list(number)', out: 'number',
    run: (l) => (nums(l) ? l.reduce((a, b) => a * b, 1) : undefined),
    prolog: {
      recursion: 'product([], 1).\nproduct([X|Xs], P) :- product(Xs, P0), P is P0 * X.',
      foldl: 'product(L, P) :- foldl([X, A0, A]>>(A is A0 * X), L, 1, P).'
    },
    says: 'multiplies all the numbers together'
  },
  {
    id: 'count', name: 'count them', words: ['count', 'length', 'how', 'many', 'number', 'size'], in: 'list(any)', out: 'int',
    run: (l) => (Array.isArray(l) ? l.length : undefined),
    prolog: {
      builtin: 'count(L, N) :- length(L, N).',
      recursion: 'count([], 0).\ncount([_|Xs], N) :- count(Xs, N0), N is N0 + 1.'
    },
    says: 'counts how many things are in the list'
  },
  {
    id: 'maximum', name: 'the biggest', words: ['maximum', 'max', 'biggest', 'largest', 'highest', 'most', 'greatest'], in: 'list(number)', out: 'number',
    run: (l) => (nums(l) && l.length ? Math.max(...l) : undefined),
    prolog: {
      builtin: 'maximum(L, M) :- max_list(L, M).',
      recursion: 'maximum([X], X).\nmaximum([X|Xs], M) :- Xs = [_|_], maximum(Xs, M0), M is max(X, M0).'
    },
    says: 'finds the biggest number'
  },
  {
    id: 'minimum', name: 'the smallest', words: ['minimum', 'min', 'smallest', 'least', 'lowest', 'fewest'], in: 'list(number)', out: 'number',
    run: (l) => (nums(l) && l.length ? Math.min(...l) : undefined),
    prolog: {
      builtin: 'minimum(L, M) :- min_list(L, M).',
      recursion: 'minimum([X], X).\nminimum([X|Xs], M) :- Xs = [_|_], minimum(Xs, M0), M is min(X, M0).'
    },
    says: 'finds the smallest number'
  },
  {
    id: 'first', name: 'the first one', words: ['first', 'head', 'front', 'start', 'beginning'], in: 'list(any)', out: 'any',
    run: (l) => (Array.isArray(l) && l.length ? l[0] : undefined),
    prolog: { recursion: 'first([X|_], X).' },
    says: 'gives the first thing in the list'
  },
  {
    id: 'last', name: 'the last one', words: ['last', 'end', 'final'], in: 'list(any)', out: 'any',
    run: (l) => (Array.isArray(l) && l.length ? l[l.length - 1] : undefined),
    prolog: {
      builtin: 'last_one(L, X) :- last(L, X).',
      recursion: 'last_one([X], X).\nlast_one([_|Xs], X) :- Xs = [_|_], last_one(Xs, X).'
    },
    pred: 'last_one',
    says: 'gives the last thing in the list'
  },
  {
    id: 'rest', name: 'all but the first', words: ['rest', 'tail', 'drop', 'without', 'first', 'remove'], in: 'list(any)', out: 'list(any)',
    run: (l) => (Array.isArray(l) && l.length ? l.slice(1) : undefined),
    prolog: { recursion: 'rest([_|Xs], Xs).' },
    says: 'leaves out the first thing'
  },
  {
    id: 'reverse', name: 'turn it back to front', words: ['reverse', 'backwards', 'back', 'flip', 'opposite', 'order'], in: 'list(any)', out: 'list(any)',
    run: (l) => (Array.isArray(l) ? [...l].reverse() : undefined),
    prolog: {
      builtin: 'rev(L, R) :- reverse(L, R).',
      recursion: 'rev(L, R) :- rev(L, [], R).\nrev([], A, A).\nrev([X|Xs], A, R) :- rev(Xs, [X|A], R).',
      naive: 'rev([], []).\nrev([X|Xs], R) :- rev(Xs, R0), append(R0, [X], R).'
    },
    pred: 'rev',
    says: 'puts the list in the opposite order'
  },
  {
    id: 'sort', name: 'sort, keeping repeats', words: ['sort', 'order', 'sorted', 'arrange', 'ascending', 'increasing'], in: 'list(any)', out: 'list(any)',
    run: (l) => (nums(l) ? [...l].sort((a, b) => a - b) : undefined),
    prolog: { builtin: 'sorted(L, S) :- msort(L, S).' },
    pred: 'sorted',
    says: 'puts the numbers in order from smallest to biggest, keeping repeats'
  },
  {
    id: 'set', name: 'sort, without repeats', words: ['unique', 'distinct', 'different', 'duplicates', 'repeats', 'set', 'sort'], in: 'list(any)', out: 'list(any)',
    run: (l) => (nums(l) ? [...new Set(l)].sort((a, b) => a - b) : undefined),
    prolog: { builtin: 'set(L, S) :- sort(L, S).' },
    says: 'puts the numbers in order and takes out repeats'
  },
  {
    id: 'keep', name: 'keep the ones that…', words: ['keep', 'only', 'filter', 'select', 'which', 'that', 'those', 'even', 'odd', 'positive', 'negative'], in: 'list(number)', out: 'list(number)',
    params: [{ name: 'test', values: Object.keys(TESTS) }],
    run: (l, t) => (testable(l, t) ? l.filter(TESTS[t].js) : undefined),
    prolog: {
      builtin: (t) => `keep_${t}(L, R) :- include([X]>>(${TESTS[t].pl}), L, R).`,
      recursion: (t) => `keep_${t}([], []).\nkeep_${t}([X|Xs], R) :- ( ${TESTS[t].pl} -> R = [X|R0] ; R = R0 ), keep_${t}(Xs, R0).`
    },
    pred: (t) => `keep_${t}`,
    says: (t) => `keeps each number that ${TESTS[t].says}`
  },
  {
    id: 'drop', name: 'take out the ones that…', words: ['remove', 'drop', 'exclude', 'without', 'except', 'not', 'take', 'delete'], in: 'list(number)', out: 'list(number)',
    params: [{ name: 'test', values: Object.keys(TESTS) }],
    run: (l, t) => (testable(l, t) ? l.filter((x) => !TESTS[t].js(x)) : undefined),
    prolog: {
      builtin: (t) => `drop_${t}(L, R) :- exclude([X]>>(${TESTS[t].pl}), L, R).`,
      recursion: (t) => `drop_${t}([], []).\ndrop_${t}([X|Xs], R) :- ( ${TESTS[t].pl} -> R = R0 ; R = [X|R0] ), drop_${t}(Xs, R0).`
    },
    pred: (t) => `drop_${t}`,
    says: (t) => `takes out each number that ${TESTS[t].says}`
  },
  {
    id: 'addeach', name: 'add a number to each', words: ['add', 'increase', 'plus', 'each', 'every', 'more'], in: 'list(number)', out: 'list(number)',
    params: [{ name: 'n', values: SMALL }],
    run: (l, n) => (nums(l) ? l.map((x) => x + n) : undefined),
    prolog: {
      builtin: (n) => `add_each_${nm(n)}(L, R) :- maplist([X, Y]>>(Y is X + ${n}), L, R).`,
      recursion: (n) => `add_each_${nm(n)}([], []).\nadd_each_${nm(n)}([X|Xs], [Y|Ys]) :- Y is X + ${n}, add_each_${nm(n)}(Xs, Ys).`
    },
    pred: (n) => `add_each_${nm(n)}`,
    says: (n) => `adds ${n} to each number`
  },
  {
    id: 'timeseach', name: 'multiply each by a number', words: ['multiply', 'times', 'double', 'triple', 'each', 'every', 'scale'], in: 'list(number)', out: 'list(number)',
    params: [{ name: 'n', values: SMALL }],
    run: (l, n) => (nums(l) ? l.map((x) => x * n) : undefined),
    prolog: {
      builtin: (n) => `times_each_${nm(n)}(L, R) :- maplist([X, Y]>>(Y is X * ${n}), L, R).`,
      recursion: (n) => `times_each_${nm(n)}([], []).\ntimes_each_${nm(n)}([X|Xs], [Y|Ys]) :- Y is X * ${n}, times_each_${nm(n)}(Xs, Ys).`
    },
    pred: (n) => `times_each_${nm(n)}`,
    says: (n) => `multiplies each number by ${n}`
  },
  {
    id: 'squareeach', name: 'square each', words: ['square', 'squares', 'squared', 'each', 'every'], in: 'list(number)', out: 'list(number)',
    run: (l) => (nums(l) ? l.map((x) => x * x) : undefined),
    prolog: {
      builtin: 'square_each(L, R) :- maplist([X, Y]>>(Y is X * X), L, R).',
      recursion: 'square_each([], []).\nsquare_each([X|Xs], [Y|Ys]) :- Y is X * X, square_each(Xs, Ys).'
    },
    pred: 'square_each',
    says: 'multiplies each number by itself'
  },
  {
    id: 'running', name: 'running totals', words: ['running', 'cumulative', 'totals', 'so', 'far', 'sum', 'add'], in: 'list(number)', out: 'list(number)',
    run: (l) => { if (!nums(l)) return undefined; let s = 0; return l.map((x) => (s += x)); },
    prolog: {
      recursion: 'running(L, R) :- running(L, 0, R).\nrunning([], _, []).\nrunning([X|Xs], A0, [A|R]) :- A is A0 + X, running(Xs, A, R).'
    },
    says: 'gives the total so far at each place'
  },
  {
    id: 'join', name: 'join the lists together', words: ['join', 'flatten', 'concatenate', 'combine', 'together', 'merge', 'lists'], in: 'list(list(any))', out: 'list(any)',
    run: (l) => (Array.isArray(l) && l.every(Array.isArray) ? l.flat() : undefined),
    prolog: {
      builtin: 'join(Ls, L) :- append(Ls, L).',
      recursion: 'join([], []).\njoin([L|Ls], R) :- join(Ls, R0), append(L, R0, R).'
    },
    says: 'puts lists end to end to make one list'
  },
  {
    id: 'dedup', name: 'take out repeats, keeping order', words: ['unique', 'duplicates', 'repeats', 'once', 'distinct', 'remove'], in: 'list(any)', out: 'list(any)',
    run: (l) => (Array.isArray(l) && l.every((x) => !Array.isArray(x)) ? [...new Set(l)] : undefined),
    prolog: {
      builtin: 'dedup(L, S) :- list_to_set(L, S).',
      recursion: 'dedup(L, S) :- dedup(L, [], S).\ndedup([], _, []).\ndedup([X|Xs], Seen, R) :- ( memberchk(X, Seen) -> R = R0 ; R = [X|R0] ), dedup(Xs, [X|Seen], R0).'
    },
    says: 'takes out later repeats and keeps the order'
  },
  {
    id: 'plus', name: 'add a number', words: ['add', 'plus', 'more', 'increase', 'up'], in: 'number', out: 'number',
    params: [{ name: 'n', values: SMALL }],
    run: (x, n) => (isNum(x) ? x + n : undefined),
    prolog: { builtin: (n) => `plus_${nm(n)}(X, Y) :- Y is X + ${n}.` },
    pred: (n) => `plus_${nm(n)}`,
    says: (n) => `adds ${n}`
  },
  {
    id: 'times', name: 'multiply by a number', words: ['multiply', 'times', 'double', 'triple', 'scale'], in: 'number', out: 'number',
    params: [{ name: 'n', values: SMALL }],
    run: (x, n) => (isNum(x) ? x * n : undefined),
    prolog: { builtin: (n) => `times_${nm(n)}(X, Y) :- Y is X * ${n}.` },
    pred: (n) => `times_${nm(n)}`,
    says: (n) => `multiplies by ${n}`
  },
  {
    id: 'square', name: 'square it', words: ['square', 'squared'], in: 'number', out: 'number',
    run: (x) => (isNum(x) ? x * x : undefined),
    prolog: { builtin: 'square(X, Y) :- Y is X * X.' },
    says: 'multiplies the number by itself'
  },
  {
    id: 'letters', name: 'how many letters', words: ['letters', 'characters', 'length', 'long', 'word'], in: 'atom', out: 'int',
    run: (a) => (typeof a === 'string' ? [...a].length : undefined),
    prolog: { builtin: 'letters(A, N) :- atom_length(A, N).' },
    says: 'counts the letters in the word'
  },
  {
    id: 'backwards', name: 'spell it backwards', words: ['backwards', 'reverse', 'spell', 'word', 'letters'], in: 'atom', out: 'atom',
    run: (a) => (typeof a === 'string' ? [...a].reverse().join('') : undefined),
    prolog: { builtin: 'backwards(A, B) :- atom_chars(A, Cs), reverse(Cs, Rs), atom_chars(B, Rs).' },
    says: 'writes the word with its letters the other way round'
  }
];

const nm = (n) => (n < 0 ? `minus_${-n}` : String(n));

export const byId = (id) => FRAGMENTS.find((f) => f.id === id);

// a fragment with its choice made: { frag, param } -> name, predicate and text for it
export function predName(step) {
  const p = step.frag.pred ?? step.frag.id;
  return typeof p === 'function' ? p(step.param) : p;
}
export function stepSays(step) {
  return typeof step.frag.says === 'function' ? step.frag.says(step.param) : step.frag.says;
}
export function methodologies(frag) { return Object.keys(frag.prolog); }
export function stepProlog(step, methodology) {
  const ms = step.frag.prolog;
  const code = ms[methodology] ?? ms.builtin ?? ms.recursion ?? Object.values(ms)[0];
  return typeof code === 'function' ? code(step.param) : code;
}
