% Theorems about Disability LLM's spec (proofs/spec.pl), proved by checking every case in a finite
% domain that covers each branch. Run from the repo folder:
%   swipl -g main -t halt proofs/theorems.pl
:- use_module('spec.pl').

theorem(companion_quiet_while_concentrating,
    'The companion says nothing while you are concentrating, or typed in the last 4 seconds.',
    forall(state(St, Now),
        ( ( get_dict(concentrating, St, true) ; get_dict(lastInput, St, LI), Now - LI < 4000 )
        -> dl_spec:spec(decide, [St, Now], D), get_dict(act, D, "quiet") ; true ))).
theorem(companion_once_per_pause,
    'Once the companion has spoken in a pause, it says nothing more until you do something.',
    forall(state(St, Now),
        ( get_dict(lastSpoke, St, LS), get_dict(lastInput, St, LI), get_dict(lastResolved, St, LR), LS >= max(LI, LR)
        -> dl_spec:spec(decide, [St, Now], D), get_dict(act, D, "quiet") ; true ))).
theorem(companion_fixes_first,
    'After a pause, if something is left to fix, the companion helps with that before anything else.',
    forall(state(St, Now),
        ( get_dict(problem, St, P), P \== null, \+ get_dict(concentrating, St, true),
          get_dict(lastInput, St, LI), get_dict(lastResolved, St, LR), get_dict(lastSpoke, St, LS),
          Since is max(LI, LR), Now - Since >= 8000, LS < Since
        -> dl_spec:spec(decide, [St, Now], D), get_dict(act, D, "fix") ; true ))).
theorem(skip_needs_three,
    'A question is never skipped on fewer than three past answers of its kind, nor when skipping is off.',
    forall(memory(M), ( dl_spec:spec(skip, [M, "lead", "x", false], C1), C1 == null,
        ( length(M, N), N < 3 -> dl_spec:spec(skip, [M, "lead", "x", true], C2), C2 == null ; true ) ))).
theorem(skip_follows_the_majority,
    'When a question is skipped, the answer taken is the one you gave at least 80% of the time.',
    forall(memory(M), ( dl_spec:spec(skip, [M, "lead", "x", true], C), C \== null
        -> length(M, N), include([R]>>get_dict(choice, R, C), M, Same), length(Same, K), K / N >= 0.8 ; true ))).
theorem(progress_moves_on_only_when_right,
    'In a course, a right answer moves on one step (to at most the end) and a wrong one stays.',
    forall(( member(C-N, ["shell"-4, "jsprolog"-4, "basic"-4, "grammars"-3, "interpreter"-3, "newlang"-2, "mix"-2]), between(0, N, At), member(R, [true, false]) ),
        ( dl_spec:spec(answer, [C, At, R], A), get_dict(step, A, S),
          ( At >= N -> S =:= At ; R == true -> S =:= At + 1 ; S =:= At ), S =< N ))).
theorem(bands_go_up_with_the_year,
    'The explanation band never goes down as the year goes up.',
    forall(( between(1, 13, Y), Y1 is Y + 1 ), ( dl_spec:spec(band, [Y], B0), dl_spec:spec(band, [Y1], B1), rank(B0, R0), rank(B1, R1), R0 =< R1 ))).
theorem(grammar_makes_its_examples,
    'The grammar found from example strings makes every one of them.',
    forall(examples(Ss), ( dl_spec:induce(Ss, G), forall(member(S, Ss), dl_spec:g_accepts(G, S)) ))).

rank("young", 1). rank("middle", 2). rank("older", 3). rank("uni", 4).

% companion states: each field over values either side of the 4 s and 8 s lines
state(_{lastInput: LI, lastResolved: LR, lastSpoke: LS, problem: P, thoughts: Ts, turn: T, concentrating: C}, Now) :-
    member(Now, [20000]), member(LI, [0, 11000, 13000, 17000, 19000]), member(LR, [0, 5000, 11000, 15000]),
    member(LS, [0, 11000, 16000]), member(P, [null, "an example fails"]), member(Ts, [[], ["tea"]]),
    member(T, [0, 1]), member(C, [false, true]).
% memories of up to four answers to one question, from two choices
memory(M) :- between(0, 4, N), length(Cs, N), maplist([X]>>member(X, ["yes", "no"]), Cs), maplist([X, _{kind: "lead", context: "x", choice: X}]>>true, Cs, M).
% sets of two or three strings over a and b, up to four letters long
examples(Ss) :- findall(S, (between(1, 4, L), length(Cs, L), maplist([X]>>member(X, [a, b]), Cs), atomic_list_concat(Cs, A), atom_string(A, S)), All),
    member(N, [2, 3]), length(Ss, N), subset_of(Ss, All).
subset_of([], _).
subset_of([X|Xs], [X|Ys]) :- subset_of(Xs, Ys).
subset_of(Xs, [_|Ys]) :- Xs = [_|_], subset_of(Xs, Ys).

main :-
    findall(Id, theorem(Id, _, _), Ids), length(Ids, N),
    foldl([Id, B0, B]>>( theorem(Id, Says, Goal),
        ( catch(Goal, E, (print_message(error, E), fail)) -> format("proved: ~w~n", [Says]), B = B0 ; format("NOT PROVED: ~w~n", [Says]), B is B0 + 1 ) ), Ids, 0, Bad),
    ( Bad =:= 0 -> format("All ~w theorems proved.~n", [N]) ; format("~w of ~w theorems not proved.~n", [Bad, N]), halt(1) ).
