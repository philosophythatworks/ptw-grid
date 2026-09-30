// SPDX-FileCopyrightText: 2026 Hwang Dae Jin (Philosophy That Works)
// SPDX-License-Identifier: AGPL-3.0-only
// 저장해 둔 원자료(capture.json)를 그리드 글로 찍는다 — Electron 없이
//   node cli/text.mjs runs/<이름>/<페이지>/capture.json [--arm A|B|C|D] [--legend]
import { readFileSync } from "node:fs";
import { format, LEGEND } from "../src/core/index.js";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--arm");
const at = args.indexOf("--arm");
const arm = at >= 0 ? args[at + 1] : "A";
if (!file || !"ABCD".includes(arm)) {
  console.log("usage: node cli/text.mjs <capture.json> [--arm A|B|C|D] [--legend]");
  process.exit(1);
}
const cap = JSON.parse(readFileSync(file, "utf8"));
if (args.includes("--legend")) console.log(`${LEGEND[arm]}\n`);
console.log(format(cap, arm));
