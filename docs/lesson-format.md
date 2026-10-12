# Lesson format reference

A lesson is one JSON file. The player turns it into a single GSAP timeline: a pencil draws each step's actions on a 400×500 sheet of paper while the step's narration line appears as a caption, highlighted word by word.

Machine-readable schema: [`schema/lesson.schema.json`](../schema/lesson.schema.json). Validator: `node tools/validate.mjs lessons/x.json`.

## Lesson

```json
{
  "id": "slope-of-a-line",
  "title": "Slope of a line",
  "meta": {
    "subject": "Algebra",
    "grade": "9",
    "objective": "Find the slope of a line from two points as rise over run.",
    "vocabulary": ["slope", "rise", "run"],
    "prerequisites": ["plotting points (x, y)"],
    "misconceptions": ["run is counted vertically"]
  },
  "steps": [ ... ]
}
```

| Field | Required | Meaning |
|---|---|---|
| `id` | recommended | kebab-case. Used for the lesson tab and `?lesson=<id>`. Also the file name: `lessons/<id>.json`. |
| `title` | recommended | Shown on the tab and the browser title. |
| `meta` | recommended | Planning data. The player ignores it; the validator wants `meta.objective`. Keep it, because it is how the next agent knows what the lesson is for. |
| `steps` | **yes** | Ordered array of steps (chapters). |

## Step

```json
{
  "title": "Rise",
  "say": "Now climb straight up to B. That upward distance is the rise.",
  "do": [ {"op": "line", "x1": 320, "y1": 350, "x2": 320, "y2": 260, "color": "green"} ],
  "hold": 0.25,
  "pause": false,
  "notes": "optional teacher/agent notes, ignored by the player"
}
```

| Field | Default | Meaning |
|---|---|---|
| `title` | `Step N` | Chapter name in the side list. Keep under ~28 characters. |
| `say` | `""` | Narration, shown as the caption. Split on spaces; each word is highlighted for 0.34 s. |
| `do` | `[]` | Actions, drawn **one after another** in array order. |
| `hold` | `0.25` | Extra seconds of stillness after the step. |
| `pause` | `false` | When `true`, playback stops at the end of this step and the Play button reads **Continue**. Use it for predict / check-yourself moments. Scrubbing and chapter jumps never trigger it. |
| `audio` | | `{"src": "audio/<id>/step-01.mp3", "dur": 4.2}` — narration recording for this step, stamped by `tools/narrate.mjs`. When present, the step lasts as long as the recording and the caption highlights words across it. |
| `notes` | | Ignored. |

### Step timing

```
step length = max(time to draw every action, narration + 0.35) + hold
```

where `narration` is `audio.dur` when the step has an `audio` recording, otherwise `words × 0.34`.

So narration and drawing start together. If the drawing finishes first, the step waits for the voice; if the voice finishes first, the step waits for the pencil. Aim for the two to be about equal: a 15-word line (~5 s) fits 3 to 6 drawing actions. The validator warns when drawing runs much longer than the narration. `tools/narrate.mjs` measures real audio durations, so narrated lessons get exact timing instead of the 0.34 s/word estimate.

Before every drawing action the pencil travels from where it is to the start of the new mark (0.12 to 0.4 s, by distance). Keep consecutive marks near each other and the lesson feels deliberate rather than jumpy.

## The board

- `viewBox` is **400 wide × 500 tall**. Origin top-left, **y grows downward**.
- Keep everything inside **16 ≤ x ≤ 384, 16 ≤ y ≤ 490**. The validator warns within 4 px of the edge.
- Typical zones used by the samples:
  - Title: `y = 44`, centered at `x = 200`, `size 18–19`, `color "blue"`.
  - Main diagram: `y ≈ 70–400`.
  - Equations and takeaways: `y ≈ 420–490`.
- The page is portrait. On phones it sits above the caption, so small text gets small fast: never go below `size 9`, prefer 11+ for labels.

## Actions

Every drawing action accepts these common keys:

| Key | Default | Meaning |
|---|---|---|
| `color` | `"ink"` | A palette name (below) or any hex like `"#2f5fd0"`. |
| `lw` | `2.2` | Stroke width in board units. 1.4 for leader lines, 2.6 for the "hero" line. |
| `dur` | computed | Override the drawing duration in seconds. |
| `note` | | Ignored. |

### `line`
```json
{"op":"line","x1":60,"y1":380,"x2":362,"y2":380}
```
A hand-drawn segment (slightly bent, jittered ends). Default duration: `clamp(length / 260, 0.35, 1.1)` s.

### `poly`
```json
{"op":"poly","pts":[[110,300],[230,300],[110,210]],"close":true}
```
Polyline through `pts`; `close:true` returns to the first point. Each edge is roughened like `line`. Use for triangles, arrowheads, zig-zags, any straight-edged shape. Duration from total length, same clamp.

### `rect`
```json
{"op":"rect","x":20,"y":210,"w":90,"h":90,"color":"blue"}
```
Outline of a rectangle (top-left `x,y`). Same as a closed `poly`.

### `circle`
```json
{"op":"circle","cx":115,"cy":275,"r":110}
```
Hand-drawn circle outline. Duration from circumference, same clamp (so big circles take 1.1 s).

### `path`
```json
{"op":"path","d":"M 120 300 A 30 30 0 0 0 150 270","dur":0.6}
```
Any SVG path in board coordinates, drawn exactly as given (not roughened). Use it for curves: arcs, waves, orbits, parabolas, arrows that bend. Default duration 0.8 s. Prefer absolute commands (`M L A C Q`), and avoid `Z` mid-path.

### `text`
```json
{"op":"text","t":"a² + b² = c²","x":200,"y":490,"size":28,"color":"blue","anchor":"middle","font":"display"}
```
| Key | Default | Meaning |
|---|---|---|
| `t` | required | The string. Unicode is fine: `² ³ √ π ° × ≈ ≤ → ½`. |
| `x`, `y` | required | Anchor point. **`y` is the baseline**, so the text sits above it. |
| `size` | `14` | Font size in board units. |
| `anchor` | `"middle"` | `start`, `middle` or `end`. Use `start` for labels to the right of a leader line. |
| `font` | `"display"` | `display` = Archivo Black, heavy poster caps (titles, key terms, big equations). `mono` = JetBrains Mono (numbers, coordinates, small facts, worked arithmetic). `hand` = Caveat handwriting (questions to the student, asides, the answer to a prediction). |

The pencil wiggles along the text while it fades in. Duration `min(1.1, 0.25 + 0.04 × characters)`.

Approximate width for layout: `characters × size × k`, with `k = 0.62` display, `0.6` mono, `0.45` hand. The validator uses the same estimate for its bounds check.

Glyph caution: `÷` in the display font reads like `+` at small sizes. Write `/` or "over" there, or use `mono`/`hand` for `÷`.

### `fill`
```json
{"op":"fill","of":"circle","cx":115,"cy":275,"r":98,"color":"orange","a":0.7}
```
Scribble-colors the inside of a shape: a hatch sweeps left to right, clipped to the shape. `of` is `rect`, `poly` or `circle`, followed by that shape's own keys (`x,y,w,h` / `pts` / `cx,cy,r`). `a` is opacity, default `0.55`.

- **Always set `color`**; the default is ink, which is rarely what you want.
- A fill draws no outline. Draw the outline with its own action (usually before the fill).
- Fills are painted **underneath** every stroke and text of the current scene, whatever their order. Later fills sit on top of earlier fills, which is how the nested Earth layers work: big circle filled first, smaller circles filled after.
- Duration `0.4 + width / 320` s.
- A filled dot: `circle` with `r: 4` then `fill` the same circle with `a: 0.9`.

### `cam`
```json
{"op":"cam","x":115,"y":275,"s":2.4,"dur":1.2}
```
Pans and zooms. `x,y` is the board point to put in the center of the view, `s` the zoom (1 = whole board). `{"op":"cam"}` with no keys returns to the full view (`x:200, y:250, s:1`). Default duration 1 s, eased.

- The camera keeps its position across steps and across `clear`. If you zoom, **zoom back out** before the lesson ends (the validator checks).
- While zoomed, new drawings still use board coordinates.
- Zoom on the detail you are talking about, say the detail, then return. Use 1.8 to 3.

### `clear`
```json
{"op":"clear"}
```
Fades out everything drawn so far (0.5 s) and starts a fresh page. Use it between parts of a lesson that need the whole board, then redraw only what the next part needs. The camera is not reset.

### `hold`
```json
{"op":"hold","s":0.6}
```
Waits `s` seconds (default 0.5) in the middle of a step, for example after a zoom so the student can look.

## Colors

| Name | Hex | Suggested meaning |
|---|---|---|
| `ink` | `#1d1d1f` | Default strokes, structure, axes |
| `blue` | `#2f5fd0` | Titles, the main idea, first quantity |
| `orange` | `#e2673f` | Second quantity, heat, warning |
| `green` | `#2e8b57` | Third quantity, answers, "correct" |
| `red` | `#c0392b` | Emphasis, the hottest / most extreme |
| `yellow` | `#f2b630` | Highlight fills |
| `brown` | `#8a5a3b` | Earth, rock, wood |
| `purple` | `#7a4fc4` | Extra category |
| `teal` | `#1f8a8a` | Water, extra category |
| `grey` | `#5b5b5b` | Secondary marks |
| `soft` | `#8a8780` | Light guide lines, grids |
| `paper` | `#f7f5f0` | "White" text on a dark fill; erasing-look marks |

Pick one color per concept and keep it for the whole lesson (in the Pythagorean sample, `a` is always blue, `b` orange, `c` green). The pencil changes color to match what it draws.

## Determinism

Hand-drawn jitter comes from a seeded random generator reset on every build, so a lesson draws identically every time, and the render checks are reproducible.

## Player URL options

- `?lesson=<id>` opens that lesson first.
- `?src=<url-to-lesson.json>` loads one lesson by URL (http only).
- `?still` jumps to the end without animating (used by `tools/check.mjs`).
- `prefers-reduced-motion` also starts at the end; the student can still press Play.

## Inspecting a running player

`window.sketchboard` exposes `lesson`, `timeline` (the GSAP timeline), `chapters` (`[{title, t}]`), `duration()`, `load(idOrLesson)`, `seek(seconds)`, `colors`, `secondsPerWord`.
