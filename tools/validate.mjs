#!/usr/bin/env node
// Validate lesson JSON files: structure, action fields, board bounds, colors, and pacing.
// Usage: node tools/validate.mjs lessons/my-lesson.json [more.json ...]
// Exit code 1 if any file has errors. Warnings never fail the run but should be read.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalize, hashOf } from "./narrate.mjs";

// Repo root, so audio paths resolve the same wherever the tool is run from.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const W = 400, H = 500, PER = 0.34;
const COLORS = ["ink", "blue", "orange", "green", "grey", "red", "soft", "paper", "yellow", "brown", "purple", "teal"];
const FONTS = ["display", "mono", "hand"];
const COMMON = ["op", "color", "lw", "dur", "note"];
const OPS = {
  line:   { req: { x1: "num", y1: "num", x2: "num", y2: "num" } },
  poly:   { req: { pts: "pts" }, opt: { close: "bool" } },
  rect:   { req: { x: "num", y: "num", w: "num", h: "num" } },
  circle: { req: { cx: "num", cy: "num", r: "num" } },
  path:   { req: { d: "str" } },
  text:   { req: { t: "any", x: "num", y: "num" }, opt: { size: "num", anchor: "anchor", font: "font" } },
  fill:   { req: { of: "shape" }, opt: { a: "num", x: "num", y: "num", w: "num", h: "num", pts: "pts", close: "bool", cx: "num", cy: "num", r: "num" } },
  cam:    { req: {}, opt: { x: "num", y: "num", s: "num" } },
  clear:  { req: {} },
  hold:   { req: {}, opt: { s: "num" } }
};
const isNum = v => typeof v === "number" && Number.isFinite(v);
const check = {
  num: isNum, str: v => typeof v === "string" && v.length > 0, bool: v => typeof v === "boolean",
  any: v => v !== undefined && v !== null && String(v).length > 0,
  pts: v => Array.isArray(v) && v.length >= 2 && v.every(p => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1])),
  anchor: v => ["start", "middle", "end"].includes(v), font: v => FONTS.includes(v),
  shape: v => ["rect", "poly", "circle"].includes(v)
};
const validColor = c => c === undefined || COLORS.includes(c) || /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c);

export function validate(L) {
  const errors = [], warnings = [];
  const err = (w, m) => errors.push(`${w}: ${m}`), warn = (w, m) => warnings.push(`${w}: ${m}`);
  if (!L || typeof L !== "object") return { errors: ["lesson is not an object"], warnings, seconds: 0 };
  if (!L.title) warn("lesson", 'missing "title"');
  if (!L.id) warn("lesson", 'missing "id" (kebab-case, used for tabs and ?lesson=)');
  else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(L.id)) warn("lesson", `id "${L.id}" should be kebab-case`);
  if (!L.meta || !L.meta.objective) warn("lesson", 'add meta.objective: one sentence of what the student can do afterwards');
  if (!Array.isArray(L.steps) || !L.steps.length) { err("lesson", '"steps" must be a non-empty array'); return { errors, warnings, seconds: 0 }; }
  if (L.steps.length < 4) warn("lesson", `only ${L.steps.length} steps; most concepts need 5-10`);
  if (L.steps.length > 14) warn("lesson", `${L.steps.length} steps; consider splitting into two lessons`);

  let total = 0, camS = 1, pauses = 0;
  L.steps.forEach((st, i) => {
    const w = `step ${i + 1}${st.title ? ` "${st.title}"` : ""}`;
    if (!st.title) warn(w, 'missing "title" (shown as the chapter name)');
    else if (st.title.length > 28) warn(w, `title is ${st.title.length} chars; keep chapter titles under ~28`);
    const words = String(st.say || "").split(/\s+/).filter(Boolean);
    if (!words.length) warn(w, 'empty "say": every step should be narrated');
    if (words.length > 32) warn(w, `"say" has ${words.length} words; split the step (aim 8-25 words)`);
    if (/[–—]/.test(st.say || "")) warn(w, 'avoid dashes in "say"; captions are highlighted word by word');
    if (st.pause) pauses++;
    let audioDur = 0;
    if (st.audio !== undefined) {
      if (!st.audio || typeof st.audio !== "object" || typeof st.audio.src !== "string" || !st.audio.src)
        err(w, '"audio" must look like {"src": "audio/<id>/step-01.mp3", "dur": 4.2}; run tools/narrate.mjs');
      else if (!(typeof st.audio.dur === "number" && st.audio.dur > 0))
        err(w, '"audio.dur" must be a positive number of seconds; run tools/narrate.mjs to stamp it');
      else {
        audioDur = st.audio.dur;
        if (!st.audio.src.startsWith("data:") && !fs.existsSync(path.join(ROOT, st.audio.src)))
          warn(w, `audio file "${st.audio.src}" not found; run tools/narrate.mjs`);
        // Stale recording: "say" (or voice/speed) changed after narrating.
        if (typeof st.audio.hash === "string" && L.narration) {
          const want = hashOf(normalize(st.say || ""), L.narration.voice, L.narration.speed);
          if (st.audio.hash !== want)
            warn(w, `"say" changed since this step was narrated; re-run tools/narrate.mjs`);
        } else if (st.audio.hash !== undefined && typeof st.audio.hash !== "string") {
          err(w, '"audio.hash" must be a string; run tools/narrate.mjs to stamp it');
        }
      }
    }
    if (st.do !== undefined && !Array.isArray(st.do)) { err(w, '"do" must be an array'); return; }
    let drawT = 0;
    (st.do || []).forEach((o, j) => {
      const at = `${w} action ${j + 1} (${o && o.op})`;
      const spec = OPS[o && o.op];
      if (!spec) { err(at, `unknown op; use one of ${Object.keys(OPS).join(", ")}`); return; }
      for (const [k, t] of Object.entries(spec.req)) if (!check[t](o[k])) err(at, `"${k}" is required and must be ${t}`);
      for (const [k, t] of Object.entries(spec.opt || {})) if (o[k] !== undefined && !check[t](o[k])) err(at, `"${k}" must be ${t}`);
      for (const k of Object.keys(o)) if (!COMMON.includes(k) && !(k in spec.req) && !(k in (spec.opt || {}))) warn(at, `unknown key "${k}" is ignored`);
      if (!validColor(o.color)) err(at, `color "${o.color}" is not a palette name (${COLORS.join(" ")}) or hex`);
      if (o.dur !== undefined && !(isNum(o.dur) && o.dur > 0)) err(at, '"dur" must be a positive number of seconds');
      if (o.op === "fill") {
        const need = { rect: ["x", "y", "w", "h"], circle: ["cx", "cy", "r"], poly: ["pts"] }[o.of] || [];
        need.forEach(k => { if (o[k] === undefined) err(at, `fill of "${o.of}" needs "${k}"`); });
        if (o.a !== undefined && (o.a < 0 || o.a > 1)) err(at, '"a" (opacity) must be 0..1');
      }
      // Bounds (only meaningful at camera scale 1).
      const pts = [];
      if (o.op === "line") pts.push([o.x1, o.y1], [o.x2, o.y2]);
      if (o.op === "poly" || (o.op === "fill" && o.of === "poly")) (o.pts || []).forEach(p => pts.push(p));
      if (o.op === "rect" || (o.op === "fill" && o.of === "rect")) pts.push([o.x, o.y], [o.x + o.w, o.y + o.h]);
      if (o.op === "circle" || (o.op === "fill" && o.of === "circle")) pts.push([o.cx - o.r, o.cy - o.r], [o.cx + o.r, o.cy + o.r]);
      if (o.op === "text") {
        const size = o.size || 14, str = String(o.t), wd = str.length * size * (o.font === "mono" ? .6 : o.font === "hand" ? .45 : .62);
        const anchor = o.anchor || "middle", x0 = anchor === "middle" ? o.x - wd / 2 : anchor === "end" ? o.x - wd : o.x;
        pts.push([x0, o.y - size * .8], [x0 + wd, o.y]);
        if (size < 9) warn(at, `size ${size} is hard to read on a phone; use 9 or more`);
        drawT += Math.min(1.1, .25 + str.length * .04);
      }
      if (camS === 1 && pts.some(p => isNum(p[0]) && isNum(p[1]) && (p[0] < 4 || p[0] > W - 4 || p[1] < 4 || p[1] > H - 4)))
        warn(at, "extends outside the 400x500 board (or within 4px of its edge)");
      if (o.op === "cam") { camS = o.s ?? 1; drawT += o.dur || 1; }
      else if (o.op === "hold") drawT += o.s || .5;
      else if (o.op === "clear") drawT += .5;
      else if (o.op !== "text") drawT += (o.dur || .7) + .25;
    });
    const narrT = audioDur > 0 ? audioDur : words.length * PER;
    const t = Math.max(drawT, narrT + .35) + (st.hold ?? .25);
    // Two bars on purpose: without audio the "narration" is just caption
    // highlighting, so a longer overrun is harmless. With real audio, the
    // voice stopping while the pencil keeps drawing is audible dead air,
    // so the bar is tighter.
    if (!audioDur && drawT > words.length * PER + 3) warn(w, `drawing (~${drawT.toFixed(1)}s) runs much longer than the narration (~${(words.length * PER).toFixed(1)}s); add words or split the step`);
    if (audioDur && drawT > audioDur + 1.5) warn(w, `drawing (~${drawT.toFixed(1)}s) runs longer than the narration audio (~${audioDur.toFixed(1)}s); the pencil will finish in silence`);
    total += t;
  });
  if (camS !== 1) warn("lesson", "camera is still zoomed at the end; add {op:\"cam\",x:200,y:250,s:1} to the last step");
  if (!pauses) warn("lesson", 'no step has "pause": true; add at least one predict or check-yourself moment');
  total += .8;
  if (total > 240) warn("lesson", `~${Math.round(total)}s long; aim for 60-180s per lesson`);
  return { errors, warnings, seconds: total };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error("usage: node tools/validate.mjs lessons/*.json"); process.exit(2); }
  let bad = 0;
  for (const f of files) {
    if (f.endsWith("index.json")) continue;
    let L;
    try { L = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { console.log(`✗ ${f}\n  error: invalid JSON: ${e.message}`); bad++; continue; }
    const r = validate(L);
    console.log(`${r.errors.length ? "✗" : "✓"} ${f}  (${L.steps?.length || 0} steps, ~${Math.round(r.seconds)}s)`);
    r.errors.forEach(e => console.log("  error: " + e));
    r.warnings.forEach(e => console.log("  warn:  " + e));
    if (r.errors.length) bad++;
  }
  process.exit(bad ? 1 : 0);
}
