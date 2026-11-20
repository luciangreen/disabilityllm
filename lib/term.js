// A small Prolog reader and writer, enough for the clauses the app writes and abstracts.
//   readClauses(text) -> [term]      terms: { v: 'X' } | { a: 'foo' } | { n: 3 } | { f: 'name', args: [term] }
//   write(term) -> text              lists are '[|]'(H, T) and '[]', as in SWI-Prolog
// Operators: :- , ; -> = == \= is =:= =\= < > =< >= + - * / // mod >> ^ \+

const OPS = {
  ':-': [1200, 'xfx'], '-->': [1200, 'xfx'], ';': [1100, 'xfy'], '|': [1100, 'xfy'], '->': [1050, 'xfy'], ',': [1000, 'xfy'],
  '=': [700, 'xfx'], '\\=': [700, 'xfx'], '==': [700, 'xfx'], '\\==': [700, 'xfx'], 'is': [700, 'xfx'], '=:=': [700, 'xfx'], '=\\=': [700, 'xfx'],
  '<': [700, 'xfx'], '>': [700, 'xfx'], '=<': [700, 'xfx'], '>=': [700, 'xfx'], '=..': [700, 'xfx'], '>>': [200, 'xfy'],
  '+': [500, 'yfx'], '-': [500, 'yfx'], '*': [400, 'yfx'], '/': [400, 'yfx'], '//': [400, 'yfx'], 'mod': [400, 'yfx'], '^': [200, 'xfy']
};
const PREFIX = { '\\+': 900, '-': 200 };
const SYM = '+-*/\\^<>=~:.?@#&$';

function tokens(s) {
  const out = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '%') { while (i < s.length && s[i] !== '\n') i++; continue; }
    let m;
    if ((m = /^\d+(\.\d+)?/.exec(s.slice(i)))) { out.push({ k: 'n', v: Number(m[0]) }); i += m[0].length; continue; }
    if ((m = /^[A-Z_][A-Za-z0-9_]*/.exec(s.slice(i)))) { out.push({ k: 'v', v: m[0] }); i += m[0].length; continue; }
    if ((m = /^[a-z][A-Za-z0-9_]*/.exec(s.slice(i)))) { out.push({ k: 'a', v: m[0], call: s[i + m[0].length] === '(' }); i += m[0].length; continue; }
    if (c === "'") { let j = i + 1, v = ''; while (j < s.length && s[j] !== "'") { if (s[j] === '\\') j++; v += s[j++]; } out.push({ k: 'a', v, call: s[j + 1] === '(' }); i = j + 1; continue; }
    if (c === '"') { let j = i + 1, v = ''; while (j < s.length && s[j] !== '"') { if (s[j] === '\\') j++; v += s[j++]; } out.push({ k: 's', v }); i = j + 1; continue; }
    if ('()[],|{}'.includes(c)) { out.push({ k: 'p', v: c }); i++; continue; }
    if (c === '!' || c === ';') { out.push({ k: 'a', v: c }); i++; continue; }
    if (SYM.includes(c)) {
      let j = i; while (j < s.length && SYM.includes(s[j])) j++;
      const v = s.slice(i, j);
      if (v === '.' && (j >= s.length || /\s|%/.test(s[j]))) { out.push({ k: 'end' }); i = j; continue; }
      out.push({ k: 'a', v, call: s[j] === '(' }); i = j; continue;
    }
    throw new Error(`can't read "${s.slice(i, i + 12)}"`);
  }
  return out;
}

export const list = (items, tail = { a: '[]' }) => items.reduceRight((t, h) => ({ f: '[|]', args: [h, t] }), tail);

class Reader {
  constructor(ts) { this.ts = ts; this.i = 0; }
  peek() { return this.ts[this.i]; }
  next() { return this.ts[this.i++]; }
  expect(v) { const t = this.next(); if (!t || t.v !== v) throw new Error(`expected ${v}`); }
  primary(max) {
    const t = this.next();
    if (!t) throw new Error('unexpected end');
    if (t.k === 'n') return { n: t.v };
    if (t.k === 'v') return { v: t.v };
    if (t.k === 's') return list([...t.v].map((ch) => ({ n: ch.codePointAt(0) })));
    if (t.k === 'p' && t.v === '(') { const x = this.term(1200); this.expect(')'); return x; }
    if (t.k === 'p' && t.v === '[') {
      if (this.peek()?.v === ']') { this.next(); return { a: '[]' }; }
      const items = [this.term(999)];
      while (this.peek()?.v === ',') { this.next(); items.push(this.term(999)); }
      let tail = { a: '[]' };
      if (this.peek()?.v === '|') { this.next(); tail = this.term(999); }
      this.expect(']');
      return list(items, tail);
    }
    if (t.k === 'p' && t.v === '{') { const x = this.term(1200); this.expect('}'); return { f: '{}', args: [x] }; }
    if (t.k === 'a') {
      if (t.call) {
        this.expect('(');
        const args = [this.term(999)];
        while (this.peek()?.v === ',') { this.next(); args.push(this.term(999)); }
        this.expect(')');
        return { f: t.v, args };
      }
      if (t.v in PREFIX && this.peek() && !(this.peek().k === 'p' && [')', ',', ']', '|'].includes(this.peek().v)) && this.peek().k !== 'end' && !(this.peek().k === 'a' && this.peek().v in OPS)) {
        if (t.v === '-' && this.peek().k === 'n') return { n: -this.next().v };
        const arg = this.term(PREFIX[t.v]);
        return { f: t.v, args: [arg] };
      }
      return { a: t.v };
    }
    throw new Error(`unexpected ${t.v ?? t.k}`);
  }
  term(max) {
    let left = this.primary(max), leftP = 0;
    for (;;) {
      const t = this.peek();
      if (!t) break;
      const name = t.k === 'a' ? t.v : t.k === 'p' && (t.v === ',' || t.v === '|') ? t.v : null;
      if (!name || !(name in OPS)) break;
      const [p, type] = OPS[name];
      if (p > max) break;
      const la = type === 'yfx' ? p : p - 1, ra = type === 'xfy' ? p : p - 1;
      if (leftP > la) break;
      this.next();
      const right = this.term(ra);
      left = { f: name === '|' ? ';' : name, args: [left, right] }; leftP = p;
    }
    return left;
  }
}

export function readClauses(text) {
  const ts = tokens(text); const out = []; let start = 0;
  for (let k = 0; k < ts.length; k++) {
    if (ts[k].k !== 'end') continue;
    const r = new Reader(ts.slice(start, k));
    out.push(r.term(1200));
    if (r.i !== k - start) throw new Error('unexpected text before the full stop');
    start = k + 1;
  }
  if (start < ts.length) throw new Error('a clause has no full stop');
  return out;
}

const atomText = (a) => (/^[a-z][A-Za-z0-9_]*$/.test(a) || a === '[]' || a === '!' || a === ';' || /^[+\-*/\\^<>=~:.?@#&$]+$/.test(a) ? a : `'${a.replace(/'/g, "\\'")}'`);

export function write(t, max = 1200) {
  if ('v' in t) return t.v;
  if ('n' in t) return String(t.n);
  if ('a' in t) return atomText(t.a);
  if (t.f === '[|]') {
    const items = []; let x = t;
    while (x.f === '[|]') { items.push(write(x.args[0], 999)); x = x.args[1]; }
    return `[${items.join(', ')}${'a' in x && x.a === '[]' ? '' : `|${write(x, 999)}`}]`;
  }
  if (t.f === '{}' && t.args.length === 1) return `{${write(t.args[0])}}`;
  if (t.args.length === 2 && t.f in OPS) {
    const [p, type] = OPS[t.f];
    const la = type === 'yfx' ? p : p - 1, ra = type === 'xfy' ? p : p - 1;
    const sep = t.f === ',' ? ', ' : [':-', '-->', ';', '->', 'is', 'mod', '=', '==', '\\=', '=:=', '=\\=', '<', '>', '=<', '>=', '=..'].includes(t.f) ? ` ${t.f} ` : ` ${t.f} `;
    const s = `${write(t.args[0], la)}${sep}${write(t.args[1], ra)}`;
    return p > max ? `(${s})` : s;
  }
  if (t.args.length === 1 && t.f in PREFIX) {
    const s = `${t.f}${t.f === '\\+' ? ' ' : ''}${write(t.args[0], PREFIX[t.f])}`;
    return PREFIX[t.f] > max ? `(${s})` : s;
  }
  return `${atomText(t.f)}(${t.args.map((a) => write(a, 999)).join(', ')})`;
}

export const isVar = (t) => 'v' in t;
export const sameTerm = (a, b) => write(a) === write(b);
