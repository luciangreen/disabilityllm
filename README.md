# Disability LLM

A LucianOS app that helps you discover and write algorithms in Prolog. It is a "disabled LLM": it works the way a language model helps, but everything is done by algorithms you can read and check. There is no language model in it, and Claude is not used.

It has two panes, each labelled, and each folds away to its label:

- **Classroom (learning):** it asks you, in Prolog, how to build your algorithm, or teaches you a course.
- **Applaud (working):** an editor for your Prolog, with an assistant that helps you deliver your algorithm.

The two progress bars along the bottom show this section and your progress overall. **Summary**, **Fast forward** and **Start again** work on the section you are in.

A talking character asks the questions aloud, and you can answer by tapping or by speaking. It is the LucianOS character: your photo with its eyes and mouth placed by you, and a voice you choose. A companion (a tiger cub, or a child in a star costume; tap it to change) dances in the corner. It stays quiet while you concentrate. After a pause that follows something you finished, it sings Grammar Logic key terms, lists your recent thoughts, or suggests an idea. If something is left to fix, it helps with that first.

## Install

It runs inside LucianOS. Open the **App Store** on the LucianOS desktop and press **Install** next to Disability LLM, or clone it into LucianOS's apps folder:

```sh
cd lucianos/apps
git clone https://github.com/luciangreen/disabilityllm
```

In LucianOS on the web (lucianos-web), put the folder next to lucianos-web.

## The Classroom

### From a sentence

You build an algorithm from a sentence by approving each step by hand:

1. **Your sentence.** For example, "count the even numbers".
2. **Leads.** Each word comes back with a small change into a Prolog predicate, for example `?- keep_even(In, Out).` for "even". You approve the ones you mean. Each lead names a real fragment, so every lead you approve can be used.
3. **Examples.** You invent the data as queries: `?- count_even([1,2,3,4], Out). Out = 2.` It suggests inputs of the right type, and asks about the empty list. It shows the types it reads from your data, such as `count_even(+list(int), -int)`.
4. **The algorithm.** It searches chains of fragments (nested predicate calls) for ones that give all your examples.
   - If two chains both fit your examples but differ elsewhere, it asks about the case that tells them apart: `?- biggest_even([1,8,3,4,9], Out).` Is Out 8 or 9?
   - Then you choose the right clause from a few, some of which don't fit. A wrong choice shows what it would give instead, and you carry on once you have chosen right.
5. **How it is written.** You choose a methodology: SWI-Prolog's own predicates, recursion, foldl, or the simplest recursion.
6. **Proof.** You get the program, its explanation at your year level, and each example checked. It is proved by running it in Prolog: `forall` over your examples. **Open in Applaud** takes it to the working pane.
7. **Melt down.** New discoveries as optimisations. Each says its law and is checked on your data and 40 more inputs. For example:
   - sort, then take the first, is the minimum: one pass instead of sorting;
   - count the ones you keep, while going through the list once;
   - add each square as you go;
   - reverse with an accumulator, instead of appending at the end.

### Teach yourself

Seven courses:
- your own shell, in Prolog;
- a Prolog version of JavaScript;
- teach yourself BASIC;
- Prolog grammars;
- writing an interpreter, with types in it;
- a new language (spec to algorithm);
- mixing thoughts to invent something.

Each step asks in Prolog, lets you **test the next step in Prolog**, and names its source. A wrong answer says why it's wrong.

### Go up a level

- **Higher-order predicates:** two predicates that work the same way become one. For example, `sum` and `product` become `fold(Id, Op, ...)`, and each original becomes a call to it. This uses anti-unification (the least general generalisation). The calls are proved, in Prolog, to give the originals' answers.
- **Strings to grammar:** example strings become a DCG that makes them, shown as a state machine too, and checked with `phrase/2`.

### Ideas (the yellow Disabled button)

The yellow **Disabled** button grows starting germs for new algorithms from your thoughts. Each thought is put into a category it may not seem to belong in: sound, image, logic, data structures, grammar, interpreter, state machine, optimisation or philosophy. The germs are shown as a mind map. Each germ:
- says which of your thoughts it came from;
- comes with a sentence to build from and a Prolog skeleton to open in Applaud.

You can hear your thought as notes.

### My thoughts

Your handwritten thought snippets. The germs and the companion use them.

## Applaud: the working pane

Applaud works on your Prolog the way that helps most when writing an algorithm, all as algorithms (`lib/think.js`):

1. **Say what it is for.** Write a signature such as `total(+list(int), -int)`. **Skeleton** writes the base case and the recursive case for its types.
2. **Base case first, then the recursive case** on something smaller. It notices a missing base case, and a call to itself on the same arguments.
3. **Check each clause.** It catches:
   - calls to predicates not defined;
   - variables used once (singletons);
   - arithmetic that needs a value not made yet.
4. **See the known pattern.** For example, "this is the sum pattern with * where sum has +: a fold", with its one-line form.
5. **Explain it back** at your year level, and give **the one next step**.

**Run examples** runs your queries (`?- total([1,2,3], S). S = 6.`) in Prolog and compares each answer with yours. **Open** and **Save** use your LucianOS files.

## Choices it predicts

With **Predict my choices** on, a question you have answered the same way at least 3 times, at least 80% of the time, is skipped and answered that way. Each skip is listed, and **Ask me again** brings the questions back.

## Where things are kept

Your place, settings and choices are kept in the suite's state. When LucianOS has a database, your thoughts and choice history are kept there too:
- SQLite, built into Node, by default;
- MySQL, when you set it up (see LucianOS's README).

So you can leave and come back where you were, or start again.

## Year levels

**Explain at** sets the level for explanations, from Year 1 to postgraduate. Younger levels use shorter sentences and say less.

## Proofs and the 200 inputs and outputs

- `npm run ios` runs the app's real functions on 200 inputs and writes `io/ios.txt` and `io/ios.jsonl`. `npm test` checks they still come out the same, along with the unit tests.
- `npm run proofs` (SWI-Prolog) runs two checks:
  - `proofs/theorems.pl` proves 8 theorems by checking every case. For example: the companion never speaks while you concentrate, a question is never skipped on fewer than 3 answers, and a grammar makes all its examples.
  - `proofs/ios.pl` checks all 200 recorded outputs against the Prolog spec in `proofs/spec.pl`:
    - Some outputs are computed exactly by the spec, and compared.
    - The programs, grammars, melt-downs and abstractions the app writes are run in Prolog on their examples.
    - The leads and the editor's checks are checked against Prolog's own reading of the clauses.

## Files

| File | What it does |
| --- | --- |
| `app.js` | The two panes, the progress bars, the companion, the character, and what is kept |
| `classroom.js` | The Classroom: from a sentence, courses, going up a level, ideas, thoughts |
| `applaud.js` | Applaud, the working pane |
| `lib/fragments.js` | The algorithm fragments: each a Prolog predicate (written several ways) and the same in JavaScript |
| `lib/parse.js` | A sentence's words, and the leads they give |
| `lib/synth.js` | Spec to algorithm: the search, the case that decides between ways, the program |
| `lib/meltdown.js` | Melting down: optimisations with their laws |
| `lib/abstract.js`, `lib/term.js` | Going up a level (anti-unification), and a small Prolog reader and writer |
| `lib/grammar.js` | Strings to grammar, and the state machine |
| `lib/germs.js` | The yellow button's germs and mind map |
| `lib/think.js` | Applaud's assistant |
| `lib/lessons.js`, `lib/progress.js` | The courses, and where you are in them |
| `lib/explain.js` | Explanations at your year level |
| `lib/predict.js` | Predicting your choices |
| `lib/companion.js` | When the companion speaks, and what it says |
| `proofs/` | The Prolog spec, the theorems and the 200 i/o check |
