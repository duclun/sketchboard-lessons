#!/usr/bin/env node
// Synthesize per-step narration audio for a lesson with the tts CLI.
//
// Usage:
//   node tools/narrate.mjs lessons/my-lesson.json [--voice ID] [--speed N] [--force]
//
// For every step with a non-empty "say", writes audio/<id>/step-NN.mp3,
// measures its duration, and stamps "audio": {"src", "dur"} onto the step.
// Steps without narration are skipped. The lesson file is rewritten with the
// canonical formatting from tools/format.mjs.
//
// Needs a TTS backend: /opt/hatch/bin/tts or `tts` on PATH, and ffprobe for
// durations (falls back to the 0.34 s/word estimate when ffprobe is missing).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatLesson } from "./format.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_VOICE = "avocado_v2:MAI_01"; // Meta AI "Warm"
const PER = 0.34; // fallback seconds per word, matches the player estimate

// Make caption text speakable: the pedagogy guide already asks for plain
// sentences, but symbols sneak in ("3 ÷ 6", "90°").
const normalize = s => String(s)
  .replace(/÷/g, " divided by ")
  .replace(/×/g, " times ")
  .replace(/→/g, " then ")
  .replace(/°/g, " degrees ")
  .replace(/&/g, " and ")
  .replace(/=/g, " equals ")
  .replace(/\s+/g, " ")
  .trim();

function findTts() {
  for (const p of ["/opt/hatch/bin/tts", "/usr/local/bin/tts"]) {
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { /* next */ }
  }
  try { execFileSync("which", ["tts"], { stdio: "pipe" }); return "tts"; }
  catch { return null; }
}

function measure(file, words) {
  try {
    const out = execFileSync("ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const d = parseFloat(out);
    if (Number.isFinite(d) && d > 0) return Math.round(d * 100) / 100;
  } catch { /* fall through */ }
  return Math.round(words * PER * 100) / 100;
}

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
let voice = DEFAULT_VOICE, speed = 100, force = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--voice") voice = args[++i];
  if (args[i] === "--speed") speed = Number(args[++i]) || 100;
  if (args[i] === "--force") force = true;
}
if (!file) { console.error("usage: node tools/narrate.mjs lessons/<id>.json [--voice ID] [--speed N] [--force]"); process.exit(2); }

const tts = findTts();
if (!tts) {
  console.error("narrate: no TTS backend found (looked for /opt/hatch/bin/tts and `tts` on PATH).");
  process.exit(1);
}

const lessonPath = path.resolve(process.cwd(), file);
const L = JSON.parse(fs.readFileSync(lessonPath, "utf8"));
if (!L.id) { console.error("narrate: lesson needs an \"id\" (used for the audio directory)."); process.exit(1); }
const outDir = path.join(root, "audio", L.id);
fs.mkdirSync(outDir, { recursive: true });

let done = 0, skipped = 0;
L.steps.forEach((st, i) => {
  const words = String(st.say || "").split(/\s+/).filter(Boolean);
  if (!words.length) { console.log(`  step ${i + 1}: no "say", skipped`); skipped++; return; }
  const nn = String(i + 1).padStart(2, "0");
  const out = path.join(outDir, `step-${nn}.mp3`);
  if (fs.existsSync(out) && !force) {
    console.log(`  step ${i + 1}: exists, skipped (use --force to redo)`);
  } else {
    execFileSync(tts,
      ["speak", "--voice", voice, "--speed", String(speed), "--format", "mp3", "--output", out, "--text-stdin"],
      { input: normalize(st.say), stdio: ["pipe", "pipe", "pipe"] });
    console.log(`  step ${i + 1}: synthesized ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
  }
  const dur = measure(out, words.length);
  st.audio = { src: `audio/${L.id}/step-${nn}.mp3`, dur };
  done++;
});

fs.writeFileSync(lessonPath, formatLesson(L));
console.log(`narrated ${done} step${done === 1 ? "" : "s"} (${skipped} skipped) -> ${path.relative(process.cwd(), lessonPath)}`);
console.log("run tools/format.mjs if you hand-edited the file afterwards, then tools/validate.mjs.");
