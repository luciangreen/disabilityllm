// Predicting your choices from the past, so some questions can be skipped. Each choice you make is
// remembered with its kind of question and its context (the word asked about, say). A question is
// skipped only when you have answered the same kind in the same context at least MIN times and
// chose the same answer at least SHARE of the time (and skipping is switched on). Skipped
// questions are listed, and each can be asked again.
//
//   remember(memory, { kind, context, choice }) -> memory
//   predict(memory, kind, context) -> { choice, count, share } | null
//   skip(memory, kind, context, on) -> choice | null

export const MIN = 3;
export const SHARE = 0.8;
export const MAX = 500;

export function remember(memory, { kind, context = '', choice }) {
  const m = Array.isArray(memory) ? memory : [];
  if (!kind || choice === undefined || choice === null || choice === '') return m;
  return [...m, { kind, context: String(context), choice: String(choice) }].slice(-MAX);
}

export function predict(memory, kind, context = '') {
  const rows = (memory ?? []).filter((r) => r.kind === kind && r.context === String(context));
  if (!rows.length) return null;
  const counts = new Map();
  for (const r of rows) counts.set(r.choice, (counts.get(r.choice) ?? 0) + 1);
  let best = null;
  // the most chosen; on a tie, the one chosen most recently
  for (const [choice, n] of counts) {
    const last = rows.map((r) => r.choice).lastIndexOf(choice);
    if (!best || n > best.n || (n === best.n && last > best.last)) best = { choice, n, last };
  }
  return { choice: best.choice, count: rows.length, share: best.n / rows.length };
}

export function skip(memory, kind, context, on) {
  if (!on) return null;
  const p = predict(memory, kind, context);
  return p && p.count >= MIN && p.share >= SHARE ? p.choice : null;
}
