// The Classroom pane (learning). It asks you, in Prolog, what your algorithm is:
//   From a sentence: the sentence's words with small changes that are leads (each a predicate),
//     your examples as queries, the chains of fragments that fit (you choose), how it is written,
//     the proof, and the melt-down (the same answers with less work).
//   Teach yourself: courses where you test each next step in Prolog.
//   Go up a level: two predicates become one higher-order predicate; strings become a grammar.
//   Ideas: the yellow button's germs from your thoughts, as a mind map.
// A wrong answer says why, and you go on once you have it right.
import { digest } from './lib/parse.js';
import { synthesise, program, nested, proofGoal, query, check, probe, safeName, runSteps } from './lib/synth.js';
import { methodologies, predName, stepSays, byId } from './lib/fragments.js';
import { typeOfAll, show, read, same } from './lib/types.js';
import { meltdowns, checkMeltdown, moreInputs } from './lib/meltdown.js';
import { abstract, PARADIGMS } from './lib/abstract.js';
import { induce, accepts } from './lib/grammar.js';
import { germs, mindMap, thoughtNotes, thoughtColours } from './lib/germs.js';
import { COURSES, courseById, mark } from './lib/lessons.js';
import * as P from './lib/progress.js';
import { band, explainChain } from './lib/explain.js';
import { remember, skip, predict } from './lib/predict.js';

const SECTIONS = ['Your sentence', 'Leads', 'Examples', 'The algorithm', 'How it is written', 'Proof', 'Melt down'];
const METHOD_SAYS = { builtin: 'with SWI-Prolog\'s own predicates', recursion: 'as recursion (a base case and a recursive case)', foldl: 'with foldl (going through the list once, carrying a total)', naive: 'the simplest recursion (append at the end)' };

export function mountClassroom(ctx) {
  const { el, store } = ctx;
  const root = document.getElementById('lesson');
  let mode = 'build';
  let ask = null; // the question on screen: { options: [{ label, run }], open?: fn }

  // ---------- shared pieces ----------
  const card = (title, ...kids) => el('div', { class: 'dl-card' }, title ? el('h3', {}, title) : null, ...kids);
  const pre = (t) => el('pre', {}, t);
  const why = (text, good) => el('div', { class: `dl-why ${good ? 'good' : 'bad'}` }, text);
  function question(q, options, { open = null, say = true } = {}) {
    ask = { options, open };
    if (say) ctx.say(q.replace(/\?-.*\n?/g, '').trim() || q);
    const box = el('div', { class: 'dl-opts' });
    options.forEach((o, k) => box.append(el('button', { onclick: () => o.run(box.children[k]) }, `${k + 1}. ${o.label}`)));
    return el('div', {}, el('div', { class: 'dl-q' }, pre(q)), box);
  }
  function choose(kind, context, choice) { store.addChoice({ kind, context: String(context), choice: String(choice) }); }
  const predicted = (kind, context) => skip(store.choices(), kind, context, ctx.predicting());

  // spoken (or typed to the character) answers to the question on screen
  ctx.onSpoken(async (t) => {
    if (/^(next|go on|carry on|continue)$/.test(t)) { nextFn?.(); return 'Going on.'; }
    if (/^summary$/.test(t)) { summaryFn?.(); return 'Here is the summary.'; }
    if (/^fast forward$/.test(t)) { ffFn?.(); return 'Fast forward.'; }
    if (/^(start again|restart)$/.test(t)) { restartFn?.(); return 'Starting again.'; }
    if (/^where was i/.test(t)) return whereWasI();
    if (!ask) return null;
    const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, first: 1, second: 2, third: 3, yes: 1, no: 2, a: 1, b: 2, c: 3, d: 4 };
    const m = /^(?:number |option |answer )?(\d+|one|two|three|four|five|six|first|second|third|yes|no|a|b|c|d)$/.exec(t);
    if (m) { const k = (Number(m[1]) || words[m[1]]) - 1; const o = ask.options[k]; if (o) { o.run(); return `You chose ${k + 1}.`; } }
    if (ask.open) { ask.open(t); return 'Thanks.'; }
    return null;
  });
  let nextFn = null, summaryFn = null, ffFn = null, restartFn = null;

  // ---------- From a sentence ----------
  let b = store.get('build', null) ?? freshBuild();
  function freshBuild() { return { section: 0, sentence: '', approved: {}, examples: [], chosen: null, methodology: null, skipped: [], proved: null, probes: [] }; }
  const saveB = () => store.set('build', b);
  const name = () => safeName(b.name || digest(b.sentence).name, b.chosen ? b.chosen.map(stepOf) : []);
  const stepOf = (s) => ({ frag: byId(s.frag), param: s.param });
  const steps = () => (b.chosen ?? []).map(stepOf);
  const leads = () => digest(b.sentence).leads;

  function buildProgress() {
    const within = [1, Object.keys(b.approved).length / Math.max(1, leads().length), Math.min(1, b.examples.length / 3), b.chosen ? 1 : 0, b.methodology ? 1 : 0, b.proved ? 1 : 0, b.melted ? 1 : 0][b.section] ?? 0;
    ctx.setProgress(
      { fraction: within, text: SECTIONS[b.section] ?? 'done' },
      { fraction: b.section / SECTIONS.length, text: `${Math.min(b.section + 1, SECTIONS.length)} of ${SECTIONS.length}` },
      {
        summary: (summaryFn = () => showSummary()),
        ff: (ffFn = () => fastForwardBuild()),
        restart: (restartFn = () => { b = freshBuild(); saveB(); render(); })
      }
    );
  }
  function showSummary() {
    const lines = [`Sentence: ${b.sentence || '(not yet)'}`];
    const yes = leads().filter((l) => b.approved[key(l)]);
    if (yes.length) lines.push(`Leads you approved: ${yes.map((l) => l.pred).join(', ')}`);
    if (b.examples.length) lines.push(`Examples: ${b.examples.map((e) => `${show(e.in)} → ${show(e.out)}`).join('; ')}`);
    if (b.chosen) lines.push(`Algorithm: ${nested(steps())}`);
    if (b.methodology) lines.push(`Written ${METHOD_SAYS[b.methodology] ?? b.methodology}`);
    if (b.proved) lines.push(b.proved);
    if (b.skipped.length) lines.push(`Skipped (predicted from your past choices): ${b.skipped.join('; ')}`);
    root.prepend(card('Summary', pre(lines.join('\n'))));
    ctx.say(lines.slice(0, 3).join('. '));
  }
  // fast forward: the rest of this section answered the usual way, shown so you can check it
  function fastForwardBuild() {
    if (b.section === 1) { for (const l of leads()) if (!(key(l) in b.approved)) b.approved[key(l)] = true; b.section = 2; }
    else if (b.section === 2 && b.examples.length >= 1) b.section = 3;
    else if (b.section === 3) { const sols = synthesise(b.examples, { leads: approvedLeads(), numbers: digest(b.sentence).numbers }); if (sols[0]) { b.chosen = sols[0].steps.map((s) => ({ frag: s.frag.id, param: s.param })); b.section = 4; } }
    else if (b.section === 4) { b.methodology = 'recursion'; b.section = 5; }
    else if (b.section === 5) b.section = 6;
    saveB(); render();
  }
  const key = (l) => `${l.frag}:${l.param}`;
  const approvedLeads = () => leads().filter((l) => b.approved[key(l)]);

  function renderBuild() {
    buildProgress();
    nextFn = null;
    if (b.section === 0) return sentenceCard();
    if (b.section === 1) return leadsCard();
    if (b.section === 2) return examplesCard();
    if (b.section === 3) return algorithmCard();
    if (b.section === 4) return methodCard();
    if (b.section === 5) return proofCard();
    return meltCard();
  }

  function sentenceCard() {
    const input = el('input', { type: 'text', value: b.sentence, placeholder: 'count the even numbers', 'aria-label': 'Your sentence' });
    const go = () => {
      if (!input.value.trim()) return;
      b = { ...freshBuild(), sentence: input.value.trim(), section: 1 };
      store.addThought(b.sentence);
      saveB(); ctx.companion.resolved(); render();
    };
    ask = { options: [], open: (t) => { input.value = t; go(); } };
    ctx.say('What should your algorithm do? Say it in a sentence.');
    root.append(card('What should your algorithm do?',
      el('p', {}, 'Say it in a sentence, as you would to a friend. I\'ll turn its words into Prolog predicates you can approve.'),
      el('form', { class: 'dl-row', onsubmit: (e) => { e.preventDefault(); go(); } }, input, el('button', { class: 'primary' }, 'Next')),
      el('p', { class: 'quiet' }, 'For example: count the even numbers · add up the squares · reverse the list · biggest even number · how many different numbers')));
  }

  function leadsCard() {
    const d = digest(b.sentence);
    const box = el('div', {});
    const all = d.leads;
    if (!all.length) {
      root.append(card('No leads in that sentence', el('p', {}, 'None of its words name something I have a fragment for. Say it another way: use words like count, add up, biggest, keep, reverse, sort, each.'), el('button', { onclick: () => { b.section = 0; saveB(); render(); } }, 'Say it again')));
      return;
    }
    let skippedAny = false;
    for (const l of all) {
      const k = key(l);
      if (!(k in b.approved)) {
        const p = predicted('lead', k);
        if (p !== null) { b.approved[k] = p === 'yes'; b.skipped.push(`${l.pred}: ${p}`); skippedAny = true; }
      }
    }
    if (skippedAny) saveB();
    const pending = all.filter((l) => !(key(l) in b.approved));
    for (const l of all) {
      const k = key(l), state = b.approved[k];
      const set = (v) => { b.approved[k] = v; choose('lead', k, v ? 'yes' : 'no'); saveB(); render(); };
      box.append(el('div', { class: `dl-lead ${state === true ? 'yes' : state === false ? 'no' : ''}` },
        el('code', {}, `?- ${l.pred.replace('/2', '')}(In, Out).`), el('span', {}, `"${l.word}" → ${l.says}`),
        el('span', { class: 'dl-spacer' }),
        el('button', { onclick: () => set(true), 'aria-pressed': String(state === true) }, 'Yes, that'),
        el('button', { onclick: () => set(false), 'aria-pressed': String(state === false) }, 'No')));
    }
    const first = pending[0];
    if (first) {
      ask = { options: [{ label: 'yes', run: () => { b.approved[key(first)] = true; choose('lead', key(first), 'yes'); saveB(); render(); } }, { label: 'no', run: () => { b.approved[key(first)] = false; choose('lead', key(first), 'no'); saveB(); render(); } }] };
      ctx.say(`Does "${first.word}" mean the predicate ${first.pred.replace('/2', '').replace(/_/g, ' ')}, which ${first.says}?`);
    }
    const anyYes = all.some((l) => b.approved[key(l)]);
    root.append(card(`"${b.sentence}": which predicates does it mean?`,
      el('p', {}, 'Each of your words with a small change into a Prolog predicate. Approve the ones you mean.'),
      box,
      el('div', { class: 'dl-row' },
        el('button', { class: 'primary', disabled: !anyYes, onclick: () => { b.section = 2; saveB(); ctx.companion.resolved(); render(); } }, 'Next: examples'),
        el('button', { onclick: () => { b.section = 0; saveB(); render(); } }, 'Change the sentence')),
      b.skipped.length ? el('p', { class: 'dl-skipped quiet' }, `Predicted from your past choices: ${b.skipped.join('; ')}. `, el('button', { onclick: () => { b.approved = {}; b.skipped = []; saveB(); render(); } }, 'Ask me again')) : null));
    nextFn = anyYes ? () => { b.section = 2; saveB(); render(); } : null;
  }

  // inputs to suggest for the type the sentence talks about (the next one you haven't given)
  function suggestInput() {
    const t = digest(b.sentence).dataType ?? (b.examples[0] ? typeOfAll(b.examples.map((e) => e.in)) : 'list(int)');
    const sets = {
      'list(int)': ['[1,2,3,4]', '[5,8,2]', '[]', '[-3,4,-1]', '[7]'],
      'list(atom)': ['[cat,dog,cat]', '[a,b]', '[]'],
      'list(list(int))': ['[[1,2],[3]]', '[[],[4]]', '[]'],
      atom: ['hello', 'prolog', 'a'],
      int: ['3', '10', '0', '-2']
    };
    const xs = sets[t] ?? sets['list(int)'];
    return xs.find((x) => !b.examples.some((e) => same(e.in, read(x)))) ?? xs[0];
  }

  function examplesCard() {
    const nm = name();
    const inEl = el('input', { type: 'text', value: suggestInput(), 'aria-label': 'Input' });
    const outEl = el('input', { type: 'text', placeholder: 'Out', 'aria-label': 'Output' });
    const msg = el('div', {});
    const add = () => {
      const i = read(inEl.value), o = read(outEl.value);
      if (i === null) return msg.replaceChildren(why('I can\'t read that input as Prolog: try [1,2,3] or hello.'));
      if (o === null) return msg.replaceChildren(why('What is Out? Type it as Prolog: 2, [1,2], hello.'));
      b.examples = [...b.examples.filter((e) => !same(e.in, i)), { in: i, out: o }];
      saveB(); ctx.companion.resolved(); render();
    };
    ask = { options: [], open: (t) => { outEl.value = t; add(); } };
    const edge = !b.examples.some((e) => Array.isArray(e.in) && e.in.length === 0) && /^list/.test(digest(b.sentence).dataType ?? 'list');
    ctx.say(`Give me an example. What is Out for ${inEl.value}?`);
    const types = b.examples.length ? `${nm}(+${typeOfAll(b.examples.map((e) => e.in))}, -${typeOfAll(b.examples.map((e) => e.out))})` : null;
    root.append(card('Examples: what should it give?',
      el('p', {}, 'Invent the data: an input and the answer you want. Two or three is enough, with a small or empty one among them.'),
      el('form', { class: 'dl-row', onsubmit: (e) => { e.preventDefault(); add(); } }, el('code', {}, `?- ${nm}(`), inEl, el('code', {}, ', Out).  Out ='), outEl, el('button', {}, 'Add')),
      msg,
      b.examples.length ? pre(b.examples.map((e) => `?- ${nm}(${show(e.in)}, Out).\nOut = ${show(e.out)}.`).join('\n')) : null,
      types ? el('p', {}, 'Its types, from your data: ', el('code', {}, types)) : null,
      edge && b.examples.length ? el('p', { class: 'quiet' }, 'What about the empty list? It is often the case people forget. ', el('button', { onclick: () => { inEl.value = '[]'; outEl.focus(); } }, 'Try []')) : null,
      el('div', { class: 'dl-row' },
        el('button', { class: 'primary', disabled: b.examples.length < 2, onclick: () => { b.section = 3; saveB(); render(); } }, 'Next: find the algorithm'),
        b.examples.length ? el('button', { onclick: () => { b.examples = b.examples.slice(0, -1); saveB(); render(); } }, 'Take out the last') : null)));
    nextFn = b.examples.length >= 2 ? () => { b.section = 3; saveB(); render(); } : null;
  }

  function algorithmCard() {
    const nm = name();
    const sols = synthesise(b.examples, { leads: approvedLeads(), numbers: digest(b.sentence).numbers });
    if (!sols.length) {
      root.append(card('No chain of fragments gives all your examples',
        el('p', {}, 'Either an example says something the fragments can\'t do yet, or the leads don\'t fit. Check the examples (is each Out right?), or approve other leads.'),
        el('div', { class: 'dl-row' }, el('button', { onclick: () => { b.section = 2; saveB(); render(); } }, 'Back to the examples'), el('button', { onclick: () => { b.section = 1; saveB(); render(); } }, 'Back to the leads'))));
      ctx.companion.problem('No chain fits the examples: one of them may be wrong.');
      return;
    }
    ctx.companion.problem(null);
    // more than one way, and they differ somewhere: ask about that case first
    const pr = probe(sols, b.examples);
    if (pr) {
      const opts = pr.answers.map((a) => ({ label: `Out = ${a.out === undefined ? '(it should fail: false)' : show(a.out)}.`, run: () => { if (a.out !== undefined) { b.examples = [...b.examples, { in: pr.input, out: a.out }]; saveB(); ctx.companion.resolved(); render(); } } }));
      const other = el('input', { type: 'text', placeholder: 'something else', 'aria-label': 'Another answer' });
      root.append(card('One more case decides it',
        el('p', {}, `I found ${sols.length} ways that fit your examples, and they give different answers here. Which do you mean?`),
        question(`?- ${nm}(${show(pr.input)}, Out).`, opts, { open: (t) => { const o = read(t); if (o !== null) { b.examples = [...b.examples, { in: pr.input, out: o }]; saveB(); render(); } } }),
        el('form', { class: 'dl-row', onsubmit: (e) => { e.preventDefault(); const o = read(other.value); if (o !== null) { b.examples = [...b.examples, { in: pr.input, out: o }]; saveB(); render(); } } }, el('code', {}, 'Out ='), other, el('button', {}, 'That'))));
      return;
    }
    // the way found, beside chains made from your leads that don't fit (choose the right one)
    const top = sols[0];
    const wrongs = [];
    for (const l of approvedLeads()) {
      const s = [{ frag: byId(l.frag), param: l.param }];
      if (check(s, b.examples).every((r) => r.ok) || wrongs.some((w) => nested(w) === nested(s))) continue;
      wrongs.push(s);
      if (wrongs.length === 2) break;
    }
    const e0 = b.examples[0];
    const options = [top.steps, ...wrongs].map((st) => ({ st, label: `${nm}(In, Out) :- ${chainCalls(st)}.` }));
    options.sort((x, y) => x.label.localeCompare(y.label));
    const msg = el('div', {});
    const box = question(`Which clause gives\n?- ${nm}(${show(e0.in)}, Out).\nOut = ${show(e0.out)}.`, options.map((o) => ({
      label: o.label,
      run: (btn) => {
        const rs = check(o.st, b.examples);
        if (rs.every((r) => r.ok)) {
          btn?.classList.add('right');
          b.chosen = o.st.map((s) => ({ frag: s.frag.id, param: s.param }));
          choose('chain', b.sentence, nested(o.st));
          msg.replaceChildren(why(`Yes: ${explainChain(o.st, ctx.year())}`, true));
          saveB(); ctx.companion.resolved();
          setTimeout(() => { b.section = 4; saveB(); render(); }, 900);
        } else {
          btn?.classList.add('wrong');
          const bad = rs.find((r) => !r.ok);
          msg.replaceChildren(why(`Not that one: ?- ${nm}(${show(bad.in)}, Out) gives ${bad.got === undefined ? 'false' : `Out = ${show(bad.got)}`}, not ${show(bad.want)}. Try again.`));
        }
      }
    })));
    root.append(card('The algorithm', el('p', {}, 'These are made from the predicates you approved. One gives all your examples.'), box, msg,
      sols.length > 1 ? el('p', { class: 'quiet' }, `Other ways that also fit: ${sols.slice(1, 4).map((s) => nested(s.steps)).join(' · ')}`) : null));
  }
  const chainCalls = (st) => st.map((s, k) => `${predName(s)}(${k ? String.fromCharCode(64 + k) : 'In'}, ${k === st.length - 1 ? 'Out' : String.fromCharCode(65 + k)})`).join(', ');

  function methodCard() {
    const st = steps();
    const ms = [...new Set(st.flatMap((s) => methodologies(s.frag)))];
    const p = predicted('methodology', '');
    if (p && ms.includes(p) && !b.methodology) { b.methodology = p; b.skipped.push(`written ${METHOD_SAYS[p] ?? p}`); b.section = 5; saveB(); return render(); }
    const pick = (m) => { b.methodology = m; choose('methodology', '', m); b.section = 5; saveB(); ctx.companion.resolved(); render(); };
    root.append(card('How should the Prolog be written?',
      el('p', {}, 'The same algorithm can be written different ways: choose the methodology you want to learn or use.'),
      question('Which way?', ms.map((m) => ({ label: `${m}: ${METHOD_SAYS[m] ?? m}`, run: () => pick(m) })))));
  }

  function proofCard() {
    const st = steps(), nm = name();
    const code = program({ steps: st }, { name: nm, methodology: b.methodology, sentence: b.sentence });
    const rs = check(st, b.examples);
    const table = el('table', { class: 'dl-checks' }, el('tr', {}, el('th', {}, 'Query'), el('th', {}, 'Want'), el('th', {}, 'Gets'), el('th', {}, '')),
      ...rs.map((r) => el('tr', {}, el('td', {}, el('code', {}, `?- ${nm}(${show(r.in)}, Out).`)), el('td', {}, show(r.want)), el('td', {}, r.got === undefined ? 'false' : show(r.got)), el('td', { class: r.ok ? 'ok' : 'bad' }, r.ok ? '✓' : '✗'))));
    const out = el('div', {});
    const goal = `( ${proofGoal(nm, b.examples)} -> writeln(proved) ; writeln(not_proved) )`;
    const runIt = async () => {
      out.replaceChildren(el('p', { class: 'quiet' }, 'Running it in Prolog…'));
      try {
        const r = await ctx.runProlog(code, goal);
        const ok = /proved/.test(r.out) && !/not_proved/.test(r.out);
        b.proved = ok ? `Proved in Prolog: all ${b.examples.length} examples give their answers (${goal.length > 80 ? 'forall over your examples' : goal}).` : null;
        saveB(); buildProgress();
        out.replaceChildren(ok ? why(b.proved, true) : why(`Prolog said: ${(r.out + r.err).trim() || 'nothing'}`));
        if (ok) ctx.companion.resolved(); else ctx.companion.problem('The proof in Prolog didn\'t go through.');
      } catch (e) { out.replaceChildren(why(`Couldn't run Prolog here: ${e.message}. The checks above are the same queries, run in this page.`)); }
    };
    const built = store.get('built', []);
    if (!built.some((x) => x.name === nm && x.code === code)) store.set('built', [...built, { name: nm, sentence: b.sentence, code, chain: b.chosen, methodology: b.methodology }].slice(-50));
    root.append(card(`${nm}: your algorithm`,
      pre(code),
      el('p', {}, explainChain(st, ctx.year())),
      el('p', {}, 'As nested calls: ', el('code', {}, nested(st).replace(/In/, 'In'))),
      table,
      el('div', { class: 'dl-row' },
        el('button', { class: 'primary', onclick: runIt }, 'Prove it in Prolog'),
        el('button', { onclick: () => ctx.toWork(code, b.examples.map((e) => `?- ${nm}(${show(e.in)}, Out). Out = ${show(e.out)}.`).join('\n'), `algorithms/${nm}.pl`) }, 'Open in Applaud'),
        el('button', { onclick: () => { b.section = 6; saveB(); render(); } }, 'Next: melt it down')),
      out,
      el('p', { class: 'quiet' }, `Sources: each fragment's clauses are in lib/fragments.js, with the same predicate in JavaScript that made the checks; the search is lib/synth.js.`)));
    nextFn = () => { b.section = 6; saveB(); render(); };
    if (!b.proved) runIt();
  }

  function meltCard() {
    const st = steps();
    const ms = meltdowns(b.methodology === 'naive' ? st : st.filter(Boolean)).filter((m) => m.rule !== 'naive-reverse' || b.methodology === 'naive');
    b.melted = true; saveB(); buildProgress();
    const inputs = moreInputs(b.examples);
    const list = ms.map((m) => {
      const c = checkMeltdown(m, inputs);
      return card(`A discovery: ${m.rule.replace(/-/g, ' ')}`,
        el('p', {}, m.law),
        el('p', {}, `It saves ${m.saves}.`),
        m.after ? pre(`Before: ${nested(m.before)}\nAfter:  ${m.after.length ? nested(m.after) : 'In (nothing to do)'}`) : null,
        m.prolog ? pre(m.prolog) : null,
        why(c.ok ? `Checked: the same answers on all ${c.inputs} inputs (yours and ${c.inputs - b.examples.length} more).` : `It differs on ${show(c.counter.input)}: ${show(c.counter.before)} against ${show(c.counter.after)}.`, c.ok),
        m.after && c.ok ? el('button', { onclick: () => { b.chosen = m.after.map((s) => ({ frag: s.frag.id, param: s.param })); b.proved = null; b.section = 5; saveB(); render(); } }, 'Use this') : null);
    });
    root.append(card('Melt it down', el('p', {}, ms.length ? 'The same answers with less work: each discovery says its law, and is checked on your data and more.' : 'Nothing to melt down: each step already does work the next one needs. Try one with sort then first, or square each then add up.'),
      ...list,
      el('div', { class: 'dl-row' }, el('button', { class: 'primary', onclick: () => { b = freshBuild(); saveB(); render(); } }, 'Build another'), el('button', { onclick: () => ctx.toLearn('up') }, 'Go up a level'))));
  }

  // ---------- Teach yourself ----------
  let place = store.get('place', null);
  function coursesView() {
    nextFn = null;
    if (!place) {
      const all = store.get('coursesDone', []);
      ctx.setProgress({ fraction: 0, text: 'choose a course' }, P.progress(COURSES, { done: all }), {});
      root.append(card('Teach yourself', el('p', {}, 'Each course asks in Prolog, and you test each next step. Where an idea comes from is said with it.'),
        ...COURSES.map((c) => { const n = c.steps.filter((s) => all.includes(s.id)).length; return el('button', { class: 'dl-coursebtn', onclick: () => { place = P.start(c); place.done = c.steps.filter((s) => all.includes(s.id)).map((s) => s.id); store.set('place', place); render(); } }, `${c.name} (${n} of ${c.steps.length})`); })));
      ctx.say('Which course would you like?');
      return;
    }
    const course = courseById(place.course);
    const bandNow = band(ctx.year());
    const overall = () => P.progress(COURSES, { done: store.get('coursesDone', []) });
    const pr = () => ({ fraction: place.step / course.steps.length, text: `${course.name}: ${Math.min(place.step + 1, course.steps.length)} of ${course.steps.length}` });
    const handlers = {
      summary: (summaryFn = () => root.prepend(card('Summary', pre(P.summary(course, place, bandNow))))),
      ff: (ffFn = () => { place = P.fastForward(course, place); store.set('place', place); markDone(course.steps.map((s) => s.id)); render(); }),
      restart: (restartFn = () => { place = P.start(course); store.set('place', place); render(); })
    };
    ctx.setProgress(pr(), { ...overall(), text: `${overall().done} of ${overall().total} steps` }, handlers);
    if (P.finished(course, place)) {
      root.append(card(`${course.name}: done`, pre(P.summary(course, place, bandNow)),
        place.skipped?.length ? el('p', {}, 'Fast-forwarded (the answers):', ...course.steps.filter((s) => place.skipped.includes(s.id)).map((s) => pre(`${s.title}\n${s.ask.kind === 'choice' ? s.ask.options.find((o) => o.right).text : s.ask.hint}`))) : null,
        el('button', { onclick: () => { place = null; store.set('place', null); render(); } }, 'Other courses')));
      return;
    }
    const step = course.steps[place.step];
    const msg = el('div', {});
    const out = el('div', {});
    const done = (right, text) => {
      msg.replaceChildren(why(text, right));
      if (right) { place = P.answer(course, place, true); store.set('place', place); markDone([step.id]); ctx.companion.resolved(); setTimeout(render, 1100); }
      else { place = P.answer(course, place, false); store.set('place', place); }
    };
    const body = [el('p', {}, bandNow === 'young' && step.young ? step.young : step.say)];
    if (step.ask.kind === 'choice') {
      body.push(question(step.ask.q, step.ask.options.map((o, k) => ({ label: o.text, run: (btn) => { const m = mark(step, k); btn?.classList.add(m.right ? 'right' : 'wrong'); done(m.right, m.right ? `Yes. ${m.why}` : `Not quite: ${m.why} Try again.`); } }))));
    } else {
      const inp = el('input', { type: 'text', 'aria-label': 'Your answer' });
      const submit = () => { const m = mark(step, inp.value); done(m.right, m.right ? 'Yes.' : `Not yet. ${m.why}`); };
      ask = { options: [], open: (t) => { inp.value = t; submit(); } };
      ctx.say(step.ask.q.split('\n').pop());
      body.push(el('div', { class: 'dl-q' }, pre(step.ask.q)), el('form', { class: 'dl-row', onsubmit: (e) => { e.preventDefault(); submit(); } }, inp, el('button', {}, 'Check')));
    }
    if (step.code) body.push(pre(step.code), el('button', { onclick: async () => {
      out.replaceChildren(el('p', { class: 'quiet' }, 'Running…'));
      try { const r = await ctx.runProlog(step.code, step.goal ?? 'true'); out.replaceChildren(pre(`?- ${step.goal ?? 'true'}.\n${(r.out + r.err).trim() || (r.ok ? 'true.' : 'false.')}`)); } catch (e) { out.replaceChildren(why(`Couldn't run Prolog here: ${e.message}`)); }
    } }, 'Test this step in Prolog'), out);
    body.push(msg, el('p', { class: 'quiet' }, `Source: ${step.source}`));
    root.append(card(`${course.name} · ${step.title}`, ...body, el('button', { onclick: () => { place = null; store.set('place', null); render(); } }, 'Other courses')));
  }
  function markDone(ids) { store.set('coursesDone', [...new Set([...store.get('coursesDone', []), ...ids])]); }

  // ---------- Go up a level ----------
  function upView() {
    nextFn = null;
    ctx.setProgress({ fraction: 0, text: 'go up a level' }, { fraction: Math.min(1, store.get('ups', 0) / 5), text: `${store.get('ups', 0)} abstractions` }, {});
    const built = store.get('built', []);
    const a = el('textarea', { rows: 4, 'aria-label': 'First predicate', value: byId('sum').prolog.recursion });
    const c = el('textarea', { rows: 4, 'aria-label': 'Second predicate', value: byId('product').prolog.recursion });
    const nmIn = el('input', { type: 'text', value: 'fold', 'aria-label': 'Name for the general predicate' });
    const res = el('div', {});
    const go = async () => {
      const r = abstract(a.value, c.value, safeName(nmIn.value || 'general'));
      if (!r.ok) return res.replaceChildren(why(r.why));
      store.set('ups', store.get('ups', 0) + 1);
      const out = el('div', {});
      res.replaceChildren(
        why(`They differ by ${r.params.map((p) => `${p.a} and ${p.b}`).join(', ')}: those become the arguments ${r.params.map((p) => p.name).join(', ')}.`, true),
        pre(r.general), el('p', {}, 'And each is a call to it:'), pre(r.instances.join('\n')), out);
      ctx.companion.resolved();
      // the proof: the originals and the calls to the general one agree on test lists
      const ren = (t, from, to) => t.replace(new RegExp(`\\b${from}\\(`, 'g'), `${to}(`);
      const code = [ren(a.value, r.from[0], `orig_${r.from[0]}`), ren(c.value, r.from[1], `orig_${r.from[1]}`), r.general, ...r.instances].join('\n');
      const goal = `( forall(member(L, [[], [3], [1,2,3], [2,5,1,4]]), ( orig_${r.from[0]}(L, X1), ${r.from[0]}(L, Y1), X1 =:= Y1, orig_${r.from[1]}(L, X2), ${r.from[1]}(L, Y2), X2 =:= Y2 )) -> writeln(proved) ; writeln(not_proved) )`;
      try { const p = await ctx.runProlog(code, goal); out.replaceChildren(why(/proved/.test(p.out) && !/not_proved/.test(p.out) ? 'Proved in Prolog: the calls give the same answers as the originals on [], [3], [1,2,3] and [2,5,1,4].' : `Prolog said: ${(p.out + p.err).trim()}`, /proved/.test(p.out) && !/not_proved/.test(p.out))); } catch (e) { out.replaceChildren(why(`Couldn't run Prolog here: ${e.message}`)); }
    };
    const pickers = built.length ? el('p', { class: 'quiet' }, 'Or start from what you built: ', ...built.slice(-6).map((x) => el('button', { onclick: () => { (a.value === byId('sum').prolog.recursion ? a : c).value = x.code.split('\n\n').slice(1).join('\n\n').trim() || x.code; } }, x.name))) : null;

    const strs = el('input', { type: 'text', value: 'ab, abab, ababab', 'aria-label': 'Example strings, with commas between' });
    const test = el('input', { type: 'text', value: 'abababab', 'aria-label': 'A string to test' });
    const gOut = el('div', {});
    const induceIt = async () => {
      const g = induce(strs.value.split(',').map((s) => s.trim()).filter(Boolean));
      if (!g.ok) return gOut.replaceChildren(why(g.why));
      const m = g.machine;
      const out = el('div', {});
      gOut.replaceChildren(why(`They are ${g.says}.`, true), pre(g.dcg),
        el('p', {}, 'As a state machine (from a state, read the text, go to a state):'),
        pre(m.moves.map(([f, t, to]) => `${f} --"${t}"--> ${to}`).join('\n') + `\nending in: ${m.finals.join(', ')}`),
        el('p', {}, `"${test.value}": ${accepts(g, test.value) ? 'the grammar makes it' : 'the grammar doesn\'t make it'}.`), out);
      try { const p = await ctx.runProlog(g.dcg, `( string_codes(${JSON.stringify(test.value)}, Cs), phrase(s, Cs) -> writeln(yes) ; writeln(no) )`); out.replaceChildren(pre(`?- phrase(s, \`${test.value}\`).\n${/yes/.test(p.out) ? 'true.' : 'false.'}`)); } catch { /* the page's own check is above */ }
      ctx.companion.resolved();
    };
    root.append(
      card('Higher-order: two predicates become one', el('p', {}, 'Put in two predicates that work the same way. Where they differ, the general predicate is given what it needs.'), a, c, el('div', { class: 'dl-row' }, el('label', {}, 'Name ', nmIn), el('button', { class: 'primary', onclick: go }, 'Go up')), pickers, res),
      card('Strings to grammar', el('p', {}, 'Example strings become a grammar that makes them, which is also a state machine.'), strs, el('div', { class: 'dl-row' }, el('label', {}, 'Test ', test), el('button', { class: 'primary', onclick: induceIt }, 'Find the grammar')), gOut),
      card('The levels above', ...PARADIGMS.map((p) => el('p', {}, el('strong', {}, p.name), `: from ${p.from}, it adds ${p.adds}.`))));
  }

  // ---------- Ideas (the yellow disabled button) ----------
  let seed = store.get('seed', 1);
  function ideasView(fresh) {
    nextFn = null;
    if (fresh) { seed = (seed * 7 + 11) % 100003; store.set('seed', seed); }
    const thoughts = store.thoughts();
    ctx.setProgress({ fraction: 0, text: 'ideas' }, { fraction: Math.min(1, thoughts.length / 20), text: `${thoughts.length} thoughts` }, {});
    if (!thoughts.length) { root.append(card('Ideas', el('p', {}, 'Write a thought or two first (My thoughts); the germs grow from them.'), el('button', { onclick: () => setMode('thoughts') }, 'My thoughts'))); return; }
    const gs = germs(thoughts, { seed, count: 6 });
    const map = mindMap(gs);
    root.append(card('Germs of algorithms, from your thoughts', el('p', {}, 'Each thought put in a category it may not seem to belong in. Each germ says which thought it came from.'), mapSvg(map, gs),
      el('div', { class: 'dl-row' }, el('button', { onclick: () => setMode('ideas', { fresh: true }) }, 'More germs'), el('button', { onclick: () => playThought(thoughts[thoughts.length - 1]) }, '♪ Hear your last thought'))));
    for (const g of gs) {
      root.append(card(`${g.title}`, el('p', {}, `${g.categoryName}: ${g.paradigm}.`), el('p', { class: 'quiet' }, g.reason),
        g.category === 'image' ? el('div', { class: 'dl-row' }, ...thoughtColours(g.from).map((c) => el('span', { style: `display:inline-block;width:22px;height:22px;border-radius:4px;background:${c}` }))) : null,
        pre(g.skeleton),
        el('div', { class: 'dl-row' },
          el('button', { class: 'primary', onclick: () => { b = { ...freshBuild(), sentence: g.sentence, section: 1 }; saveB(); ctx.toLearn('build'); } }, `Build "${g.sentence}"`),
          el('button', { onclick: () => ctx.toWork(g.skeleton, '', `algorithms/${g.title.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.pl`) }, 'Open the skeleton in Applaud'),
          g.category === 'sound' ? el('button', { onclick: () => playThought(g.from) }, '♪ Play') : null)));
    }
    ctx.say('Here are some germs from your thoughts.');
  }
  function mapSvg(map, gs) {
    const W = 680, H = 320, cx = W / 2, cy = H / 2;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'dl-map'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Mind map of the germs');
    const add = (tag, attrs, text) => { const n = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text) n.textContent = text; svg.append(n); return n; };
    add('circle', { cx, cy, r: 34, fill: '#f7d33a' }); add('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', 'font-size': 11 }, map.centre);
    map.branches.forEach((br, i) => {
      const ang = (i / map.branches.length) * 2 * Math.PI - Math.PI / 2;
      const bx = cx + Math.cos(ang) * 120, by = cy + Math.sin(ang) * 95;
      add('line', { x1: cx, y1: cy, x2: bx, y2: by, stroke: '#999' });
      add('text', { x: bx, y: by, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, fill: 'currentColor' }, br.name);
      br.germs.forEach((id, j) => {
        const g = gs.find((x) => x.id === id);
        const a2 = ang + (j - (br.germs.length - 1) / 2) * 0.35;
        const gx = cx + Math.cos(a2) * 190, gy = cy + Math.sin(a2) * 130;
        add('line', { x1: bx, y1: by, x2: gx, y2: gy, stroke: '#ccc' });
        const label = g.title.length > 24 ? `${g.title.slice(0, 23)}…` : g.title;
        add('text', { x: gx < cx ? Math.max(gx, 130) : Math.min(gx, W - 130), y: Math.min(H - 4, Math.max(12, gy)), 'text-anchor': gx < cx ? 'end' : 'start', 'font-size': 11, fill: 'currentColor' }, label);
      });
    });
    return svg;
  }
  function playThought(text) {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      thoughtNotes(text).forEach((n, k) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = 440 * 2 ** ((n - 69) / 12); o.type = 'triangle';
        g.gain.setValueAtTime(0.0001, ac.currentTime + k * 0.22); g.gain.exponentialRampToValueAtTime(0.2, ac.currentTime + k * 0.22 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + k * 0.22 + 0.2);
        o.connect(g).connect(ac.destination); o.start(ac.currentTime + k * 0.22); o.stop(ac.currentTime + k * 0.22 + 0.22);
      });
    } catch { /* no sound here */ }
  }

  // ---------- My thoughts ----------
  function thoughtsView() {
    nextFn = null;
    const ts = store.thoughts();
    ctx.setProgress({ fraction: 0, text: 'thoughts' }, { fraction: Math.min(1, ts.length / 20), text: `${ts.length} thoughts` }, {});
    const inp = el('textarea', { rows: 2, placeholder: 'Prolog is slow and needs optimisation through MNNs', 'aria-label': 'A thought' });
    ask = { options: [], open: (t) => { store.addThought(t); render(); } };
    root.append(card('My thoughts', el('p', {}, 'Your handwritten thought snippets: the germs and the companion use them, and each idea says which one it came from.'),
      el('form', { onsubmit: (e) => { e.preventDefault(); store.addThought(inp.value); ctx.companion.resolved(); render(); } }, inp, el('button', { class: 'primary' }, 'Keep this thought')),
      el('ol', { reversed: true }, ...ts.slice().reverse().map((t, j) => el('li', {}, t, ' ', el('button', { onclick: () => { store.removeThought(ts.length - 1 - j); render(); }, 'aria-label': 'Delete this thought' }, '×'))))));
  }

  function whereWasI() {
    if (mode === 'courses' && place) { const c = courseById(place.course); return `You are in ${c.name}, step ${Math.min(place.step + 1, c.steps.length)} of ${c.steps.length}.`; }
    if (b.sentence) return `You were building "${b.sentence}": ${SECTIONS[b.section] ?? 'done'}.`;
    return 'You haven\'t started yet. Tell me what your algorithm should do.';
  }

  // ---------- modes ----------
  function render() {
    root.replaceChildren(); ask = null;
    if (mode === 'build') renderBuild();
    else if (mode === 'courses') coursesView();
    else if (mode === 'up') upView();
    else if (mode === 'ideas') ideasView(false);
    else thoughtsView();
    store.set('mode', mode);
  }
  function setMode(m, { fresh = false } = {}) {
    mode = m;
    for (const btn of document.querySelectorAll('.dl-modes button')) btn.classList.toggle('on', btn.dataset.mode === m);
    if (m === 'ideas') { root.replaceChildren(); ideasView(fresh); store.set('mode', m); return; }
    render();
  }
  for (const btn of document.querySelectorAll('.dl-modes button')) btn.addEventListener('click', () => setMode(btn.dataset.mode));
  ctx.onYear = () => render();
  setMode(store.get('mode', 'build'));
  return { mode: setMode };
}
