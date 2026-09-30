// SPDX-FileCopyrightText: 2026 Hwang Dae Jin (Philosophy That Works)
// SPDX-License-Identifier: AGPL-3.0-only
// 저장해 둔 원자료(capture.json)로 네 형식을 다시 만든다 — 페이지를 다시 열지 않고 문법만 고칠 때
//   node cli/reformat.mjs runs/<이름> [--out runs/<다른 이름>]   (--out: 원래 글은 두고 다른 폴더에 새로 씀 — 실험 기록 보존)
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { format, roughTokens } from "../src/core/format.js";

const root = process.argv[2];
const outAt = process.argv.indexOf("--out");
const outRoot = outAt > 0 ? process.argv[outAt + 1] : null;
if (!root) {
  console.log("usage: node cli/reformat.mjs runs/<name> [--out runs/<other name>]");
  process.exit(1);
}
for (const d of readdirSync(root)) {
  const dir = path.join(root, d);
  if (!statSync(dir).isDirectory()) continue;
  let cap;
  try {
    cap = JSON.parse(readFileSync(path.join(dir, "capture.json"), "utf8"));
  } catch {
    continue;
  }
  const sizes = {};
  const outDir = outRoot ? path.join(outRoot, d) : dir;
  mkdirSync(outDir, { recursive: true });
  for (const arm of ["A", "B", "C", "D"]) {
    const text = format(cap, arm);
    writeFileSync(path.join(outDir, `grid-${arm}.txt`), text);
    sizes[arm] = roughTokens(text);
  }
  console.log(d.padEnd(60), JSON.stringify(sizes));
}
