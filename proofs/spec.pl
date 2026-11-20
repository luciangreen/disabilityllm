% The Prolog spec of Disability LLM's algorithms. proofs/ios.pl runs it on the 200 recorded
% inputs in io/ios.jsonl (made by running the JavaScript) and checks it gives every recorded
% output. Some outputs are programs, grammars, melt-downs and abstractions the app writes: those
% are also run here in Prolog on their examples, which proves them correct on those examples.
%
% How each function is checked:
%   exact (the spec computes the same output): typeOf, join, lemma, predict, skip, remember,
%     decide, answer, band, induce, accepts, meltdown's rule and new chain
%   by running what the app wrote: synthesise (the program gives each example), induce (the DCG
%     makes each string), meltdown (old and new give the same answers), abstract (the calls to
%     the general predicate give the originals' answers)
%   by its properties: digest (each lead is backed by a word of the sentence), abstract when it
%     says no (the clauses differ by more than numbers and operations), analyse (the clauses
%     that don't read, the singletons and the missing base cases are the ones Prolog finds)
:- module(dl_spec, [spec/3]).
:- use_module(library(lists)).
:- use_module(library(apply)).

% ---------- types ----------
type_of(V, T) :- integer(V), !, T = "int".
type_of(V, T) :- float(V), !, T = "float".
type_of(V, T) :- (V == true ; V == false), !, T = "bool".
type_of(V, T) :- is_list(V), !, foldl([X, A0, A]>>(A0 == "mixed" -> A = A0 ; type_of(X, TX), (join(A0, TX, J) -> A = J ; A = "mixed")), V, "any", In), ( In == "mixed" -> T = "list(mixed)" ; string_concat("list(", In, T0), string_concat(T0, ")", T) ).
type_of(V, "atom") :- string(V), !.
type_of(_, "unknown").

inner(T, I) :- string_concat("list(", R, T), string_concat(I, ")", R).
join(A, A, A) :- !.
join("any", B, B) :- !.
join(A, "any", A) :- !.
join(A, B, "number") :- member(A-B, ["int"-"float", "float"-"int", "number"-"int", "number"-"float", "int"-"number", "float"-"number"]), !.
join(A, B, T) :- inner(A, IA), inner(B, IB), join(IA, IB, J), !, string_concat("list(", J, T0), string_concat(T0, ")", T).

% ---------- words ----------
lemma(W, L) :- string_length(W, N), N > 4, string_concat(S, "ies", W), !, string_concat(S, "y", L).
lemma(W, L) :- string_length(W, N), N > 4, string_concat(L, "ing", W), !.
lemma(W, L) :- string_length(W, N), N > 4, string_concat(L, "ed", W), sub_string(W, _, 3, 0, E), sub_string(E, 0, 1, _, C), \+ sub_atom(aeiou, _, _, _, C), !.
lemma(W, L) :- string_length(W, N), N > 3, string_concat(L, "s", W), \+ string_concat(_, "ss", W), !.
lemma(W, W).

% ---------- predicting choices: MIN 3, SHARE 0.8, MAX 500 ----------
rows(M, K, C, Cs) :- findall(Ch, (member(R, M), get_dict(kind, R, K), get_dict(context, R, C), get_dict(choice, R, Ch)), Cs).
predict(M, K, C, null) :- rows(M, K, C, []), !.
predict(M, K, C, _{choice: Best, count: N, share: Sh}) :-
    rows(M, K, C, Cs), length(Cs, N),
    sort(Cs, Ds),
    % the most chosen first; on a tie, the one chosen most recently (keys are negated numbers)
    findall(NC-NL-D, (member(D, Ds), count_of(D, Cs, Cnt), last_index(D, Cs, Last), NC is -Cnt, NL is -Last), Ss),
    msort(Ss, [_-_-Best|_]), count_of(Best, Cs, BN), Sh is BN / N.
count_of(D, Cs, N) :- include(==(D), Cs, L), length(L, N).
last_index(D, Cs, I) :- findall(K, nth0(K, Cs, D), Ks), last(Ks, I).
skip(_, _, _, false, null) :- !.
skip(M, K, C, true, Ch) :- predict(M, K, C, P), ( P \== null, get_dict(count, P, N), N >= 3, get_dict(share, P, S), S >= 0.8 -> get_dict(choice, P, Ch) ; Ch = null ).
remember_len(M, E, L) :- length(M, N0), get_dict(kind, E, K), get_dict(choice, E, Ch), ( (K == "" ; Ch == "" ; Ch == null) -> L = N0 ; L is min(500, N0 + 1) ).

% ---------- the companion: PAUSE 8000, BUSY 4000 ----------
gl_terms(["breasoning", "algorithm", "immersion", "philosophy", "pedagogy", "meditation", "grammar", "logic", "spec", "interpreter", "object", "reason"]).
ideas(["Try the same idea as a grammar.", "What would the empty list give?", "Could one pass do it, with an accumulator?", "Is there a smaller example that still shows it?", "Two predicates alike? Go up a level and make them one.", "Which of your notes says why this is worth doing?"]).
quiet(_{act: "quiet", text: ""}).
decide(St, _, Q) :- get_dict(concentrating, St, true), !, quiet(Q).
decide(St, Now, Q) :- get_dict(lastInput, St, LI), Now - LI < 4000, !, quiet(Q).
decide(St, Now, Out) :-
    get_dict(lastInput, St, LI), get_dict(lastResolved, St, LR), get_dict(lastSpoke, St, LS),
    Since is max(LI, LR),
    (   Now - Since < 8000 -> quiet(Out)
    ;   LS >= Since -> quiet(Out)
    ;   get_dict(problem, St, P), P \== null -> string_concat("Shall we look at this? ", P, T), Out = _{act: "fix", text: T}
    ;   ( LR =:= 0 ; LR < LI - 8000 ) -> quiet(Out)
    ;   get_dict(turn, St, Turn), get_dict(thoughts, St, Ts),
        ( Ts == [] -> Kinds = [sing, idea] ; Kinds = [sing, thoughts, idea] ),
        length(Kinds, NK), I is Turn mod NK, nth0(I, Kinds, Kind),
        say(Kind, Turn, Ts, Out)
    ).
say(sing, Turn, _, _{act: "sing", text: T}) :- gl_terms(G), length(G, N), IA is Turn mod N, IB is (Turn * 5 + 3) mod N, nth0(IA, G, A), nth0(IB, G, B), format(string(T), "♪ ~w, ~w, ~w and ~w ♪", [A, A, B, A]).
say(thoughts, _, Ts, _{act: "thoughts", text: T}) :- length(Ts, N), S is max(0, N - 3), length(P, S), append(P, L, Ts), maplist([X, Y]>>format(string(Y), "\"~w\"", [X]), L, Qs), atomic_list_concat(Qs, ', ', J), format(string(T), "Your recent thoughts: ~w.", [J]).
say(idea, Turn, _, _{act: "idea", text: T}) :- ideas(I), length(I, N), K is Turn mod N, nth0(K, I, T).

% ---------- progress in a course ----------
course_steps("shell", 4). course_steps("jsprolog", 4). course_steps("basic", 4). course_steps("grammars", 3).
course_steps("interpreter", 3). course_steps("newlang", 2). course_steps("mix", 2).
answer(C, At, Right, _{step: S, done: D, wrong: W}) :-
    course_steps(C, N),
    (   At >= N -> S = At, D = At, W = 0
    ;   Right == true -> S is min(At + 1, N), D is At + 1, W = 0
    ;   S = At, D = At, W = 1 ).

% ---------- year bands ----------
band(Y0, B) :- ( Y0 =:= 0 -> Y1 = 7 ; Y1 = Y0 ), Y is max(1, min(14, round(Y1))), ( Y =< 4 -> B = "young" ; Y =< 8 -> B = "middle" ; Y =< 12 -> B = "older" ; B = "uni" ).

% ---------- strings to grammar ----------
common_prefix([S], S) :- !.
common_prefix([S|Ss], P) :- common_prefix(Ss, P0), pre2(S, P0, P).
pre2(A, B, P) :- string_chars(A, As), string_chars(B, Bs), pre_chars(As, Bs, Ps), string_chars(P, Ps).
pre_chars([X|Xs], [X|Ys], [X|Ps]) :- !, pre_chars(Xs, Ys, Ps).
pre_chars(_, _, []).
common_suffix(Ss, S) :- maplist([A, R]>>(string_chars(A, Cs), reverse(Cs, Rs), string_chars(R, Rs)), Ss, Rss), common_prefix(Rss, R), string_chars(R, Cs), reverse(Cs, Ss2), string_chars(S, Ss2).
drop_prefix(P, S, R) :- string_concat(P, R, S).
drop_suffix(F, S, R) :- string_concat(R, F, S).
repeats(_, "", 0) :- !.
repeats(U, S, N) :- string_concat(U, R, S), repeats(U, R, N0), N is N0 + 1.

induce(Ss0, G) :-
    sort(Ss0, Ss1), dedup_keep(Ss0, Ss), ( Ss1 = [_] -> G = one(Ss) ; induce2(Ss, G) ).
dedup_keep([], []).
dedup_keep([X|Xs], [X|Ys]) :- exclude(==(X), Xs, Zs), dedup_keep(Zs, Ys).
induce2(Ss, G) :-
    common_prefix(Ss, Pre), maplist(drop_prefix(Pre), Ss, Rest),
    ( maplist(\=(""), Rest) -> common_suffix(Rest, Suf) ; Suf = "" ),
    maplist(drop_suffix(Suf), Rest, Mids),
    maplist(string_length, Mids, Lens), max_list(Lens, Max),
    (   include(\=(""), Mids, [M1|_]), between(1, Max, N), string_length(M1, L1), L1 >= N, sub_string(M1, 0, N, _, U),
        maplist(repeats(U), Mids, Cs), sort(Cs, [_, _|_])
    ->  min_list(Cs, Min), G = repeat(Pre, U, Suf, Min)
    ;   G = choice(Ss) ).
g_accepts(one(Ws), S) :- memberchk(S, Ws).
g_accepts(choice(Ws), S) :- memberchk(S, Ws).
g_accepts(repeat(P, U, F, Min), S) :- string_concat(P, R, S), string_concat(M, F, R), repeats(U, M, N), N >= Min.

% ---------- fragments (for the melt-down checks) ----------
frag("sort", L, R) :- msort(L, R).
frag("set", L, R) :- sort(L, R).
frag("reverse", L, R) :- reverse(L, R).
frag("first", [X|_], X).
frag("last", L, X) :- last(L, X).
frag("count", L, N) :- length(L, N).
frag("sum", L, S) :- sum_list(L, S).
frag("minimum", L, M) :- L = [_|_], min_list(L, M).
frag("maximum", L, M) :- L = [_|_], max_list(L, M).
frag("squareeach", L, R) :- maplist([X, Y]>>(Y is X * X), L, R).
frag("keep:even", L, R) :- include([X]>>(0 =:= X mod 2), L, R).
frag(K, L, R) :- string_concat("addeach:", NS, K), number_string(N, NS), maplist([X, Y]>>(Y is X + N), L, R).
frag(K, L, R) :- string_concat("timeseach:", NS, K), number_string(N, NS), maplist([X, Y]>>(Y is X * N), L, R).
run_chain([], X, X).
run_chain([S|Ss], X, Y) :- norm_step(S, K), frag(K, X, Z), run_chain(Ss, Z, Y).
norm_step(S, K) :- ( string_concat(K0, ":null", S) -> K = K0 ; K = S ).
melt_rule(["sort", "first"], "sort-first", ["minimum:null"]).
melt_rule(["sort", "last"], "sort-last", ["maximum:null"]).
melt_rule(["reverse", "reverse"], "reverse-twice", []).
melt_rule(["reverse", "first"], "reverse-first", ["last:null"]).
melt_rule(["keep:even", "count"], "keep-count", fused).
melt_rule(["squareeach", "sum"], "square-sum", fused).
melt_rule([A, "sum"], "add-sum", fused) :- string_concat("addeach:", _, A).
melt_rule([A, "sum"], "times-sum", fused) :- string_concat("timeseach:", _, A).
melt_rule(["sort", "sum"], "sort-sum", ["sum:null"]).
melt_rule(["set", "sort"], "sort-sort", ["set:null"]).
melt_rule([A, B], "add-add", [C]) :- string_concat("addeach:", X, A), string_concat("addeach:", Y, B), number_string(NX, X), number_string(NY, Y), N is NX + NY, format(string(C), "addeach:~w", [N]).
melt_rule([A, B], "times-times", [C]) :- string_concat("timeseach:", X, A), string_concat("timeseach:", Y, B), number_string(NX, X), number_string(NY, Y), N is NX * NY, format(string(C), "timeseach:~w", [N]).
test_lists([[], [1], [1,2,3], [3,1,2], [2,-5,4,4], [0,7,-1,8,2]]).

% ---------- running a program the app wrote ----------
with_program(Text, Goal) :-
    tmp_file_stream(text, File, S), write(S, Text), nl(S), close(S),
    setup_call_cleanup(load_files(File, [silent(true)]), once(Goal), (catch(unload_file(File), _, true), catch(delete_file(File), _, true))).

% ---------- lgg (going up a level): the two clauses differ only by numbers and operations ----------
lgg_ok(A, B, _) :- var(A), var(B), !.
lgg_ok(A, B, _) :- atomic(A), atomic(B), !.
lgg_ok(A, B, Ns) :- compound(A), compound(B), compound_name_arity(A, FA, N), compound_name_arity(B, FB, N),
    ( FA == FB ; Ns = FA-FB ; N =:= 2, memberchk(FA, [+, -, *, /, max, min, mod, //, ^]), memberchk(FB, [+, -, *, /, max, min, mod, //, ^]) ), !,
    A =.. [_|As], B =.. [_|Bs], maplist([X, Y]>>lgg_ok(X, Y, Ns), As, Bs).
read_all(Text, Cs) :- catch((open_string(Text, S), read_terms(S, Cs), close(S)), _, fail).
read_terms(S, Cs) :- read_term(S, T, []), ( T == end_of_file -> Cs = [] ; Cs = [T|R], read_terms(S, R) ).
head_name((H :- _), N) :- !, functor(H, N, _).
head_name(H, N) :- functor(H, N, _).
can_go_up(TA, TB) :-
    read_all(TA, CA), read_all(TB, CB), length(CA, N), length(CB, N), N > 0,
    CA = [A1|_], CB = [B1|_], head_name(A1, NA), head_name(B1, NB),
    maplist([X, Y]>>lgg_ok(X, Y, NA-NB), CA, CB).

% ---------- the specs, one per recorded function ----------
spec(typeOf, [V], T) :- type_of(V, T).
spec(join, [A, B], T) :- ( join(A, B, T) -> true ; T = null ).
spec(lemma, [W], L) :- lemma(W, L).
spec(predict, [M, K, C], P) :- predict(M, K, C, P).
spec(skip, [M, K, C, On], Ch) :- skip(M, K, C, On, Ch).
spec(remember, [M, E], L) :- remember_len(M, E, L).
spec(decide, [St, Now], D) :- decide(St, Now, D).
spec(answer, [C, At, R], A) :- answer(C, At, R, A).
spec(band, [Y], B) :- band(Y, B).
spec(progress, [N], _{done: N, total: 22, fraction: F}) :- F is N / 22.
spec(accepts, [Ss, T], R) :- induce(Ss, G), ( g_accepts(G, T) -> R = true ; R = false ).
spec(induce, [Ss], Want) :-
    induce(Ss, G), get_dict(dcg, Want, Dcg),
    % its DCG, run in Prolog, makes each example string
    with_program(Dcg, forall(member(S, Ss), (string_codes(S, Cs), phrase(s, Cs)))),
    (   G = repeat(P, U, F, Min) -> Want = _{kind: "repeat", prefix: P, unit: U, suffix: F, min: Min, dcg: Dcg}
    ;   G = one(_) -> Want = _{kind: "one", prefix: null, unit: null, suffix: null, min: null, dcg: Dcg}
    ;   Want = _{kind: "choice", prefix: null, unit: null, suffix: null, min: null, dcg: Dcg} ).
spec(synthesise, [[_Sentence, Exs], _Method], Want) :-
    get_dict(found, Want, true), get_dict(program, Want, Prog), get_dict(name, Want, Name),
    atom_string(N, Name),
    % the program the app wrote gives every example's output, in Prolog
    with_program(Prog, forall(member([I, O], Exs), (G =.. [N, I, X], call(G), X == O))).
spec(synthesise, _, _{found: false}).
spec(digest, [S], Want) :-
    % each lead is a predicate whose fragment one of the sentence's words (or its plain form) names
    split_string(S, " ", " ", Ws0), maplist([W, L]>>(string_lower(W, L)), Ws0, Ws),
    get_dict(leads, Want, Leads),
    forall(member(L, Leads), lead_backed(L, Ws)),
    Want = _{name: _, numbers: _, dataType: _, leads: Leads}.
spec(meltdown, [[A, B]], Want) :-
    melt_rule([A, B], Rule, To), !,
    get_dict(rule, Want, Rule), get_dict(ok, Want, true),
    test_lists(Ls),
    (   To == fused
    ->  get_dict(prolog, Want, Code), read_all(Code, [Cl]), head_name(Cl, F), atom_string(F, _),
        with_program(Code, forall((member(L, Ls), run_chain([A, B], L, Y)), (G =.. [F, L, Z], call(G), Z =:= Y)))
    ;   get_dict(after, Want, To),
        forall(member(L, Ls), ( run_chain([A, B], L, Y) -> run_chain(To, L, Z), Y == Z ; \+ run_chain(To, L, _) ))
    ).
spec(meltdown, _, _{found: false}).
spec(abstract, [[_, _]], Want) :-
    get_dict(ok, Want, true), !,
    get_dict(originals, Want, [TA, TB]), get_dict(from, Want, [FA, FB]),
    get_dict(general, Want, Gen), get_dict(instances, Want, Inst),
    can_go_up(TA, TB),
    % the calls to the general predicate give the originals' answers
    rename(TA, FA, OA), rename(TB, FB, OB),
    atomic_list_concat([OA, OB, Gen|Inst], '\n', Code),
    atomic_list_concat(['orig_', FA], PA), atomic_list_concat(['orig_', FB], PB), atom_string(A1, FA), atom_string(B1, FB),
    test_lists(Ls),
    with_program(Code, forall(member(L, Ls), (same_answer(PA, A1, L), same_answer(PB, B1, L)))).
spec(abstract, [[_, _]], Want) :-
    % when it says no, the clauses do differ by more than numbers and operations (or not at all)
    get_dict(ok, Want, false), get_dict(originals, Want, [TA, TB]),
    ( \+ can_go_up(TA, TB) -> true ; read_all(TA, CA), read_all(TB, CB), maplist([X, Y]>>(\+ \+ (numbervars(X-Y, 0, _), same_but_names(X, Y))), CA, CB) ).
spec(analyse, [Text], Want) :-
    get_dict(kinds, Want, Kinds),
    (   read_all(Text, Cs)
    ->  get_dict(ok, Want, true),
        % the singletons Prolog finds are the ones the app found
        singletons_in(Text, NS), include(==("singleton"), Kinds, SK), length(SK, NS),
        % a recursive predicate with no base case is found
        ( no_base_case(Cs) -> memberchk("base", Kinds) ; \+ memberchk("base", Kinds) )
    ;   get_dict(ok, Want, false), Kinds == ["read"] ).

same_but_names(X, Y) :- X =.. [_|A], Y =.. [_|B], length(A, N), length(B, N), ( A == B -> true ; maplist([P, Q]>>(P == Q ; compound(P), compound(Q), same_but_names(P, Q)), A, B) ).
same_answer(Orig, New, L) :- ( G1 =.. [Orig, L, X], call(G1) -> G2 =.. [New, L, Y], call(G2), X =@= Y ; G2 =.. [New, L, _], \+ call(G2) ).
rename(Text, From, Out) :- atomic_list_concat(Parts, From, Text), atomic_list_concat(['orig_', From], To), atomic_list_concat(Parts, To, Out).
lead_backed(Lead, Ws) :- sub_string(Lead, B, _, 0, "/2"), sub_string(Lead, 0, B, _, Pred), frag_pred_word(Pred, Words), member(W, Ws), lemma(W, LW), ( memberchk(W, Words) ; memberchk(LW, Words) ; member(X, Words), lemma(X, LX), (LX == W ; LX == LW) ), !.
singletons_in(Text, N) :- open_string(Text, S), count_singletons(S, 0, N), close(S).
count_singletons(S, N0, N) :- read_term(S, T, [singletons(Vs)]), ( T == end_of_file -> N = N0 ; include([Nm=_]>>(\+ sub_atom(Nm, 0, 1, _, '_')), Vs, Vs1), length(Vs1, K), N1 is N0 + K, count_singletons(S, N1, N) ).
no_base_case(Cs) :- member(C, Cs), C = (H :- B), functor(H, F, A), contains_call(B, F, A), \+ (member(C2, Cs), clause_head(C2, H2), functor(H2, F, A), \+ (C2 = (_ :- B2), contains_call(B2, F, A))), !.
clause_head((H :- _), H) :- !.
clause_head(H, H).
contains_call(G, F, A) :- compound(G), ( functor(G, F, A) -> true ; G =.. [_|Args], member(X, Args), contains_call(X, F, A) ).

% each fragment's predicate name and the words that name it (lib/fragments.js)
frag_pred_word("sum", ["sum", "total", "add", "plus", "altogether", "addition"]).
frag_pred_word("product", ["product", "multiply", "times", "multiplied"]).
frag_pred_word("count", ["count", "length", "how", "many", "number", "size"]).
frag_pred_word("maximum", ["maximum", "max", "biggest", "largest", "highest", "most", "greatest"]).
frag_pred_word("minimum", ["minimum", "min", "smallest", "least", "lowest", "fewest"]).
frag_pred_word("first", ["first", "head", "front", "start", "beginning"]).
frag_pred_word("last_one", ["last", "end", "final"]).
frag_pred_word("rest", ["rest", "tail", "drop", "without", "first", "remove"]).
frag_pred_word("rev", ["reverse", "backwards", "back", "flip", "opposite", "order"]).
frag_pred_word("sorted", ["sort", "order", "sorted", "arrange", "ascending", "increasing"]).
frag_pred_word("set", ["unique", "distinct", "different", "duplicates", "repeats", "set", "sort"]).
frag_pred_word(P, ["keep", "only", "filter", "select", "which", "that", "those", "even", "odd", "positive", "negative"]) :- string_concat("keep_", _, P).
frag_pred_word(P, ["remove", "drop", "exclude", "without", "except", "not", "take", "delete"]) :- string_concat("drop_", _, P).
frag_pred_word(P, ["add", "increase", "plus", "each", "every", "more"]) :- string_concat("add_each_", _, P).
frag_pred_word(P, ["multiply", "times", "double", "triple", "each", "every", "scale"]) :- string_concat("times_each_", _, P).
frag_pred_word("square_each", ["square", "squares", "squared", "each", "every"]).
frag_pred_word("running", ["running", "cumulative", "totals", "so", "far", "sum", "add"]).
frag_pred_word("join", ["join", "flatten", "concatenate", "combine", "together", "merge", "lists"]).
frag_pred_word("dedup", ["unique", "duplicates", "repeats", "once", "distinct", "remove"]).
frag_pred_word(P, ["add", "plus", "more", "increase", "up"]) :- string_concat("plus_", _, P).
frag_pred_word(P, ["multiply", "times", "double", "triple", "scale"]) :- string_concat("times_", _, P), \+ string_concat("times_each", _, P).
frag_pred_word("square", ["square", "squared"]).
frag_pred_word("letters", ["letters", "characters", "length", "long", "word"]).
frag_pred_word("backwards", ["backwards", "reverse", "spell", "word", "letters"]).
