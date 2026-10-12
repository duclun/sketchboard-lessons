#!/usr/bin/env node
// Pretty-print lesson JSON with one action per line, so lessons stay readable and diff well.
// Usage: node tools/format.mjs lessons/*.json   (rewrites files in place)
import fs from "node:fs";

export function formatLesson(L) {
  const lines = ["{"];
  const top = Object.keys(L).filter(k => k !== "steps");
  top.forEach(k => lines.push(`  ${JSON.stringify(k)}: ${JSON.stringify(L[k])},`));
  lines.push(`  "steps": [`);
  (L.steps || []).forEach((st, i) => {
    lines.push("    {");
    const keys = Object.keys(st).filter(k => k !== "do");
    keys.forEach(k => lines.push(`      ${JSON.stringify(k)}: ${JSON.stringify(st[k])},`));
    const ops = (st.do || []).map(o => "        " + JSON.stringify(o));
    lines.push(`      "do": [` + (ops.length ? "\n" + ops.join(",\n") + "\n      ]" : "]"));
    lines.push("    }" + (i < L.steps.length - 1 ? "," : ""));
  });
  lines.push("  ]", "}");
  return lines.join("\n") + "\n";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const f of process.argv.slice(2)) {
    const L = JSON.parse(fs.readFileSync(f, "utf8"));
    fs.writeFileSync(f, formatLesson(L));
    console.log("formatted", f);
  }
}
