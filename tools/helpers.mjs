// Geometry helpers that return Sketchboard actions (plain objects), for writing lessons as scripts.
// Every function returns an ARRAY of actions, so spread them into a step's "do":
//
//   import * as H from "./tools/helpers.mjs";
//   const step = { title: "Axes", say: "...", do: [...H.axes({ ox: 80, oy: 380, w: 280, h: 290 })] };
//
// Then write the lesson with formatLesson() from tools/format.mjs. See docs/recipes.md.

const r1 = v => Math.round(v * 10) / 10;
const P = (x, y) => [r1(x), r1(y)];

/** Point at angle `deg` (0 = right, 90 = up, counter-clockwise like math class) and radius r from (cx, cy). */
export function polar(cx, cy, deg, r) {
  const a = deg * Math.PI / 180;
  return P(cx + r * Math.cos(a), cy - r * Math.sin(a));
}

/** Arrowhead at (x2, y2) for a segment coming from (x1, y1). */
export function arrowHead(x1, y1, x2, y2, { size = 10, color, lw } = {}) {
  const a = Math.atan2(y2 - y1, x2 - x1), s = .5;
  const L = [x2 - size * Math.cos(a - s), y2 - size * Math.sin(a - s)];
  const R = [x2 - size * Math.cos(a + s), y2 - size * Math.sin(a + s)];
  return [{ op: "poly", pts: [P(...L), P(x2, y2), P(...R)], ...opt({ color, lw }) }];
}

/** Straight arrow from (x1, y1) to (x2, y2). */
export function arrow(x1, y1, x2, y2, { color, lw, size } = {}) {
  return [{ op: "line", x1, y1, x2, y2, ...opt({ color, lw }) }, ...arrowHead(x1, y1, x2, y2, { size, color, lw })];
}

/** Curved arrow along a circular arc around (cx, cy), from angle a0 to a1 (degrees, CCW positive). */
export function arcArrow(cx, cy, r, a0, a1, { color, lw, size = 9, dur } = {}) {
  const d = arcPath(cx, cy, r, a0, a1);
  const end = polar(cx, cy, a1, r), before = polar(cx, cy, a1 - Math.sign(a1 - a0) * 6, r);
  return [{ op: "path", d, ...opt({ color, lw, dur }) }, ...arrowHead(...before, ...end, { size, color, lw })];
}

/** SVG path string for a circular arc from angle a0 to a1 (degrees, CCW positive, 0 = right). */
export function arcPath(cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, a0, r), [x1, y1] = polar(cx, cy, a1, r);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0, sweep = a1 > a0 ? 0 : 1;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`;
}

/** Angle mark at vertex (vx, vy) between rays toward angles a0 and a1, with optional label. */
export function angleArc(vx, vy, a0, a1, { r = 22, label, color, size = 11 } = {}) {
  const out = [{ op: "path", d: arcPath(vx, vy, r, a0, a1), lw: 1.6, dur: .4, ...opt({ color }) }];
  if (label) { const [x, y] = polar(vx, vy, (a0 + a1) / 2, r + 14); out.push({ op: "text", t: label, x, y: r1(y + size * .35), size, font: "mono", ...opt({ color }) }); }
  return out;
}

/** Little square marking a right angle at corner (x, y); dx, dy = +1/-1 say which way the two sides go. */
export function rightAngle(x, y, dx = 1, dy = -1, s = 12) {
  return [{ op: "poly", pts: [P(x + dx * s, y), P(x + dx * s, y + dy * s), P(x, y + dy * s)], lw: 1.6 }];
}

/** Solid dot. */
export function dot(cx, cy, { r = 4, color = "ink" } = {}) {
  return [{ op: "circle", cx, cy, r, color, lw: 1.6 }, { op: "fill", of: "circle", cx, cy, r, color, a: .9 }];
}

/** Label with a leader line from a point on the thing (px, py) to the text at (tx, ty). Optional second line `sub`. */
export function label(px, py, tx, ty, text, { sub, color, size = 15, anchor = "start" } = {}) {
  const gap = anchor === "start" ? -6 : anchor === "end" ? 6 : 0;
  const out = [
    { op: "line", x1: px, y1: py, x2: tx + gap, y2: ty - 5, lw: 1.4 },
    { op: "text", t: text, x: tx, y: ty, size, anchor, ...opt({ color }) }
  ];
  if (sub) out.push({ op: "text", t: sub, x: tx, y: ty + 15, size: 9, anchor, font: "mono" });
  return out;
}

/** x/y axes with arrowheads, origin at (ox, oy), w wide and h tall. */
export function axes({ ox = 80, oy = 380, w = 280, h = 290, xLabel = "x", yLabel = "y", color } = {}) {
  return [
    ...arrow(ox - 20, oy, ox + w, oy, { color }),
    ...arrow(ox, oy + 20, ox, oy - h, { color }),
    { op: "text", t: xLabel, x: ox + w + 10, y: oy + 16, size: 14, font: "mono" },
    { op: "text", t: yLabel, x: ox, y: oy - h - 10, size: 14, font: "mono" }
  ];
}

/** Light grid: `nx` by `ny` cells of `cell` px starting at the origin (ox, oy) going right and up. */
export function grid({ ox = 80, oy = 380, nx = 9, ny = 9, cell = 30, color = "soft" } = {}) {
  const out = [];
  for (let i = 1; i <= nx; i++) out.push({ op: "line", x1: ox + i * cell, y1: oy, x2: ox + i * cell, y2: oy - ny * cell, color, lw: .8, dur: .12 });
  for (let j = 1; j <= ny; j++) out.push({ op: "line", x1: ox, y1: oy - j * cell, x2: ox + nx * cell, y2: oy - j * cell, color, lw: .8, dur: .12 });
  return out;
}

/** Map graph units to board px for a grid made with the same ox, oy, cell. */
export const toBoard = ({ ox = 80, oy = 380, cell = 30 } = {}) => (x, y) => P(ox + x * cell, oy - y * cell);

/** Number line from value `from` to `to`, ticks every `step`, between board x0..x1 at height y. */
export function numberLine({ x0 = 40, x1 = 360, y = 300, from = -5, to = 5, step = 1, color } = {}) {
  const out = [...arrow(x0 - 10, y, x1 + 12, y, { color }), ...arrowHead(x1, y, x0 - 14, y, { color })];
  const px = v => r1(x0 + (v - from) / (to - from) * (x1 - x0));
  for (let v = from; v <= to + 1e-9; v += step) {
    out.push({ op: "line", x1: px(v), y1: y - 6, x2: px(v), y2: y + 6, lw: 1.4, dur: .12 });
    out.push({ op: "text", t: String(+v.toFixed(2)), x: px(v), y: y + 22, size: 10, font: "mono" });
  }
  return out;
}

/** Regular polygon with n sides (as a closed poly), first vertex at angle `rot` degrees. */
export function regularPolygon(cx, cy, r, n, { rot = 90, color, lw } = {}) {
  const pts = Array.from({ length: n }, (_, i) => polar(cx, cy, rot + i * 360 / n, r));
  return [{ op: "poly", pts, close: true, ...opt({ color, lw }) }];
}

/** Smooth curve through points (Catmull-Rom converted to cubic Béziers) as a path action. */
export function curve(pts, { color, lw, dur } = {}) {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = P(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6);
    const c2 = P(p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6);
    d += ` C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
  }
  return [{ op: "path", d, ...opt({ color, lw, dur }) }];
}

/** Graph of y = f(x) on a grid (same ox, oy, cell as grid/axes), sampled from x = a to b. */
export function plot(f, a, b, { ox = 80, oy = 380, cell = 30, samples = 24, color = "blue", lw = 2.6, dur = 1.2 } = {}) {
  const m = toBoard({ ox, oy, cell });
  const pts = Array.from({ length: samples + 1 }, (_, i) => { const x = a + (b - a) * i / samples; return m(x, f(x)); });
  return curve(pts, { color, lw, dur });
}

/** Curly-ish bracket under a span from x0 to x1 at height y, with a label below. */
export function brace(x0, x1, y, text, { color, size = 12, font = "mono" } = {}) {
  const m = (x0 + x1) / 2;
  return [
    { op: "poly", pts: [P(x0, y - 6), P(x0, y), P(m - 4, y), P(m, y + 6), P(m + 4, y), P(x1, y), P(x1, y - 6)], lw: 1.6, ...opt({ color }) },
    { op: "text", t: text, x: m, y: y + 22, size, font, ...opt({ color }) }
  ];
}

/** Cycle of labeled nodes around a circle joined by curved arrows (water cycle, rock cycle, cell cycle). */
export function cycle(cx, cy, r, labels, { color = "blue", start = 90, size = 13 } = {}) {
  const n = labels.length, out = [];
  labels.forEach((t, i) => {
    const a = start - i * 360 / n, [x, y] = polar(cx, cy, a, r);
    out.push({ op: "text", t, x, y: r1(y + size * .35), size });
    out.push(...arcArrow(cx, cy, r, a - 360 / n * .28, a - 360 / n * .72, { color, lw: 1.8 }));
  });
  return out;
}

function opt(o) { const r = {}; for (const k in o) if (o[k] !== undefined) r[k] = o[k]; return r; }
