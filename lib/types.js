// Types of the data you give, as Prolog would see it. Values are JSON: numbers, strings (atoms),
// true/false, and arrays (lists).
//
//   typeOf(3) = 'int'   typeOf([1,2]) = 'list(int)'   typeOf([]) = 'list(any)'   typeOf('a') = 'atom'
//   join('list(int)', 'list(any)') = 'list(int)'      fits('list(any)', 'list(int)') = true

export function typeOf(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float';
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'string') return 'atom';
  if (Array.isArray(v)) {
    let t = 'any';
    for (const x of v) { t = join(t, typeOf(x)); if (t === null) return 'list(mixed)'; }
    return `list(${t})`;
  }
  return 'unknown';
}

const inner = (t) => (/^list\((.*)\)$/.exec(t) || [])[1];

// the least type that has both (null if they don't go together)
export function join(a, b) {
  if (a === b) return a;
  if (a === 'any') return b;
  if (b === 'any') return a;
  if ((a === 'int' && b === 'float') || (a === 'float' && b === 'int')) return 'number';
  if (a === 'number' && (b === 'int' || b === 'float')) return 'number';
  if (b === 'number' && (a === 'int' || a === 'float')) return 'number';
  const ia = inner(a), ib = inner(b);
  if (ia !== undefined && ib !== undefined) { const j = join(ia, ib); return j === null ? null : `list(${j})`; }
  return null;
}

// a value of type `have` can go where `want` is asked for
export function fits(have, want) {
  if (want === 'any' || have === want) return true;
  if (have === 'any') return true;
  if (want === 'number') return have === 'int' || have === 'float' || have === 'number';
  const ih = inner(have), iw = inner(want);
  if (ih !== undefined && iw !== undefined) return fits(ih, iw);
  return false;
}

// the type of every example's input (or output): their join
export function typeOfAll(values) {
  let t = 'any';
  for (const v of values) { t = join(t, typeOf(v)); if (t === null) return 'mixed'; }
  return t;
}

// a value written as Prolog writes it: [1,2,3], abc, 'Hello'
export function show(v) {
  if (Array.isArray(v)) return `[${v.map(show).join(',')}]`;
  if (typeof v === 'string') return /^[a-z][a-zA-Z0-9_]*$/.test(v) ? v : `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

// read a value the way you type it: 1, -2, [1,2,3], [a,b], abc, "Hi there", [] (null if it can't)
export function read(text) {
  const s = String(text ?? '').trim();
  let i = 0;
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  function value() {
    ws();
    if (s[i] === '[') {
      i++; ws(); const out = [];
      if (s[i] === ']') { i++; return out; }
      for (;;) { out.push(value()); ws(); if (s[i] === ',') { i++; continue; } if (s[i] === ']') { i++; return out; } throw new Error('expected , or ]'); }
    }
    let m;
    if ((m = /^-?\d+(\.\d+)?/.exec(s.slice(i)))) { i += m[0].length; return Number(m[0]); }
    if (s[i] === '"' || s[i] === "'") {
      const q = s[i++]; let out = '';
      while (i < s.length && s[i] !== q) { if (s[i] === '\\') i++; out += s[i++]; }
      if (s[i] !== q) throw new Error('unclosed quote');
      i++; return out;
    }
    if ((m = /^(true|false)\b/.exec(s.slice(i)))) { i += m[0].length; return m[0] === 'true'; }
    if ((m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i)))) { i += m[0].length; return m[0]; }
    throw new Error(`can't read "${s.slice(i, i + 10)}"`);
  }
  try { const v = value(); ws(); return i === s.length ? v : null; } catch { return null; }
}

// equal as Prolog terms
export function same(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, k) => same(x, b[k]));
  return a === b;
}
