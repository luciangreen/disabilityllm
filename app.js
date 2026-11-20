// Disability LLM: two panes. The Classroom (learning) asks you, in Prolog, how to build your
// algorithm, or teaches you a course; Applaud (working) is the editor where you write algorithms,
// with an assistant that thinks the way that helps most. A companion dances in the corner, and the
// LucianOS character (your photo, its eyes and mouth placed by you, and a voice) talks with you.
// Everything is worked out by algorithms here: no language model.
import { api } from '/shared/api.js';
import { mountCharacter } from '/shared/character/character.js';
import { BANDS, yearName } from './lib/explain.js';
import { decide } from './lib/companion.js';
import { mountClassroom } from './classroom.js';
import { mountApplaud } from './applaud.js';

const $ = (id) => document.getElementById(id);
export const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k.startsWith('aria-') || k === 'role' || k === 'for' || k.startsWith('data-')) n.setAttribute(k, v);
    else n[k] = v;
  }
  n.append(...kids.flat().filter((x) => x !== null && x !== undefined && x !== false));
  return n;
};

// ---- what is kept: your place, settings and choices in the suite's state; your thoughts and
// choice history in its database when it has one (SQLite or MySQL on the LucianOS server) ----
const KEY = 'disabilityllm';
let saved = {};
const db = api.db ?? null;
async function loadAll() {
  saved = (await api.state.get(KEY).catch(() => null)) ?? {};
  saved.settings ??= { year: 7, predict: true, buddy: 'tiger', panes: { learn: true, work: true } };
  saved.thoughts ??= [];
  saved.choices ??= [];
  if (db) {
    try {
      const ts = await db.list('dl_thoughts', { limit: 200 });
      if (ts.length) saved.thoughts = ts.map((r) => r.data.text).reverse();
      const cs = await db.list('dl_choices', { limit: 500 });
      if (cs.length) saved.choices = cs.map((r) => r.data).reverse();
    } catch { /* the state copy is used */ }
  }
}
let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => api.state.set(KEY, saved).catch(() => {}), 300);
}
const store = {
  get: (k, d) => saved[k] ?? d,
  set: (k, v) => { saved[k] = v; save(); },
  settings: () => saved.settings,
  thoughts: () => saved.thoughts,
  addThought(text) {
    const t = String(text).trim(); if (!t) return;
    saved.thoughts = [...saved.thoughts, t].slice(-200); save();
    db?.insert('dl_thoughts', { text: t }, t).catch(() => {});
  },
  removeThought(i) { saved.thoughts = saved.thoughts.filter((_, k) => k !== i); save(); },
  choices: () => saved.choices,
  addChoice(c) {
    saved.choices = [...saved.choices, c].slice(-500); save();
    db?.insert('dl_choices', c, `${c.kind} ${c.context} ${c.choice}`).catch(() => {});
  }
};

// ---- Prolog: your code in a file in the suite, then a goal on it (SWI-Prolog on the server, or the
// pl2detlog interpreter in the page) ----
export async function runProlog(code, goal, { timeoutMs = 20000 } = {}) {
  const file = `.disabilityllm/run_${Date.now() % 100000}.pl`;
  await api.files.write(file, code, { mkdirs: true, force: true });
  const job = await api.jobs.prolog({ goal, consult: [file], label: 'Disability LLM: check' });
  return new Promise((resolve) => {
    let out = '', err = '';
    const timer = setTimeout(() => { api.jobs.cancel(job.id).catch(() => {}); resolve({ ok: false, out, err: err + '\n(stopped: it took too long)' }); }, timeoutMs);
    api.jobs.stream(job.id, {
      output: ({ stream, text }) => { if (stream === 'stderr') err += text; else if (stream !== 'system') out += text; },
      end: (s) => { clearTimeout(timer); api.files.trash(file).catch(() => {}); resolve({ ok: s.status === 'done' && s.exitCode === 0, out, err, status: s.status }); }
    });
  });
}

// ---- the panes: each folds to its labelled bar ----
function setPane(id, open) {
  const pane = $(id), btn = $(`${id}Head`);
  pane.classList.toggle('collapsed', !open);
  btn.setAttribute('aria-expanded', String(open));
  saved.settings.panes[id] = open; save();
}
function panes() {
  for (const id of ['learn', 'work']) {
    $(`${id}Head`).addEventListener('click', () => setPane(id, $(id).classList.contains('collapsed')));
    setPane(id, saved.settings.panes?.[id] !== false);
  }
  // on a phone the header's two buttons show one pane at a time
  $('tabLearn').addEventListener('click', () => { setPane('learn', true); setPane('work', false); });
  $('tabWork').addEventListener('click', () => { setPane('work', true); setPane('learn', false); });
}

// ---- two progress bars along the bottom: this section, and overall (the classroom sets them) ----
const footer = { summary: null, ff: null, restart: null };
function bar(which, fraction, text) {
  const pct = Math.round(Math.max(0, Math.min(1, fraction || 0)) * 100);
  $(`fill${which}`).style.width = `${pct}%`;
  $(`progress${which}`).setAttribute('aria-valuenow', String(pct));
  $(`text${which}`).textContent = text ?? `${pct}%`;
}
// section: { fraction, text }   overall: { fraction, text }
export function setProgress(section, overall, handlers = {}) {
  bar('Sec', section?.fraction, section?.text);
  bar('All', overall?.fraction, overall?.text);
  Object.assign(footer, handlers);
  $('summaryBtn').disabled = !footer.summary;
  $('ffBtn').disabled = !footer.ff;
  $('restartBtn').disabled = !footer.restart;
}

// ---- the companion in the corner ----
const FIGS = {
  tiger: `<svg viewBox="0 0 100 100" role="img" aria-label="A tiger cub"><ellipse cx="50" cy="74" rx="22" ry="18" fill="#f39a2b"/><path d="M36 64 l6 18 M50 60 l0 22 M64 64 l-6 18" stroke="#3a2a12" stroke-width="3"/><circle cx="50" cy="42" r="22" fill="#f6a23a"/><circle cx="32" cy="24" r="7" fill="#f6a23a"/><circle cx="68" cy="24" r="7" fill="#f6a23a"/><circle cx="32" cy="24" r="3.5" fill="#fde2c2"/><circle cx="68" cy="24" r="3.5" fill="#fde2c2"/><path d="M38 28 l4 8 M50 24 l0 8 M62 28 l-4 8" stroke="#3a2a12" stroke-width="3"/><ellipse cx="50" cy="52" rx="11" ry="8" fill="#fde2c2"/><circle cx="41" cy="40" r="3.2" fill="#1d1a16"/><circle cx="59" cy="40" r="3.2" fill="#1d1a16"/><path d="M47 49 h6 l-3 3z" fill="#3a2a12"/><path d="M50 52 q-4 4 -7 2 M50 52 q4 4 7 2" stroke="#3a2a12" stroke-width="1.6" fill="none"/><path d="M72 80 q14 -2 12 -16" stroke="#f39a2b" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`,
  child: `<svg viewBox="0 0 100 100" role="img" aria-label="A child in a star costume"><path d="M50 4 l7 14 15 2 -11 10 3 15 -14 -7 -14 7 3 -15 -11 -10 15 -2z" fill="#f7d33a" stroke="#c9a400" stroke-width="2"/><circle cx="50" cy="30" r="12" fill="#f1c9a5"/><circle cx="45" cy="29" r="1.8" fill="#222"/><circle cx="55" cy="29" r="1.8" fill="#222"/><path d="M45 35 q5 4 10 0" stroke="#7a3b2a" stroke-width="1.6" fill="none"/><path d="M36 48 h28 l6 30 h-40z" fill="#5b7be6"/><path d="M36 52 l-12 14 M64 52 l12 14" stroke="#f1c9a5" stroke-width="5" stroke-linecap="round"/><path d="M42 78 v16 M58 78 v16" stroke="#3b3b55" stroke-width="6" stroke-linecap="round"/></svg>`
};
const buddy = { lastInput: 0, lastResolved: 0, lastSpoke: 0, problem: null, turn: 0, concentrating: false };
export const companion = {
  resolved() { buddy.lastResolved = Date.now(); },
  problem(text) { buddy.problem = text || null; },
  concentrating(on) { buddy.concentrating = !!on; },
  say(text, { action } = {}) { showBubble(text, action); }
};
function showBubble(text, action) {
  const b = $('buddyBubble');
  b.replaceChildren(...[el('div', {}, text), action ? el('button', { onclick: () => { action.run(); b.classList.add('hidden'); } }, action.label) : null, el('button', { onclick: () => b.classList.add('hidden'), 'aria-label': 'Close' }, '×')].filter(Boolean));
  b.classList.remove('hidden');
  $('buddyFig').classList.add('dancing');
  clearTimeout(showBubble.t);
  showBubble.t = setTimeout(() => { b.classList.add('hidden'); $('buddyFig').classList.remove('dancing'); }, 14000);
}
function startCompanion() {
  const fig = $('buddyFig');
  const draw = () => { fig.innerHTML = FIGS[saved.settings.buddy] ?? FIGS.tiger; };
  draw();
  fig.addEventListener('click', () => { saved.settings.buddy = saved.settings.buddy === 'tiger' ? 'child' : 'tiger'; save(); draw(); });
  const typed = () => { buddy.lastInput = Date.now(); };
  addEventListener('keydown', typed, true);
  addEventListener('input', typed, true);
  addEventListener('pointerdown', typed, true);
  setInterval(() => {
    const d = decide({ ...buddy, thoughts: saved.thoughts }, Date.now());
    if (d.act === 'quiet') return;
    buddy.lastSpoke = Date.now(); buddy.turn++;
    showBubble(d.text, d.act === 'fix' && buddy.fix ? buddy.fix : null);
  }, 2000);
}

// ---- the talking character: it reads out each question, and you can answer it aloud ----
let character = null;
const answerers = [];
export function onSpoken(fn) { answerers.push(fn); }
export function say(text) { character?.say(text).catch?.(() => {}); }

async function main() {
  await loadAll();
  const year = $('year');
  for (let y = 1; y <= 14; y++) year.append(el('option', { value: String(y), selected: y === Number(saved.settings.year) }, yearName(y)));
  year.addEventListener('change', () => { saved.settings.year = Number(year.value); save(); ctx.onYear?.(); });
  $('predictOn').checked = saved.settings.predict !== false;
  $('predictOn').addEventListener('change', () => { saved.settings.predict = $('predictOn').checked; save(); });
  panes();
  startCompanion();
  $('summaryBtn').addEventListener('click', () => footer.summary?.());
  $('ffBtn').addEventListener('click', () => footer.ff?.());
  $('restartBtn').addEventListener('click', () => footer.restart?.());

  const ctx = { el, store, save, runProlog, setProgress, companion, say, onSpoken, year: () => Number(saved.settings.year) || 7, predicting: () => saved.settings.predict !== false, bands: BANDS };
  const applaud = mountApplaud(ctx);
  ctx.toWork = (code, examples, name) => { applaud.load(code, examples, name); setPane('work', true); };
  const classroom = mountClassroom(ctx);
  ctx.toLearn = (mode) => { classroom.mode(mode); setPane('learn', true); };
  $('germBtn').addEventListener('click', () => { classroom.mode('ideas', { fresh: true }); setPane('learn', true); });

  try {
    character = await mountCharacter({
      greeting: saved.place ? 'Welcome back. Shall we carry on where you left off?' : 'Hello. Tell me what your algorithm should do, in a sentence, and I\'ll ask you about it in Prolog.',
      help: 'Answer my questions by tapping, or say the answer: a number, yes or no. You can also say next, summary, fast forward, start again, or where was I.',
      handle: async (cmd, text) => {
        for (const fn of answerers) { const r = await fn(String(text ?? '').trim().toLowerCase(), cmd); if (r) return r; }
        return null;
      }
    });
  } catch { /* the page works without the character */ }
}
main();
