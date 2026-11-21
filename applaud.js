// Applaud, the working pane: an editor for your Prolog with an assistant that thinks the way that
// helps most when writing an algorithm, done as algorithms (lib/think.js):
//   say what it is for (a signature and examples), base case first, then the recursive case on
//   something smaller, check each clause, see the known pattern, explain it back, and give the
//   one next step. Your examples run in Prolog (SWI-Prolog, or the page's interpreter).
import { api } from '/shared/api.js';
import { analyse, skeleton, readExamples, examplesGoal } from './lib/think.js';
import { explainClause } from './lib/explain.js';

const $ = (id) => document.getElementById(id);

export function mountApplaud(ctx) {
  const { el, store } = ctx;
  const code = $('apCode'), exs = $('apEx'), notes = $('apNotes'), file = $('apFile'), sig = $('apSig');
  const saved = store.get('applaud', { code: '', examples: '', file: 'algorithms/my_algorithm.pl', sig: '' });
  code.value = saved.code; exs.value = saved.examples; file.value = saved.file; sig.value = saved.sig;
  let fileId = null, baseMtime = null;
  let lastRun = { code: null, passed: 0 };
  const keep = () => store.set('applaud', { code: code.value, examples: exs.value, file: file.value, sig: sig.value });

  const note = (n, cls = '') => el('div', { class: `ap-note ${cls}` }, el('span', {}, n.text),
    n.fix ? el('button', { onclick: () => { insert(n.fix.insert); check(); } }, n.fix.label) : null);
  function insert(text) {
    const at = code.selectionEnd || code.value.length;
    code.value = code.value.slice(0, at) + text + code.value.slice(at);
    keep();
  }

  // the assistant: what's wrong first, then the pattern it sees, then the one next step
  function check({ quiet = false } = {}) {
    const r = analyse(code.value);
    const problems = r.notes.filter((n) => n.kind !== 'pattern');
    const patterns = r.notes.filter((n) => n.kind === 'pattern');
    // examples that all ran as you said: the next step is to try more cases, or to melt it down
    if (r.next.kind === 'examples' && lastRun.passed && lastRun.code === code.value) r.next = { kind: 'more', text: `All ${lastRun.passed} of your examples give what you said. Next: an edge case (the empty list, a negative number, one item), or melt it down in the Classroom.` };
    else if (r.next.kind === 'examples' && readExamples(exs.value).length) r.next = { kind: 'run', text: 'It reads well, and you have examples: press Run examples to try them in Prolog.' };
    notes.replaceChildren(...[
      el('div', { class: 'ap-note next' }, el('strong', {}, 'Next step: '), el('span', {}, r.next.text), r.next.fix ? el('button', { onclick: () => { insert(r.next.fix.insert); check(); } }, r.next.fix.label) : null),
      ...problems.filter((n) => n !== r.next).map((n) => note(n, 'problem')),
      ...patterns.map((n) => note(n, 'good')),
      r.preds.length ? el('div', { class: 'ap-note' }, el('span', {}, `Predicates: ${r.preds.map((p) => `${p.key} (${p.clauses} clause${p.clauses > 1 ? 's' : ''}${p.recursive ? `: ${p.base} base, ${p.recursive} recursive` : ''})`).join('; ')}.`)) : null].filter(Boolean));
    const first = problems[0];
    ctx.companion.problem(first?.text ?? null, first?.fix ? { label: first.fix.label, run: () => { insert(first.fix.insert); check(); } } : null);
    if (!quiet && !problems.length && r.preds.length) ctx.companion.resolved();
    return r;
  }

  let timer = null;
  code.addEventListener('input', () => {
    keep(); ctx.companion.concentrating(true);
    clearTimeout(timer);
    timer = setTimeout(() => { ctx.companion.concentrating(false); check({ quiet: true }); }, 900);
  });
  exs.addEventListener('input', keep);
  sig.addEventListener('input', keep);
  file.addEventListener('change', keep);
  // Tab indents, as in other editors
  code.addEventListener('keydown', (e) => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); insert('    '); code.selectionStart = code.selectionEnd = code.selectionStart; } });

  $('apCheck').addEventListener('click', () => check());
  $('apNext').addEventListener('click', () => { const r = check(); ctx.say(r.next.text); });

  // the signature: name(+type, -type) gives the skeleton (base case, recursive case)
  $('apSkel').addEventListener('click', () => {
    const m = /^\s*([a-z][A-Za-z0-9_]*)\s*\((.*)\)\s*$/.exec(sig.value);
    if (!m) { notes.prepend(note({ text: 'Write the signature as name(+type, -type), for example total(+list(int), -int).' }, 'problem')); return; }
    const types = m[2].split(/,(?![^(]*\))/).map((t) => t.trim().replace(/^[+\-?]/, ''));
    const sk = skeleton(m[1], types);
    code.value = code.value.trim() ? `${code.value.trimEnd()}\n\n${sk}` : sk;
    keep(); check();
  });

  // run the examples: each query in Prolog, its answer compared with yours
  $('apRun').addEventListener('click', async () => {
    const qs = readExamples(exs.value);
    if (!qs.length) { notes.prepend(note({ text: 'Write an example as a query and its answer: ?- total([1,2,3], S). S = 6.' }, 'problem')); return; }
    const res = el('div', { class: 'ap-note' }, 'Running in Prolog…');
    notes.prepend(res);
    try {
      const r = await ctx.runProlog(code.value, examplesGoal(qs));
      const lines = r.out.split('\n');
      const rows = qs.map((q, k) => {
        const line = lines.find((l) => l.startsWith(`ex(${k},`)) ?? '';
        const ok = line === `ex(${k},ok)`;
        const got = /got\(\[(.*)\]\)\)$/.exec(line)?.[1];
        return el('div', { class: ok ? 'ok' : 'bad' }, `${ok ? '✓' : '✗'} ?- ${q.goal}.  ${ok ? 'as you said' : got !== undefined ? `gives ${got}` : /failed/.test(line) ? 'fails (false)' : /unexpected_true/.test(line) ? 'is true, but you said false' : 'gave an error'}`);
      });
      const passed = rows.filter((x) => x.className === 'ok').length;
      res.replaceChildren(...[el('strong', {}, `${passed} of ${qs.length} examples as you said. `), ...rows, r.err.trim() ? el('pre', {}, r.err.trim().slice(0, 600)) : null].filter(Boolean));
      lastRun = { code: code.value, passed: passed === qs.length ? passed : 0 };
      res.className = `ap-note ${passed === qs.length ? 'good' : 'problem'}`;
      check({ quiet: true }); res.remove(); notes.prepend(res);
      if (passed === qs.length) { ctx.companion.resolved(); ctx.companion.problem(null); ctx.say('All your examples give what you said.'); }
      else ctx.companion.problem(`${qs.length - passed} example${qs.length - passed > 1 ? 's' : ''} not as you said yet.`);
    } catch (e) { res.replaceChildren(`Couldn't run Prolog here: ${e.message}`); }
  });

  // explain it back at your year level
  const explainBtn = el('button', { title: 'Your clauses read back in words', onclick: () => { notes.prepend(el('div', { class: 'ap-note' }, explainClause(code.value, ctx.year()))); } }, 'Explain');
  $('apNext').before(explainBtn);

  $('apOpen').addEventListener('click', async () => {
    try { const f = await api.files.read(file.value, { id: fileId }); code.value = f.content; fileId = f.id ?? null; baseMtime = f.mtimeMs ?? null; if (f.path) file.value = f.path; keep(); check(); }
    catch (e) { notes.prepend(note({ text: `Couldn't open ${file.value}: ${e.message}` }, 'problem')); }
  });
  $('apSave').addEventListener('click', async () => {
    try { const r = await api.files.write(file.value, code.value, { mkdirs: true, baseMtime, id: fileId }); fileId = r?.id ?? fileId; baseMtime = r?.mtimeMs ?? null; if (r?.path) file.value = r.path; keep(); notes.prepend(note({ text: `Saved ${file.value}.` }, 'good')); ctx.companion.resolved(); }
    catch (e) { notes.prepend(note({ text: e.status === 409 ? `${file.value} changed since you opened it: open it again, or save under another name.` : `Couldn't save: ${e.message}` }, 'problem')); }
  });

  check({ quiet: true });
  return {
    load(text, examples, path) {
      code.value = text; exs.value = examples ?? ''; if (path) file.value = path;
      fileId = null; baseMtime = null; keep(); check({ quiet: true });
    }
  };
}
