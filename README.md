# Sketchboard Lessons

Pencil-sketch animated lessons, written as JSON. A pencil draws on paper while the narration appears as a caption, highlighted word by word. The student can play, pause, scrub, change speed, jump between chapters, and stop at "your turn" moments to predict before the answer is shown.

Built for high-school-freshman topics (geometry, algebra, earth science, biology...), and packaged as an **agent skill**, so an AI agent can turn "teach my kid slope" into a finished lesson.

- **Output:** one self-contained HTML file per lesson (SVG + [GSAP](https://gsap.com) core from a CDN). No build step, no framework, no video encoding.
- **Input:** a lesson JSON file: steps, each with a title, a narration line, and a list of drawing actions.

## Try it

Open [`dist/sketchboard.html`](dist/sketchboard.html) in a browser. It has the three sample lessons as tabs:

| Lesson | Shows off |
|---|---|
| Pythagorean theorem | building a diagram piece by piece, color-coded quantities, a predict pause |
| Layers of the Earth | nested scribble fills, labels with leader lines, camera zoom, a check-yourself pause |
| Slope of a line | coordinate grid, rise and run, a predict pause, `clear` to a second scene |

Open the "Lesson as data" panel under the player to edit a lesson's JSON and re-run it live.

## Make a lesson

```bash
cp templates/lesson-template.json lessons/my-topic.json   # or write a generator in scripts/
# ...edit...
node tools/narrate.mjs lessons/my-topic.json              # TTS narration per step -> audio/my-topic/step-NN.mp3
node tools/validate.mjs lessons/my-topic.json             # structure, bounds, pacing, pedagogy warnings
npm install                                               # once: Playwright + GSAP for the render check
node tools/check.mjs lessons/my-topic.json                # PNG of the board after every step -> checks/my-topic/
node tools/build.mjs lessons/my-topic.json                # -> dist/my-topic.html (+ dist/audio/ when narrated)
```

A lesson looks like this:

```json
{
  "id": "slope-of-a-line",
  "title": "Slope of a line",
  "meta": { "grade": "9", "objective": "Find the slope of a line from two points as rise over run." },
  "steps": [
    {
      "title": "Rise",
      "say": "Now climb straight up to B. That upward distance is the rise. The rise is three.",
      "do": [
        { "op": "line", "x1": 320, "y1": 350, "x2": 320, "y2": 260, "color": "green", "lw": 2.4 },
        { "op": "text", "t": "rise = 3", "x": 328, "y": 310, "size": 12, "anchor": "start", "font": "mono", "color": "green" }
      ]
    },
    {
      "title": "Your turn",
      "say": "So what is three divided by six? Pause and work out the slope before you continue.",
      "pause": true,
      "do": [ { "op": "text", "t": "3 ÷ 6 = ?", "x": 200, "y": 474, "size": 26, "font": "hand", "color": "blue" } ]
    }
  ]
}
```

Actions: `line`, `poly`, `rect`, `circle`, `path`, `text`, `fill` (scribble coloring), `cam` (pan/zoom), `clear` (new page), `hold`. Full reference: [`docs/lesson-format.md`](docs/lesson-format.md).

## Use it as an agent skill

The repo root is a skill: [`SKILL.md`](SKILL.md) tells an agent when to use it and the workflow (plan the lesson, lay out the board, write JSON, validate, render-check and look at the frames, build, deliver).

For Claude Code, clone it into a skills folder:

```bash
git clone https://github.com/duclun/sketchboard-lessons ~/.claude/skills/sketchboard-lessons      # all projects
git clone https://github.com/duclun/sketchboard-lessons .claude/skills/sketchboard-lessons         # one project
```

Other agents: point them at `SKILL.md` and let them read the docs it links.

## Repository layout

```
SKILL.md                     agent entry point: when to use, workflow, key rules
docs/
  lesson-format.md           every field, action, default, color; board and timing model
  pedagogy.md                how to structure a lesson that teaches; narration rules; self-review checklist
  recipes.md                 arrows, axes, graphs, angles, labels, cycles, zoom... as JSON and helper calls
player/
  index.html                 player page (dev: serve the repo and open /player/)
  sketchboard.js             the engine: lesson JSON -> GSAP timeline
  sketchboard.css            styles (light and dark)
lessons/                     sample lessons + index.json manifest the dev player loads
scripts/                     lesson generator scripts (example: make-layers-of-the-earth.mjs)
templates/lesson-template.json   starting skeleton following the lesson arc
schema/lesson.schema.json    JSON Schema (draft 2020-12) for editors and validators
tools/
  validate.mjs               errors + warnings (bounds, pacing, missing pause, camera left zoomed...)
  check.mjs                  headless render, one PNG per step, real duration, console errors
  build.mjs                  inline player + lessons into one standalone HTML
  format.mjs                 one-action-per-line JSON formatting
  helpers.mjs                geometry helpers that return actions (arrow, axes, grid, plot, label, cycle...)
dist/                        built standalone lessons
```

## Developing

- `npm run serve`, then open `http://localhost:8000/player/` to load every lesson listed in `lessons/index.json` straight from source. `?lesson=<id>` picks one, `?src=<url>` loads any lesson JSON, `?still` shows the finished board.
- `npm run validate`, `npm run build` (rebuilds everything in `dist/`), `npm run format`.
- `window.sketchboard` in the console exposes the timeline, chapters, `seek(seconds)` and `load(id)`.

## Known limits

- Narration audio is generated, not committed: run `node tools/narrate.mjs` to synthesize it (needs the `tts` CLI). Steps without audio fall back to the caption-only word estimate.
- GSAP and Google Fonts load from CDNs, so a lesson needs an internet connection the first time.
- Text width is estimated from character count, so check the rendered frames for long labels.
