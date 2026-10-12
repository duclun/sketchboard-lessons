# Teaching with Sketchboard

How to turn a concept into a lesson a student actually learns from. Written for agents building lessons, aimed at roughly 9th grade (age 14–15), but the rules hold for any level.

## What this medium is good at

A pencil drawing while a voice explains is the oldest good teaching format there is: the student watches an idea get *built*, piece by piece, instead of being shown a finished diagram. Lean on that.

- **Build, don't reveal.** Every mark should appear at the moment the narration names it. If the caption says "the hypotenuse", the `c` label is being written right then.
- **One idea per step.** A step is a chapter the student can jump back to. If a step's `say` has an "and also", split it.
- **The drawing is the explanation; the caption is the voice.** Don't write the caption on the board. The board holds labels, numbers and the final rule.

## The lesson arc

Most good lessons follow this shape. 6 to 10 steps, 45 to 120 seconds.

| # | Beat | What it does | Example (slope) |
|---|---|---|---|
| 1 | **Hook / setting** | Title, plus one concrete thing on the board. Connect to something the student already knows. | Draw the grid and axes. |
| 2–4 | **Build** | Introduce the parts one at a time, each with its name and its color. | Plot A and B; draw the line; draw the run; draw the rise. |
| 5 | **Name the idea** | State the rule in plain words, then as notation. | `SLOPE = RISE / RUN` |
| 6 | **Predict** (`pause: true`) | Ask the student to do the next move themselves before you show it. | "What is three divided by six? Pause and work it out." |
| 7 | **Reveal** | Show the answer and *why*, in one sentence. | "Three over six is one half: up one for every two right." |
| 8 | **Stretch / contrast** | A second case that shows what changes (often after `clear`). | Slope 2 vs slope ½ on one grid. |
| 9 | **Takeaway** | The rule, big, at the bottom of the board. Short recap sentence. | `slope = rise ÷ run` |

Not every lesson needs every beat, but every lesson needs **at least one `pause` step** and **a takeaway**.

## Before writing JSON: plan in words

Write this first (it becomes `meta`):

1. **Objective**: one sentence of what the student can *do* afterwards. "Find the slope from two points", not "understand slope".
2. **Prerequisites**: what you assume they know. If a prerequisite is shaky, add one step that recalls it.
3. **Vocabulary**: the 2–5 terms the lesson introduces. Each one gets its own moment and its own color.
4. **Misconception**: the most common wrong idea about this topic. Design one step that rules it out. (Slope: students count run vertically, so the run is drawn *first* and labeled "sideways".)
5. **Concrete example**: pick numbers that work out cleanly (3-4-5 triangles, rise 3 run 6). Concrete before abstract: show the example, then the general rule.

Then storyboard: one line per step with its title, the sentence, and what gets drawn. Only then lay out coordinates.

## Narration (`say`) rules

- **8 to 25 words per step.** One or two short sentences. The validator warns above 32.
- **Plain words, short sentences**, grade 6–8 reading level even for 9th-grade content. Define a term the first time you use it.
- **Say what is being drawn, as it is drawn.** "Now build a square on each side" while three squares appear.
- **Spell numbers the way you'd say them** when the board shows the numeral ("three squared is nine" while `3 × 3 = 9` is written). Hearing and seeing both channels reinforces.
- **No dashes or parentheses** in `say`. Captions highlight one word at a time, and those break the rhythm. Use periods.
- **Address the student**: "you", "let's", "try".
- **Questions in `pause` steps end with an instruction**: "Pause and work it out before you continue."

## Visual rules

- **Color = meaning.** Assign each quantity a color on first appearance and never reuse that color for something else. Structure (axes, outlines) stays `ink`.
- **Label next to the thing**, with a short leader `line` (`lw: 1.4`) when the thing is small or crowded. Labels for a column of parts line up on one `x` with `anchor: "start"` (see the Earth sample).
- **Big takeaway at the bottom.** The final rule should be the largest text on the board after the title (size 22–28).
- **Leave whitespace.** If a step's drawing would collide with earlier marks, `clear` and redraw a simplified version rather than squeeze.
- **Zoom with purpose.** `cam` in when the narration is about a small detail, `hold` a beat, `cam` back out.
- **Hand font speaks to the student** (questions, "c = ?", answers). Display font states facts. Mono shows working.

## Checks for understanding

The `pause: true` step is the most important pedagogical tool in the player. Ideas for what to put there:

- **Predict the next number**: "Nine plus sixteen is what? Pause." Then reveal.
- **Name the part**: zoom on an unlabeled part, ask which one it is, then label it.
- **Which one?**: draw two cases, ask which is steeper / hotter / larger.
- **Spot the mistake**: draw a common wrong version (the misconception), ask what is wrong.
- **Recall at the end**: "Which layer is liquid?" before the recap says it.

Put the question on the board in `hand` font, so it's visible while paused. Reveal the answer in the *next* step, in `green`.

## Length and splitting

- One lesson = one objective. If you need two objectives, write two lessons and bundle them: `node tools/build.mjs a.json b.json -o dist/unit.html` gives one page with two tabs.
- Over ~12 steps or ~3 minutes, split.
- Order lessons in a unit from concrete to abstract, each one's takeaway being the next one's prerequisite.

## Accuracy

- Check every number, unit and fact you put on the board. A sketch looks informal; the content must not be. State rounded values as rounded ("about 5,200°C").
- Prefer the textbook term the student will be tested on, then a plain-English gloss: "the hypotenuse, the longest side".
- Diagrams don't have to be to scale, but don't make them misleading. If it's not to scale and that matters (Earth's crust is far thinner than drawn), say so in one sentence.

## Self-review checklist

Before delivering, look at the PNGs from `tools/check.mjs` and confirm:

- [ ] Objective in `meta` and the lesson actually achieves it.
- [ ] Every step has one idea, a title, and narration that matches what is drawn.
- [ ] At least one `pause` step, and the answer comes right after it.
- [ ] Each color means one thing throughout.
- [ ] No text overlaps another mark; nothing runs off the board; nothing below size 9.
- [ ] Camera ends at full view.
- [ ] Final takeaway is on the board, large, at the end.
- [ ] Facts and arithmetic double-checked.
