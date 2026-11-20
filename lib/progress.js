// Where you are in the classroom: sections of steps, the progress bar, a summary of a section, fast
// forward (the rest of a section taken as read, the right answers shown), and where you left off.
//
//   place: { course, step, done: [stepIds], wrong: { stepId: count } }
//   progress(courses, place) -> { done, total, fraction }
//   answer(place, step, right) -> place   (a wrong answer counts; a right one moves on)
//   fastForward(course, place) -> place   summary(course, place, band) -> text

export function start(course) { return { course: course.id, step: 0, done: [], wrong: {} }; }

export function progress(courses, place) {
  const total = courses.reduce((a, c) => a + c.steps.length, 0);
  const done = new Set(place?.done ?? []).size;
  return { done, total, fraction: total ? done / total : 0 };
}

export function answer(course, place, right) {
  const step = course.steps[place.step];
  if (!step) return place;
  if (!right) return { ...place, wrong: { ...place.wrong, [step.id]: (place.wrong[step.id] ?? 0) + 1 } };
  const done = place.done.includes(step.id) ? place.done : [...place.done, step.id];
  return { ...place, done, step: Math.min(place.step + 1, course.steps.length) };
}

export function fastForward(course, place) {
  const done = [...new Set([...place.done, ...course.steps.slice(place.step).map((s) => s.id)])];
  return { ...place, done, step: course.steps.length, skipped: [...new Set([...(place.skipped ?? []), ...course.steps.slice(place.step).map((s) => s.id)])] };
}

export function finished(course, place) { return place.step >= course.steps.length; }

export function summary(course, place, band = 'middle') {
  const ds = course.steps.filter((s) => place.done.includes(s.id));
  const tricky = course.steps.filter((s) => (place.wrong[s.id] ?? 0) > 0);
  const lines = ds.map((s) => `${s.title}: ${band === 'young' && s.young ? s.young : s.say}`);
  const left = course.steps.length - ds.length;
  return [
    `${course.name}: ${ds.length} of ${course.steps.length} steps done.`,
    ...lines,
    tricky.length ? `You took more than one go at: ${tricky.map((s) => s.title).join(', ')}.` : '',
    left ? `${left} to go.` : 'All done.'
  ].filter(Boolean).join('\n');
}
