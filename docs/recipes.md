# Drawing recipes

Common diagram pieces, as raw JSON and as helper calls. For anything with more than a few computed coordinates (arcs, graphs, polygons, cycles, labels around a circle), **write the lesson as a small Node script** with [`tools/helpers.mjs`](../tools/helpers.mjs) instead of hand-typing numbers.

## Scripted lessons

```js
// scripts/make-photosynthesis.mjs   (run: node scripts/make-photosynthesis.mjs)
import fs from "node:fs";
import * as H from "../tools/helpers.mjs";
import { formatLesson } from "../tools/format.mjs";

const lesson = {
  id: "photosynthesis",
  title: "Photosynthesis",
  meta: { subject: "Biology", grade: "9", objective: "..." },
  steps: [
    { title: "Sunlight", say: "Plants catch energy from sunlight.", do: [
      { op: "text", t: "PHOTOSYNTHESIS", x: 200, y: 44, size: 19, color: "blue" },
      { op: "circle", cx: 70, cy: 110, r: 26, color: "yellow" },
      { op: "fill", of: "circle", cx: 70, cy: 110, r: 26, color: "yellow", a: 0.8 },
      ...H.arrow(100, 130, 170, 190, { color: "yellow" })
    ]}
  ]
};
fs.writeFileSync("lessons/photosynthesis.json", formatLesson(lesson));
```

Every helper returns an **array** of actions; spread it into `do`. Coordinates are rounded to 0.1. Angles are in degrees, **0 = right, 90 = up** (math convention, even though board y points down).

Keep the generator script in `scripts/` next to the lesson so the next edit is a re-run, not a hand edit.

## Recipes

### Arrow
```json
{"op":"line","x1":100,"y1":200,"x2":220,"y2":200},
{"op":"poly","pts":[[211.2,204.8],[220,200],[211.2,195.2]]}
```
`H.arrow(x1, y1, x2, y2, {color, lw, size})`. Arrowhead only: `H.arrowHead(fromX, fromY, tipX, tipY)`.

### Curved arrow / arc
`H.arcArrow(cx, cy, r, fromDeg, toDeg, {color})` draws an arc around `(cx, cy)` with a head at the end. Counter-clockwise when `toDeg > fromDeg`. Raw arc path: `H.arcPath(cx, cy, r, a0, a1)` gives a `d` string for `{"op":"path"}`.

### Right-angle mark
```json
{"op":"poly","pts":[[110,288],[122,288],[122,300]],"lw":1.6}
```
`H.rightAngle(cornerX, cornerY, dx, dy)` where `dx, dy` are ±1 for the directions the two sides run from the corner (on screen: `dx = 1` right, `dy = -1` up).

### Angle arc with label
`H.angleArc(vx, vy, ray1Deg, ray2Deg, {r: 22, label: "θ"})`. Find a ray's angle with `Math.atan2(-(y2 - vy), x2 - vx) * 180 / Math.PI`.

### Dot (plotted point)
```json
{"op":"circle","cx":140,"cy":350,"r":4,"lw":1.6},
{"op":"fill","of":"circle","cx":140,"cy":350,"r":4,"color":"ink","a":0.9}
```
`H.dot(cx, cy, {color, r})`.

### Label with leader line
```json
{"op":"line","x1":194.7,"y1":208.2,"x2":226,"y2":165,"lw":1.4},
{"op":"text","t":"CRUST","x":232,"y":170,"size":15,"anchor":"start","color":"brown"},
{"op":"text","t":"5 to 70 km thick","x":232,"y":185,"size":9,"anchor":"start","font":"mono"}
```
`H.label(pointX, pointY, textX, textY, "CRUST", {sub: "5 to 70 km thick", color: "brown"})`. For parts of a round thing, get the point with `H.polar(cx, cy, deg, r)`. Stack several labels on the same `textX` about 68 px apart.

### Coordinate plane
```js
const g = { ox: 80, oy: 380, cell: 30 };          // origin and px per unit
...H.grid({ ...g, nx: 9, ny: 9 }),                // light grid (color "soft")
...H.axes({ ...g, w: 280, h: 290 }),              // arrows + x / y labels
...H.dot(...H.toBoard(g)(2, 1)),                  // point (2, 1)
...H.plot(x => x * x / 6, 0, 6, g)                // y = x²/6 as a smooth curve
```
A 9×9 grid with `cell: 30` fills the board's middle nicely; leave `y > 400` for the equation.

### Number line
`H.numberLine({x0: 40, x1: 360, y: 300, from: -5, to: 5, step: 1})`. Mark a value with `H.dot` at `x0 + (v - from) / (to - from) * (x1 - x0)`.

### Brace / span label
`H.brace(x0, x1, y, "run = 6", {color: "orange"})` draws a bracket under a span and labels it.

### Regular polygon
`H.regularPolygon(cx, cy, r, sides, {rot: 90})`. Fill it with `{"op":"fill","of":"poly","pts": <same pts>}`.

### Cycle diagram
`H.cycle(cx, cy, r, ["EVAPORATE", "CONDENSE", "RAIN"])` places labels around a circle with clockwise curved arrows between them. For 3 to 5 stages. Draw it across several steps by slicing the returned array if each stage needs its own narration.

### Smooth curve through points
`H.curve([[x, y], ...], {color, lw, dur})` for rivers, wave shapes, rolling hills, population curves.

### Nested shapes (layers, cross-sections)
Draw outlines and fills from the outside in: outer `circle` + `fill`, then the next `circle` + `fill`, and so on (see `lessons/layers-of-the-earth.json`). Later fills cover earlier ones.

### Side-by-side comparison
Split the board at `x = 200`: left case centered on `x = 105`, right case on `x = 295`, one heading each at `y ≈ 90`, a vertical `soft` divider line. Ask "which one?" in a `pause` step.

### Step-by-step equation
Write each line of working as its own `text` (mono, size 14–16) at the same `x`, moving down 26 px per line, one line per step or per sentence. Put the final answer in `green` and the general rule big at the bottom.

### Zoom on a detail
```json
{"op":"cam","x":115,"y":275,"s":2.4,"dur":1.2},
{"op":"text","t":"5,200°C","x":115,"y":278,"size":9,"color":"paper"},
{"op":"hold","s":0.6}
```
Then, in a later step, `{"op":"cam"}` to go back. Text drawn while zoomed can be small (it's magnified), but it will be tiny once you zoom out.

### Two-scene lesson
`{"op":"clear"}` as the first action of a step, then redraw a simplified version of what's needed. Re-state the title for the new scene.
