#!/usr/bin/env node
// Bundle the player and one or more lessons into a single self-contained HTML file
// (works from file://, can be emailed, uploaded to an LMS, or published as a claude.ai Artifact).
// GSAP and fonts still load from their CDNs.
//
// Narration audio is inlined as data: URIs by default, so the "one file"
// promise holds for narrated lessons too (an 8-10 step lesson is typically a
// few hundred KB of MP3). Pass --no-inline-audio to ship dist/audio/<id>/…
// next to the HTML instead.
//
// Usage:
//   node tools/build.mjs                                   -> dist/sketchboard.html with every lesson in lessons/index.json
//   node tools/build.mjs lessons/photosynthesis.json       -> dist/photosynthesis.html
//   node tools/build.mjs a.json b.json -o dist/unit-1.html -> one file, several lesson tabs
//   node tools/build.mjs --no-inline-audio ...             -> audio as separate files
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./validate.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
let out = null;
const oi = args.indexOf("-o");
if (oi >= 0) { out = args[oi + 1]; args.splice(oi, 2); }
let inlineAudio = true;
const ni = args.indexOf("--no-inline-audio");
if (ni >= 0) { inlineAudio = false; args.splice(ni, 1); }

let files = args;
if (!files.length) files = JSON.parse(fs.readFileSync(path.join(root, "lessons/index.json"), "utf8")).map(f => path.join(root, "lessons", f));
const lessons = files.map(f => {
  const L = JSON.parse(fs.readFileSync(f, "utf8"));
  const r = validate(L);
  if (r.errors.length) { console.error(`✗ ${f}\n  ` + r.errors.join("\n  ")); process.exit(1); }
  return L;
});
if (!out) out = path.join(root, "dist", args.length === 1 ? path.basename(args[0], ".json") + ".html" : "sketchboard.html");

for (const L of lessons) {
  for (const st of (L.steps || [])) {
    if (!st.audio || !st.audio.src || st.audio.src.startsWith("data:")) continue;
    const from = path.join(root, st.audio.src);
    if (!fs.existsSync(from)) { console.error(`✗ missing audio file ${st.audio.src} (run tools/narrate.mjs)`); process.exit(1); }
    if (inlineAudio) {
      // Inline into the built copy only; the lesson JSON on disk keeps the file path.
      const b64 = fs.readFileSync(from).toString("base64");
      st.audio = { ...st.audio, src: `data:audio/mpeg;base64,${b64}` };
    } else {
      const to = path.join(path.dirname(out), st.audio.src);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

const safe = s => s.replace(/<\/(script|style)/gi, "<\\/$1");
let html = fs.readFileSync(path.join(root, "player/index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "player/sketchboard.css"), "utf8");
const js = fs.readFileSync(path.join(root, "player/sketchboard.js"), "utf8");
html = html
  .replace(/<link rel="stylesheet" href="sketchboard.css"><!--inline:sketchboard.css-->/, () => `<style>\n${safe(css)}</style>`)
  .replace(/<script src="sketchboard.js"><\/script><!--inline:sketchboard.js-->/, () => `<script>\n${safe(js)}</script>`)
  .replace("<!--lessons-->", () => `<script>window.SKETCHBOARD_LESSONS=${JSON.stringify(lessons).replace(/</g, "\\u003c")};</script>`);
if (lessons.length === 1 && lessons[0].title) html = html.replace("<title>Sketchboard Lessons</title>", `<title>${lessons[0].title.replace(/[<&]/g, "")}</title>`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`built ${path.relative(process.cwd(), out)} (${lessons.length} lesson${lessons.length > 1 ? "s" : ""}, ${(html.length / 1024).toFixed(0)} KB)`);
