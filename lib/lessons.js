// Teaching yourself: courses where each step asks in Prolog, lets you test the next step, and says
// where the idea comes from. A step is
//   { id, title, say, young?, ask: { kind: 'choice', q, options: [{ text, right, why }] }
//                         | { kind: 'open', q, answer: RegExp, hint },
//     code?: Prolog to load, goal?: a goal that shows it working, source }
// A wrong answer says why it's wrong, and you go on once you have the right one.

export const COURSES = [
  {
    id: 'shell', name: 'Your own shell, in Prolog', steps: [
      { id: 'shell-1', title: 'A command is a term', say: 'A shell reads a line like "greet alice" and runs it. In Prolog, a command is a term: greet(alice).', young: 'A command is a word with things after it. In Prolog we write it as greet(alice).',
        ask: { kind: 'choice', q: 'Which term is the command "add 2 3"?', options: [{ text: 'add(2, 3)', right: true, why: 'The command name is the functor; its words are the arguments.' }, { text: '[add, 2, 3]', why: 'That is a list of the words: it needs one more step (=..) to become the command.' }, { text: 'add + 2 + 3', why: 'That is an arithmetic expression, not a command.' }] },
        source: 'Prolog terms and =.. (univ), as in any Prolog text (ISO standard, 8.5.3).' },
      { id: 'shell-2', title: 'From words to a command', say: 'split_string/4 cuts the line into words; atom_string turns each into an atom; =.. builds the term.',
        ask: { kind: 'choice', q: '?- Words = [add, 2, 3], Command =.. Words.\nWhat is Command?', options: [{ text: 'Command = add(2, 3).', right: true, why: '=.. makes a term from its name and arguments.' }, { text: 'Command = [add, 2, 3].', why: '=.. turns the list into a term, it does not copy the list.' }, { text: 'false.', why: 'It succeeds: add is an atom, so it can be a name.' }] },
        code: 'line_command(Line, C) :- split_string(Line, " ", " ", Ss), maplist([S, A]>>(number_string(A, S) -> true ; atom_string(A, S)), Ss, Ws), C =.. Ws.',
        goal: 'line_command("add 2 3", C), print(C), nl', source: 'SWI-Prolog split_string/4 and number_string/2 (SWI-Prolog manual 5.2).' },
      { id: 'shell-3', title: 'The commands it knows', say: 'Each command is a clause of run/1. A command it doesn\'t know fails, so the shell can say so.',
        ask: { kind: 'choice', q: 'Which clause runs "add 2 3" by printing 5?', options: [{ text: 'run(add(A, B)) :- C is A + B, writeln(C).', right: true, why: 'It matches add(2, 3), works out 5 with is, and prints it.' }, { text: 'run(add(A, B)) :- writeln(A + B).', why: 'writeln prints the term 2+3, not 5: is works it out.' }, { text: 'run(add) :- writeln(5).', why: 'run(add) matches only the bare word add.' }] },
        code: 'run(add(A, B)) :- C is A + B, writeln(C).\nrun(greet(N)) :- format("Hello, ~w!~n", [N]).', goal: 'run(add(2, 3)), run(greet(alice))', source: 'Clause selection by unification (Clocksin and Mellish, Programming in Prolog, ch. 1).' },
      { id: 'shell-4', title: 'The loop', say: 'The shell reads a line, runs it and goes again, until the line is "quit".',
        ask: { kind: 'open', q: 'Finish the clause that stops the loop:\nloop :- read_line_to_string(user_input, L), ( L == "quit" -> ____ ; line_command(L, C), ( run(C) -> true ; writeln(unknown) ), loop ).\nWhat goes in the gap?', answer: /^\s*true\s*\.?\s*$/, hint: 'To stop, the loop just succeeds without calling itself again.' },
        source: 'Tail recursion as a loop (Sterling and Shapiro, The Art of Prolog, 11.2).' }
    ]
  },
  {
    id: 'jsprolog', name: 'A Prolog version of JavaScript', steps: [
      { id: 'js-1', title: 'Expressions as terms', say: 'JavaScript\'s 1 + x * 2 is the Prolog term 1 + x * 2: Prolog already knows which operator binds tighter.',
        ask: { kind: 'choice', q: '?- E = 1 + x * 2, E = A + B.\nWhat is B?', options: [{ text: 'B = x*2.', right: true, why: '* binds tighter than +, so the + is at the top: A = 1, B = x*2.' }, { text: 'B = 2.', why: 'That would be (1 + x) * 2.' }, { text: 'false.', why: 'The top of the term is +, so it matches A + B.' }] },
        source: 'Operator precedence (ISO Prolog 6.3.4; ECMAScript operator precedence).' },
      { id: 'js-2', title: 'Variables live in an environment', say: 'An environment is a list of Name-Value pairs. Looking up x is memberchk(x-V, Env).',
        ask: { kind: 'choice', q: 'Which clause evaluates a variable name?', options: [{ text: 'ev(X, Env, V) :- atom(X), memberchk(X-V, Env).', right: true, why: 'A name is an atom; its value is the pair for it in the environment.' }, { text: 'ev(X, _, X) :- atom(X).', why: 'That gives back the name, not its value.' }, { text: 'ev(X, Env, V) :- V is X.', why: 'is cannot look inside the environment.' }] },
        code: 'ev(N, _, N) :- number(N).\nev(X, Env, V) :- atom(X), memberchk(X-V, Env).\nev(A + B, E, V) :- ev(A, E, VA), ev(B, E, VB), V is VA + VB.\nev(A * B, E, V) :- ev(A, E, VA), ev(B, E, VB), V is VA * VB.',
        goal: 'ev(1 + x * 2, [x-5], V), print(V), nl', source: 'Environment-passing interpreters (Abelson and Sussman, SICP, 4.1).' },
      { id: 'js-3', title: 'Assignment makes a new environment', say: 'x = 3 doesn\'t change anything in Prolog: it makes a new environment with x-3 in front.',
        ask: { kind: 'choice', q: 'Which clause runs set(x, 3) on Env0 to give Env?', options: [{ text: 'st(set(X, E), Env0, [X-V|Env0]) :- ev(E, Env0, V).', right: true, why: 'memberchk finds the newest x first, so the new pair hides the old one.' }, { text: 'st(set(X, E), Env, Env) :- ev(E, Env, V), X = V.', why: 'X = V tries to make the atom x equal 3, which fails.' }, { text: 'st(set(X, V), Env, Env).', why: 'That forgets the new value.' }] },
        source: 'Persistent data structures (Okasaki, Purely Functional Data Structures, ch. 2).' },
      { id: 'js-4', title: 'while is recursion', say: 'while (c) { s } runs s, then the same while again, while c is true.',
        ask: { kind: 'open', q: 'st(while(C, S), E0, E) :- ( ev(C, E0, V), V =\\= 0 -> st(S, E0, E1), ____ ; E = E0 ).\nWhat goes in the gap?', answer: /^\s*st\(\s*while\(\s*C\s*,\s*S\s*\)\s*,\s*E1\s*,\s*E\s*\)\s*\.?\s*$/, hint: 'After the body, run the same while from the new environment E1.' },
        source: 'Operational semantics of while (Winskel, The Formal Semantics of Programming Languages, 2.2).' }
    ]
  },
  {
    id: 'basic', name: 'Teach yourself BASIC (in Prolog)', steps: [
      { id: 'basic-1', title: 'Lines are facts', say: '10 PRINT "HI" becomes the fact line(10, print("HI")).',
        ask: { kind: 'choice', q: 'Which facts are 10 PRINT "HI" and 20 GOTO 10?', options: [{ text: 'line(10, print("HI")). line(20, goto(10)).', right: true, why: 'Each line number with its statement.' }, { text: 'print(10, "HI"). goto(20, 10).', why: 'Then you couldn\'t find the line after 10 without knowing its statement.' }, { text: 'line([10, print, "HI"]).', why: 'A list loses which part is the number and which the statement.' }] },
        source: 'Dartmouth BASIC (Kemeny and Kurtz, 1964): numbered lines run in order.' },
      { id: 'basic-2', title: 'The next line', say: 'After line N comes the smallest line number bigger than N.',
        ask: { kind: 'choice', q: 'Which clause finds the line after N?', options: [{ text: 'next(N, M) :- findall(L, (line(L, _), L > N), Ls), min_list(Ls, M).', right: true, why: 'The smallest of the bigger line numbers.' }, { text: 'next(N, M) :- M is N + 10.', why: 'Lines don\'t have to go up by 10.' }, { text: 'next(N, M) :- line(M, _), M > N.', why: 'That finds any bigger line, in the order they were written.' }] },
        code: 'line(10, print("HI")).\nline(20, print("THERE")).\nline(30, end).\nnext(N, M) :- findall(L, (line(L, _), L > N), Ls), min_list(Ls, M).\nrun(N) :- line(N, S), step(S, N).\nstep(print(T), N) :- writeln(T), ( next(N, M) -> run(M) ; true ).\nstep(goto(M), _) :- run(M).\nstep(end, _).',
        goal: 'run(10)', source: 'A program counter (Patterson and Hennessy, Computer Organization and Design, 2.7).' },
      { id: 'basic-3', title: 'GOTO jumps', say: 'GOTO M runs line M next, instead of the next line.',
        ask: { kind: 'choice', q: 'With line(10, print("A")). line(20, goto(10)). what does run(10) do?', options: [{ text: 'It prints A forever.', right: true, why: 'Line 20 jumps back to 10 every time: a loop with no way out.' }, { text: 'It prints A once.', why: 'GOTO 10 runs line 10 again.' }, { text: 'It fails.', why: 'Both lines are there, so each step succeeds.' }] },
        source: 'Unconditional jumps (Dijkstra, Go To Statement Considered Harmful, 1968).' },
      { id: 'basic-4', title: 'IF and variables', say: 'IF X > 3 THEN 50 jumps only when the test holds. Variables are kept in a list of Name-Value pairs.',
        ask: { kind: 'open', q: 'step(if(T, M), N, E) :- ( holds(T, E) -> run(M, E) ; ____ ).\nWhat goes in the gap (going on to the next line)?', answer: /^\s*next\(\s*N\s*,\s*M2?\s*\)\s*,\s*run\(\s*M2?\s*,\s*E\s*\)\s*\.?\s*$/, hint: 'Find the next line after N, then run it with the same variables.' },
        source: 'Conditional jumps in BASIC (Kemeny and Kurtz, BASIC manual, 1964).' }
    ]
  },
  {
    id: 'grammars', name: 'Prolog grammars', steps: [
      { id: 'dcg-1', title: 'A grammar rule', say: 'digits --> digit, digits. says: digits are a digit then more digits.',
        ask: { kind: 'choice', q: 'Which rules make one or more of the letter a?', options: [{ text: 'as --> "a". as --> "a", as.', right: true, why: 'One a, or an a then more.' }, { text: 'as --> as, "a".', why: 'This calls itself first and never ends (left recursion).' }, { text: 'as --> [].', why: 'That makes only the empty string.' }] },
        code: 'as --> "a".\nas --> "a", as.', goal: 'string_codes("aaa", Cs), ( phrase(as, Cs) -> writeln(yes) ; writeln(no) )', source: 'Definite clause grammars (Pereira and Warren, 1980).' },
      { id: 'dcg-2', title: 'Grammars that build a tree', say: 'An argument in each rule hands back what was read: the parse tree (an AST).',
        ask: { kind: 'choice', q: 'Which rule reads "1+2" as plus(1, 2)?', options: [{ text: 'sum(plus(A, B)) --> num(A), "+", num(B).', right: true, why: 'Each part fills its argument, and the rule builds plus(A, B).' }, { text: 'sum --> num, "+", num.', why: 'It checks "1+2" but builds nothing.' }, { text: 'sum(A + B) --> "+".', why: 'It reads only a plus sign.' }] },
        code: 'num(N) --> [C], { code_type(C, digit(N)) }.\nsum(plus(A, B)) --> num(A), "+", num(B).', goal: 'string_codes("1+2", Cs), phrase(sum(T), Cs), print(T), nl', source: 'Parsing to abstract syntax trees (Aho, Lam, Sethi and Ullman, Compilers, 2.5).' },
      { id: 'dcg-3', title: 'Strings to grammar', say: 'From examples like "ab", "abab", "ababab", the grammar is: "ab" one or more times. The app finds it for you on the Going up step.',
        ask: { kind: 'choice', q: 'Which grammar makes "ab", "abab" and "ababab"?', options: [{ text: 's --> "ab". s --> "ab", s.', right: true, why: 'Each string is "ab" repeated.' }, { text: 's --> "a", "b", "a".', why: 'That makes only "aba".' }, { text: 's --> "a", s, "b".', why: 'That makes a...b with the as first, like "aabb".' }] },
        source: 'Grammatical inference (de la Higuera, Grammatical Inference, ch. 1).' }
    ]
  },
  {
    id: 'interpreter', name: 'Writing an interpreter', steps: [
      { id: 'int-1', title: 'Evaluate a tree', say: 'An interpreter for plus(1, times(2, 3)) evaluates the inside first.',
        ask: { kind: 'choice', q: '?- ev(plus(1, times(2, 3)), V).\nWhat is V?', options: [{ text: 'V = 7.', right: true, why: 'times(2, 3) is 6, then plus(1, 6) is 7.' }, { text: 'V = 9.', why: 'That would be times(plus(1, 2), 3).' }, { text: 'V = plus(1, 6).', why: 'The interpreter works out plus too.' }] },
        code: 'ev(N, N) :- number(N).\nev(plus(A, B), V) :- ev(A, VA), ev(B, VB), V is VA + VB.\nev(times(A, B), V) :- ev(A, VA), ev(B, VB), V is VA * VB.', goal: 'ev(plus(1, times(2, 3)), V), print(V), nl', source: 'Meta-circular and tree-walking interpreters (SICP, 4.1).' },
      { id: 'int-2', title: 'Types in the interpreter', say: 'Before running, a type checker says each part\'s type: numbers are int, and plus needs two ints.',
        ask: { kind: 'choice', q: 'Which clause types plus?', options: [{ text: 'ty(plus(A, B), int) :- ty(A, int), ty(B, int).', right: true, why: 'Both sides must be int, and then the sum is int.' }, { text: 'ty(plus(_, _), int).', why: 'That says plus(hello, 1) is an int too.' }, { text: 'ty(plus(A, B), T) :- ty(A, T).', why: 'B is never checked.' }] },
        source: 'Type checking (Pierce, Types and Programming Languages, ch. 8).' },
      { id: 'int-3', title: 'A faster interpreter', say: 'Compiling the tree to Prolog once, then running that, is faster than walking the tree each time. Optimising with MNNs does the same for whole programs.',
        ask: { kind: 'choice', q: 'Which turns plus(1, x) into a goal you can call many times?', options: [{ text: 'comp(plus(A, B), X, V, (comp_g(A, X, VA), comp_g(B, X, VB), V is VA + VB)).', right: true, why: 'It makes the goal once; calling the goal skips looking at the tree.' }, { text: 'comp(T, V) :- ev(T, V).', why: 'That still walks the tree every call.' }, { text: 'comp(T, T).', why: 'That gives back the tree, not a goal.' }] },
        source: 'Partial evaluation (Jones, Gomard and Sestoft, Partial Evaluation and Automatic Program Generation, ch. 1).' }
    ]
  },
  {
    id: 'newlang', name: 'A new language: spec to algorithm', steps: [
      { id: 'new-1', title: 'A sentence is a spec', say: 'In this language you write a sentence and examples, and the program is found. Try it in the builder: "count the even numbers".',
        ask: { kind: 'choice', q: 'With [1,2,3,4] -> 2, which predicate goes first for "count the even numbers"?', options: [{ text: 'keep_even/2', right: true, why: 'Keep the even ones, then count them.' }, { text: 'count/2', why: 'Counting first gives 4, a number: there\'s nothing left to keep.' }, { text: 'rev/2', why: 'Reversing doesn\'t change how many are even.' }] },
        source: 'Programming by example (Gulwani, Polozov and Singh, Program Synthesis, 2017).' },
      { id: 'new-2', title: 'Examples that tell ways apart', say: 'When two programs fit your examples, a new example where they differ shows which you meant.',
        ask: { kind: 'choice', q: 'maximum/2 and maximum(keep_even(...)) both give 8 for [1,8,3]. Which input tells them apart?', options: [{ text: '[1,8,9]', right: true, why: 'maximum gives 9, the even version gives 8.' }, { text: '[2,8]', why: 'Both give 8.' }, { text: '[8]', why: 'Both give 8.' }] },
        source: 'Active learning of programs (Angluin, Learning regular sets from queries, 1987).' }
    ]
  },
  {
    id: 'mix', name: 'Mixing thoughts to invent', steps: [
      { id: 'mix-1', title: 'A thought in the wrong category', say: 'Put an idea where it doesn\'t seem to belong: a list as music, a sort as a dance. Then apply the category\'s method.',
        ask: { kind: 'open', q: 'Write one of your ideas, and a category that seems wrong for it (for example: "breasonings as a state machine").', answer: /\S+\s+\S+/, hint: 'Any idea and any category: two words or more.' },
        source: 'Bisociation (Koestler, The Act of Creation, 1964).' },
      { id: 'mix-2', title: 'Apply the method', say: 'Press the yellow button: the app makes germs from your thoughts in each category, each with a Prolog skeleton to start from.',
        ask: { kind: 'choice', q: 'A germ "breasonings as a state machine" starts from which skeleton?', options: [{ text: 'move(start, go, middle). run(S, [], S). run(S0, [M|Ms], S) :- move(S0, M, S1), run(S1, Ms, S).', right: true, why: 'States, moves between them, and a run through the moves.' }, { text: 'sum(L, S) :- sum_list(L, S).', why: 'That adds numbers: no states.' }, { text: 's --> "ab".', why: 'That is a grammar for one string.' }] },
        source: 'State machines (Hopcroft, Motwani and Ullman, Introduction to Automata Theory, ch. 2).' }
    ]
  }
];

export const courseById = (id) => COURSES.find((c) => c.id === id);
export const allSteps = () => COURSES.flatMap((c) => c.steps.map((s) => ({ ...s, course: c.id })));

// marking an answer: { right, why } (why says what to think about when it's wrong)
export function mark(step, answer) {
  const a = step.ask;
  if (a.kind === 'choice') {
    const o = a.options[Number(answer)];
    if (!o) return { right: false, why: 'Choose one of the answers.' };
    return { right: !!o.right, why: o.why };
  }
  const ok = a.answer.test(String(answer ?? ''));
  return { right: ok, why: ok ? 'Yes.' : a.hint };
}
