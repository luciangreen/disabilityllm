// The yellow disabled button: starting germs for new algorithms, from your own thoughts put into
// categories they might not seem to belong in. Each germ says which of your thoughts it came from
// (its source), the paradigm it uses, a sentence to start the spec-to-algorithm builder with, and a
// Prolog skeleton to begin from. The same thoughts and seed give the same germs.
//
//   germs(thoughts, { seed, count }) -> [{ id, category, paradigm, title, from, sentence, skeleton, reason }]
//   mindMap(germs) -> { centre, branches: [{ category, germs: [id] }] }

export const CATEGORIES = [
  { id: 'sound', name: 'Sound', paradigm: 'map each part to a note', make: (k) => ({ title: `${k} as music`, sentence: `turn each ${k} into a note number`, skeleton: `note(${k}_item, Note) :-\n    % choose a pitch for each ${k} (60 is middle C)\n    Note = 60.\nmelody(Items, Notes) :- maplist(note, Items, Notes).` }) },
  { id: 'image', name: 'Image', paradigm: 'draw it as a grid or tree', make: (k) => ({ title: `draw ${k}`, sentence: `count the ${k} in each row`, skeleton: `% a picture of ${k} as a grid of rows\nrow_count(Row, N) :- length(Row, N).\ncounts(Grid, Ns) :- maplist(row_count, Grid, Ns).` }) },
  { id: 'logic', name: 'Logic', paradigm: 'facts and rules', make: (k) => ({ title: `rules for ${k}`, sentence: `keep the ${k} that are positive`, skeleton: `% facts about ${k}, then a rule that follows from them\n${k}(a).\n${k}(b).\ngood(X) :- ${k}(X).` }) },
  { id: 'data', name: 'Data structures', paradigm: 'choose the structure first', make: (k) => ({ title: `${k} as a tree`, sentence: `add up the ${k}`, skeleton: `% a tree of ${k}: t(Left, Value, Right) or nil\ntotal(nil, 0).\ntotal(t(L, V, R), S) :- total(L, SL), total(R, SR), S is SL + V + SR.` }) },
  { id: 'grammar', name: 'Grammar', paradigm: 'strings to grammar', make: (k) => ({ title: `a grammar for ${k}`, sentence: `count the letters in each word`, skeleton: `% ${k} sentences: a DCG\nsentence --> word, rest.\nrest --> [].\nrest --> " ", word, rest.\nword --> [C], { code_type(C, alpha) }, word_rest.\nword_rest --> [].\nword_rest --> [C], { code_type(C, alpha) }, word_rest.` }) },
  { id: 'interpreter', name: 'Interpreter', paradigm: 'commands and an interpreter for them', make: (k) => ({ title: `a little language for ${k}`, sentence: `add up the numbers`, skeleton: `% commands about ${k}, run by an interpreter\nrun([], S, S).\nrun([add(N)|Cs], S0, S) :- S1 is S0 + N, run(Cs, S1, S).\nrun([times(N)|Cs], S0, S) :- S1 is S0 * N, run(Cs, S1, S).` }) },
  { id: 'state', name: 'State machine', paradigm: 'states and moves', make: (k) => ({ title: `${k} as a state machine`, sentence: `count the even numbers`, skeleton: `% the states of ${k} and the moves between them\nmove(start, go, middle).\nmove(middle, go, done).\nrun(S, [], S).\nrun(S0, [M|Ms], S) :- move(S0, M, S1), run(S1, Ms, S).` }) },
  { id: 'optimise', name: 'Optimisation', paradigm: 'melt it down (the same answers, less work)', make: (k) => ({ title: `${k}, faster`, sentence: `reverse the list`, skeleton: `% ${k}: first the clear version, then one with an accumulator\nslow([], []).\nslow([X|Xs], R) :- slow(Xs, R0), append(R0, [X], R).\nfast(L, R) :- fast(L, [], R).\nfast([], A, A).\nfast([X|Xs], A, R) :- fast(Xs, [X|A], R).` }) },
  { id: 'philosophy', name: 'Philosophy', paradigm: 'axioms and what follows', make: (k) => ({ title: `an axiom about ${k}`, sentence: `keep the numbers that are positive`, skeleton: `% an axiom about ${k} and a consequence of it\naxiom(${k}, good).\nfollows(X, Y) :- axiom(X, Y).\nfollows(X, Z) :- axiom(X, Y), follows(Y, Z).` }) }
];

// little words, and words that say how rather than what (a germ needs a thing to work on)
const STOP = new Set(['needs', 'need', 'real', 'through', 'slow', 'fast', 'make', 'made', 'using', 'use', 'like', 'more', 'less', 'very', 'also', 'then', 'than', 'some', 'any', 'each', 'every', 'one', 'two', 'which', 'there', 'their', 'these', 'those', 'about', 'would', 'could', 'should', 'will', 'just', 'only', 'get', 'got', 'has', 'have', 'had', 'was', 'were', 'been', 'being', 'does', 'did', 'done', 'out', 'over', 'under', 'all', 'own', 'new', 'old', 'good', 'bad', 'best', 'better', 'way', 'ways', 'thing', 'things', 'speculative', 'different', 'many', 'much',
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'are', 'it', 'that', 'this', 'with', 'for', 'on', 'be', 'as', 'by', 'can', 'my', 'i', 'we', 'you', 'they', 'from', 'at', 'how', 'what', 'not', 'so', 'into']);

// the main words of a thought, as Prolog-safe names
export function keywords(thought) {
  return String(thought).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w) && /^[a-z]/.test(w)).map((w) => w.replace(/[^a-z0-9]/g, ''));
}

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export function germs(thoughts, { seed = 1, count = 6 } = {}) {
  const sources = thoughts.map((t, i) => ({ i, text: typeof t === 'string' ? t : t.text, words: keywords(typeof t === 'string' ? t : t.text) })).filter((t) => t.words.length);
  if (!sources.length) return [];
  const r = rng(seed);
  const out = []; const used = new Set();
  for (let tries = 0; out.length < count && tries < count * 20; tries++) {
    const src = sources[Math.floor(r() * sources.length)];
    const word = src.words[Math.floor(r() * src.words.length)];
    const cat = CATEGORIES[Math.floor(r() * CATEGORIES.length)];
    const key = `${word}:${cat.id}`;
    if (used.has(key)) continue;
    used.add(key);
    const g = cat.make(word);
    out.push({ id: `g${out.length + 1}`, category: cat.id, categoryName: cat.name, paradigm: cat.paradigm, title: g.title, from: src.text, sentence: g.sentence, skeleton: g.skeleton, reason: `From your thought "${src.text}", with "${word}" put under ${cat.name.toLowerCase()} (${cat.paradigm}).` });
  }
  return out;
}

export function mindMap(gs, centre = 'your thoughts') {
  const branches = [];
  for (const g of gs) {
    let b = branches.find((x) => x.category === g.category);
    if (!b) branches.push((b = { category: g.category, name: g.categoryName, germs: [] }));
    b.germs.push(g.id);
  }
  return { centre, branches };
}

// a thought as notes (for the sound category): each letter a pitch in the C major scale
export function thoughtNotes(text) {
  const scale = [60, 62, 64, 65, 67, 69, 71, 72];
  return [...String(text).toLowerCase()].filter((c) => /[a-z]/.test(c)).slice(0, 24).map((c) => scale[(c.charCodeAt(0) - 97) % scale.length]);
}

// a thought as colours (for the image category): each word a hue
export function thoughtColours(text) {
  return keywords(text).slice(0, 8).map((w) => { let h = 0; for (const c of w) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 70% 55%)`; });
}
