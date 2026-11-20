// The companion in the corner (a tiger cub, or a child in a costume): when it speaks up, and what
// it says. It is quiet while you are concentrating (typing, or busy in the last few seconds). After
// a pause that follows something you finished, it says something on the side: sings Grammar Logic
// key terms, lists your recent thoughts, or gives an idea. If something is left to fix, it helps
// with that instead. It speaks once per pause.
//
//   decide(st, now) -> { act: 'quiet' | 'fix' | 'sing' | 'thoughts' | 'idea', text }
//   st: { lastInput, lastResolved, lastSpoke, problem, thoughts, turn, concentrating }

export const PAUSE = 8000;   // a pause is this long with nothing typed (ms)
export const BUSY = 4000;    // typed this recently: concentrating

export const GL_TERMS = ['breasoning', 'algorithm', 'immersion', 'philosophy', 'pedagogy', 'meditation', 'grammar', 'logic', 'spec', 'interpreter', 'object', 'reason'];
const IDEAS = [
  'Try the same idea as a grammar.',
  'What would the empty list give?',
  'Could one pass do it, with an accumulator?',
  'Is there a smaller example that still shows it?',
  'Two predicates alike? Go up a level and make them one.',
  'Which of your notes says why this is worth doing?'
];

export function decide(st, now) {
  const quiet = { act: 'quiet', text: '' };
  if (st.concentrating) return quiet;
  if (now - (st.lastInput ?? 0) < BUSY) return quiet;
  const since = Math.max(st.lastInput ?? 0, st.lastResolved ?? 0);
  if (now - since < PAUSE) return quiet;
  if ((st.lastSpoke ?? 0) >= since) return quiet;          // once per pause
  if (st.problem) return { act: 'fix', text: `Shall we look at this? ${st.problem}` };
  if (!st.lastResolved || st.lastResolved < (st.lastInput ?? 0) - PAUSE) return quiet; // only after you finished something
  const turn = st.turn ?? 0;
  const kinds = st.thoughts?.length ? ['sing', 'thoughts', 'idea'] : ['sing', 'idea'];
  const kind = kinds[turn % kinds.length];
  if (kind === 'sing') {
    const a = GL_TERMS[turn % GL_TERMS.length], b = GL_TERMS[(turn * 5 + 3) % GL_TERMS.length];
    return { act: 'sing', text: `♪ ${a}, ${a}, ${b} and ${a} ♪` };
  }
  if (kind === 'thoughts') return { act: 'thoughts', text: `Your recent thoughts: ${st.thoughts.slice(-3).map((t) => `"${t}"`).join(', ')}.` };
  return { act: 'idea', text: IDEAS[turn % IDEAS.length] };
}
