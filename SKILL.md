---
name: sketchboard-lessons
description: Build pencil-sketch animated lessons that teach a concept to a student, as interactive HTML (a pencil draws on paper while word-highlighted narration plays, with chapters, pause-and-predict steps, scrub and speed). Use when asked to explain, teach, or make a lesson, explainer, or whiteboard-style animation for a school topic such as geometry, algebra, earth science, biology, chemistry, or physics.
---

# Sketchboard lessons

You write a lesson as **JSON data**; the bundled player (`player/`) turns it into an animated pencil drawing with captions. You never write animation code. Output is a single self-contained `.html` file the student opens in a browser.

Everything below is relative to this skill's folder.

## Files to read

| When | Read |
|---|---|
| Always, before planning | `docs/pedagogy.md`: lesson arc, narration rules, checks for understanding, self-review checklist |
| Always, before writing JSON | `docs/lesson-format.md`: every field and action, the board, timing, colors |
| When the diagram needs arrows, graphs, angles, labels around shapes, cycles | `docs/recipes.md` and `tools/helpers.mjs` |
| For a worked example | `lessons/slope-of-a-line.json` (graphing, pause step, `clear`), `lessons/layers-of-the-earth.json` (nested fills, labels, zoom) and its generator `scripts/make-layers-of-the-earth.mjs`, `lessons/pythagorean-theorem.json` |
| To start a new lesson | `templates/lesson-template.json` |

## Workflow

1. **Pin down the ask.** Topic, the student's level (default: 9th grade), and anything the student already struggles with. If not given, choose sensible defaults and say which.
2. **Plan in words first** (see `docs/pedagogy.md`): one-sentence objective, prerequisites, 2–5 vocabulary terms with a color each, the main misconception, and a concrete example with clean numbers. Then a storyboard: one line per step with title, narration, and what gets drawn. 6–10 steps, at least one `pause: true` step, end with a takeaway.
3. **Lay out the board.** 400×500, y down. Title at `y = 44`, diagram in `y ≈ 70–400`, equations and takeaway in `y ≈ 420–490`. Sketch coordinates for each element before writing actions. Check text widths (`chars × size × 0.62`, mono 0.6, hand 0.45).
4. **Write the lesson** to `lessons/<id>.json`. For computed geometry, write a generator script in `scripts/make-<id>.mjs` using `tools/helpers.mjs` and `formatLesson` from `tools/format.mjs`, then run it.
5. **Narrate it**: `node tools/narrate.mjs lessons/<id>.json` synthesizes each step's `say` to `audio/<id>/step-NN-<hash>.mp3` and stamps real durations onto the steps, so timing is measured instead of estimated. `--voice` picks the voice, `--speed` the pace, `--force` redo. Needs the `tts` CLI.
6. **Validate**: `node tools/validate.mjs lessons/<id>.json`. Fix every error. Read every warning; fix it unless you have a reason. With narration, the pacing check compares drawing time against the real audio.
7. **Look at it**: `node tools/check.mjs lessons/<id>.json` renders the board at the end of every step into `checks/<id>/step-NN.png`. **Open the PNGs and look.** Fix overlaps, clipping, crowding, and anything that doesn't match the narration. Repeat 6–7 until clean. (Needs Playwright + Chromium: `npm install`. If CDN fonts are blocked the screenshots use fallback fonts; layout is still representative. If Playwright can't run at all, say so and rely on the validator.)
8. **Build**: `node tools/build.mjs lessons/<id>.json` writes `dist/<id>.html`, one file with the player, styles, lesson, and narration audio inlined. Several lessons as tabs in one file: `node tools/build.mjs a.json b.json -o dist/unit.html`. Pass `--no-inline-audio` to ship `dist/audio/` next to the HTML instead of inlining.
9. **Deliver** `dist/<id>.html` (attach it, or publish it as an HTML artifact/page). Tell the user the lesson's objective, its length, and where the pause-and-predict moments are. Add the lesson's file name to `lessons/index.json` if it belongs with the samples.

## Rules that matter most

- **Drawing and narration are simultaneous.** Each step's `say` is spoken while its `do` actions draw. Mark appears ⇔ voice names it. Balance them: with narration audio, step length comes from the real recording; without it, ~0.34 s per word vs. ~0.5–1.1 s per drawn action plus pencil travel.
- **One idea per step**, 8–25 words of narration, short plain sentences, no dashes.
- **Color = meaning**, consistent for the whole lesson. Structure in `ink`.
- **Fills need a `color`** and draw no outline; draw the outline separately. Fills sit under strokes.
- **Zoom back out** (`{"op":"cam"}`) before the end.
- **At least one `pause: true` step** with the question written on the board in `hand` font; reveal the answer in the next step.
- **Facts must be right.** Double-check every number and term.
- Unknown ops are skipped with a console warning; the validator catches them first. Don't invent ops: the full list is `line poly rect circle path text fill cam clear hold`.

## Changing the player itself

Only if the user asks for a new capability. The engine is `player/sketchboard.js` (one IIFE, `build()` compiles a lesson into a GSAP timeline; each op is a `case` in the step loop). If you add an op, also add it to `tools/validate.mjs`, `schema/lesson.schema.json`, `docs/lesson-format.md`, and the editor reference in `player/index.html`, then rebuild `dist/` with `npm run build` and re-run the checks on all sample lessons.
