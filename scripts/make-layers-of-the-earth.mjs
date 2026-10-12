// Generates lessons/layers-of-the-earth.json. Run from the repo root:
//   node scripts/make-layers-of-the-earth.mjs
// Example of a scripted lesson: labels are placed around the circle with H.polar + H.label.
import fs from "node:fs";
import * as H from "../tools/helpers.mjs";
import { formatLesson } from "../tools/format.mjs";

const [cx, cy] = [115, 275];
// Leader from a point inside the layer (angle, radius) to a label column at x = 232.
const layer = (deg, r, ty, name, sub, color) => H.label(...H.polar(cx, cy, deg, r), 232, ty, name, { sub, color });
const ring = (r, color, a) => [{ op: "circle", cx, cy, r }, { op: "fill", of: "circle", cx, cy, r, color, a }];

const lesson = {
  id: "layers-of-the-earth",
  title: "Layers of the Earth",
  meta: {
    subject: "Earth science", grade: "9",
    objective: "Name Earth's four layers in order and describe each one's state and temperature.",
    vocabulary: ["crust", "mantle", "outer core", "inner core"],
    prerequisites: ["solid vs liquid"]
  },
  steps: [
    { title: "Earth has layers", say: "The Earth is not solid rock all the way through. It is built in layers, like a peach.", do: [
      { op: "text", t: "LAYERS OF THE EARTH", x: 200, y: 44, size: 19, color: "blue" },
      { op: "circle", cx, cy, r: 110 }] },
    { title: "Crust", say: "The crust is the thin, cool skin on the outside. It is where we live.", do: [
      { op: "fill", of: "circle", cx, cy, r: 110, color: "brown", a: .7 },
      ...layer(40, 104, 170, "CRUST", "5 to 70 km thick", "brown")] },
    { title: "Mantle", say: "Under it is the mantle, a thick layer of hot rock that flows very slowly.", do: [
      ...ring(98, "orange", .7), ...layer(15, 80, 238, "MANTLE", "2,900 km of hot rock", "orange")] },
    { title: "Outer core", say: "Deeper still is the outer core. It is made of liquid metal, mostly iron.", do: [
      ...ring(62, "yellow", .8), ...layer(-10, 47, 306, "OUTER CORE", "liquid iron, 4,500°C", "yellow")] },
    { title: "Inner core", say: "The inner core is solid iron. The pressure is so high that it cannot melt.", do: [
      ...ring(32, "red", .85), ...layer(-35, 18, 374, "INNER CORE", "solid iron, 5,200°C", "red")] },
    { title: "Hotter with depth", say: "The deeper you go, the hotter it gets. The center is about as hot as the surface of the Sun.", do: [
      { op: "cam", x: cx, y: cy, s: 2.4, dur: 1.2 },
      { op: "text", t: "5,200°C", x: cx, y: cy + 3, size: 9, color: "paper" },
      { op: "hold", s: .6 }] },
    { title: "Check yourself", say: "Quick check. Which layer is made of liquid metal? Pause and answer before you go on.", pause: true, do: [
      { op: "cam", x: 200, y: 250, s: 1, dur: 1.1 },
      { op: "text", t: "Which layer is liquid?", x: 200, y: 440, size: 20, font: "hand", color: "blue" }] },
    { title: "Remember", say: "It is the outer core. Crust, mantle, outer core, inner core. Thin, thick, liquid, solid.", do: [
      { op: "line", x1: 230, y1: 309, x2: 326, y2: 309, color: "blue", lw: 2.6 },
      { op: "text", t: "thin · thick · liquid · solid", x: 200, y: 470, size: 12, font: "mono" }], hold: .8 }
  ]
};
fs.writeFileSync("lessons/layers-of-the-earth.json", formatLesson(lesson));
console.log("wrote lessons/layers-of-the-earth.json");
