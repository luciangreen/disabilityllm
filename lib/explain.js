// Explanations at your year level. Year 1 to Year 12, then undergraduate (13) and postgraduate
// (14). The year picks a band; each band has a longest sentence and words it may use.
//
//   band(year) -> 'young' (Years 1-4) | 'middle' (5-8) | 'older' (9-12) | 'uni' (13-14)
//   explainChain(steps, year) -> text    explainClause(text, year) -> text
//   fitsBand(text, band) -> true when every sentence is short enough for it

import { predName, stepSays } from './fragments.js';
import { readClauses, write } from './term.js';

export const BANDS = {
  young: { years: [1, 4], longest: 12 },
  middle: { years: [5, 8], longest: 18 },
  older: { years: [9, 12], longest: 26 },
  uni: { years: [13, 14], longest: 40 }
};

export function band(year) {
  const y = Math.max(1, Math.min(14, Math.round(Number(year) || 7)));
  for (const [b, { years }] of Object.entries(BANDS)) if (y >= years[0] && y <= years[1]) return b;
  return 'middle';
}

export const yearName = (y) => (y <= 12 ? `Year ${y}` : y === 13 ? 'undergraduate' : 'postgraduate');

export function sentences(text) { return String(text).split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean); }
export function wordCount(s) { return s.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length; }
export function fitsBand(text, b) { return sentences(text).every((s) => wordCount(s) <= BANDS[b].longest); }

export function explainChain(steps, year) {
  const b = band(year);
  const says = steps.map(stepSays);
  if (!steps.length) return 'It gives back what it was given.';
  if (b === 'young') return says.map((s, k) => `${k === 0 ? 'First it' : k === says.length - 1 ? 'Last it' : 'Then it'} ${s}.`).join(' ');
  if (b === 'middle') return `It does ${steps.length} thing${steps.length > 1 ? 's' : ''} in a row. ${says.map((s, k) => `Step ${k + 1} ${s}.`).join(' ')} Each step gets what the step before it made.`;
  const names = steps.map(predName);
  if (b === 'older') return `The algorithm is a chain of ${steps.length} predicate${steps.length > 1 ? 's' : ''}: ${names.join(', then ')}. ${says.map((s, k) => `${names[k]} ${s}.`).join(' ')} The output of each is the input of the next, so it is the nested call ${steps.reduce((x, s) => `${predName(s)}(${x})`, 'In')}.`;
  return `It composes ${names.join(' ∘ ')} (applied left to right): ${says.join('; then ')}. Each predicate is a function on the data here (one output for each input), so the composition is too, and its correctness follows from each step's.`;
}

// a clause read back in words: what it says is true
export function explainClause(text, year) {
  let cs;
  try { cs = readClauses(text); } catch (e) { return `This doesn't read as Prolog yet: ${e.message}.`; }
  const b = band(year);
  return cs.map((c) => {
    if (c.f === ':-' && c.args.length === 2) {
      const goals = []; const flat = (g) => (g.f === ',' ? (flat(g.args[0]), flat(g.args[1])) : goals.push(g)); flat(c.args[1]);
      const head = write(c.args[0]);
      if (b === 'young') return `${head} is true when ${goals.length === 1 ? 'this is true' : `these ${goals.length} things are true`}: ${goals.map((g) => write(g)).join(', and ')}.`;
      return `${head} holds if ${goals.map((g) => write(g)).join(' and ')}${b === 'uni' ? ' (each goal is tried in order, left to right)' : ''}.`;
    }
    return b === 'young' ? `${write(c)} is always true.` : `Fact: ${write(c)}.`;
  }).join(' ');
}
