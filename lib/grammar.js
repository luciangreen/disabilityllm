// Strings to grammar: a grammar (a Prolog DCG) that makes every example string, found from the
// strings themselves, and the state machine it is.
//
//   induce(['ab', 'abab', 'ababab']) ->
//     { ok, kind: 'repeat', prefix: '', unit: 'ab', suffix: '', min: 1,
//       dcg: 's --> "", units, "".\nunits --> "ab", units.\nunits --> "ab".', machine: {...} }
//   accepts(g, 'abab') -> true

const commonPrefix = (ss) => { let p = ss[0] ?? ''; for (const s of ss) while (!s.startsWith(p)) p = p.slice(0, -1); return p; };
const commonSuffix = (ss) => { let p = ss[0] ?? ''; for (const s of ss) while (!s.endsWith(p)) p = p.slice(1); return p; };
const q = (s) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

export function induce(strings) {
  const ss = [...new Set(strings.map(String))];
  if (!ss.length) return { ok: false, why: 'Give some example strings first.' };
  if (ss.length === 1) return finish({ kind: 'one', words: ss });
  const pre = commonPrefix(ss);
  const rest = ss.map((s) => s.slice(pre.length));
  const suf = commonSuffix(rest.filter(Boolean).length === rest.length ? rest : ['']);
  const middles = rest.map((s) => s.slice(0, s.length - suf.length));
  // a repeating unit: each middle is the unit some number of times (the shortest unit that works)
  for (let n = 1; n <= Math.max(...middles.map((m) => m.length)); n++) {
    const unit = middles.find((m) => m.length)?.slice(0, n);
    if (!unit || unit.length < n) break;
    const counts = middles.map((m) => (m.length % n === 0 && unit.repeat(m.length / n) === m ? m.length / n : -1));
    if (counts.every((c) => c >= 0) && new Set(counts).size > 1) return finish({ kind: 'repeat', prefix: pre, unit, suffix: suf, min: Math.min(...counts) });
  }
  return finish({ kind: 'choice', words: ss });
}

function finish(g) {
  g.ok = true;
  if (g.kind === 'repeat') {
    const head = `s --> ${[g.prefix && q(g.prefix), 'units', g.suffix && q(g.suffix)].filter(Boolean).join(', ')}.`;
    const units = g.min === 0 ? `units --> [].\nunits --> ${q(g.unit)}, units.` : `units --> ${q(g.unit)}.\nunits --> ${q(g.unit)}, units.`;
    g.dcg = `${head}\n${units}`;
    g.says = `${g.prefix ? `"${g.prefix}", then ` : ''}"${g.unit}" ${g.min === 0 ? 'any number of times' : g.min === 1 ? 'one or more times' : `${g.min} or more times`}${g.suffix ? `, then "${g.suffix}"` : ''}`;
    if (g.min > 1) g.dcg = `${head}\nunits --> ${Array(g.min).fill(q(g.unit)).join(', ')}, more.\nmore --> [].\nmore --> ${q(g.unit)}, more.`;
  } else {
    g.dcg = g.words.map((w) => `s --> ${q(w)}.`).join('\n');
    g.says = g.words.length === 1 ? `just "${g.words[0]}"` : `one of ${g.words.map((w) => `"${w}"`).join(', ')}`;
  }
  g.machine = machine(g);
  return g;
}

// the grammar as a state machine: states 0.., moves [from, text, to], the ending states
export function machine(g) {
  if (g.kind !== 'repeat') return { states: 2, moves: g.words.map((w) => [0, w, 1]), finals: [1] };
  const moves = []; let st = 0;
  if (g.prefix) moves.push([st, g.prefix, ++st]);
  for (let k = 0; k < g.min; k++) moves.push([st, g.unit, ++st]);
  const loop = g.min === 0 ? st : st;
  moves.push([loop, g.unit, loop]);
  if (g.suffix) moves.push([loop, g.suffix, ++st]);
  return { states: st + 1, moves, finals: [st] };
}

export function accepts(g, s) {
  const m = g.machine;
  // the machine's moves are whole strings: try each way through
  const go = (state, rest, seen) => {
    if (!rest && m.finals.includes(state)) return true;
    for (const [from, text, to] of m.moves) {
      if (from !== state || !text || !rest.startsWith(text)) continue;
      const k = `${to}|${rest.length - text.length}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (go(to, rest.slice(text.length), seen)) return true;
    }
    return false;
  };
  return go(0, String(s), new Set());
}
