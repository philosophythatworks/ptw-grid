// SPDX-FileCopyrightText: 2026 Hwang Dae Jin (Philosophy That Works)
// SPDX-License-Identifier: AGPL-3.0-only
// grid 시험 프로그램 (Electron) — 주소를 넣으면 그리드가 나온다
//
//   npx electron cli/grid.mjs read <주소…> [--out runs/<이름>] [--screens 8] [--arms A|ABCD]
//   시험 페이지: gridfix://fixture/shop.html  (cli/fixtures/의 파일)
//
// 읽기는 src/hosts/electron/reader.mjs가 한다 (메모리에만 있는 읽기 전용 방 · 이 컴퓨터 안 주소 막기 · 권한 · 팝업 · 다운로드 · 대화상자 끔 · 소리 끔 · 읽기만).
// 이 파일은 앱 설정(자기 userData · 화면 배율 1) + 파일로 남기기(capture.json · grid-A.txt · 사진 · view.html)만 맡는다.
import { app } from "electron";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format, roughTokens } from "../src/core/index.js";
import { createReader, registerFixtureScheme } from "../src/hosts/electron/reader.mjs";
import { viewHtml } from "./view.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

// ── 인자 ──
const argv = process.argv.slice(process.argv.findIndex((a) => a.endsWith("grid.mjs")) + 1);
const cmd = argv[0];
const flag = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const urls = argv.slice(1).filter((a, i, all) => !a.startsWith("--") && !(i > 0 && all[i - 1].startsWith("--")));
const outRoot = path.resolve(ROOT, flag("out", `runs/${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`));
const maxScreens = Number(flag("screens", "8"));
const arms = [...flag("arms", "A")].filter((a) => "ABCD".includes(a));

if (cmd !== "read" || !urls.length) {
  console.log("usage: npx electron cli/grid.mjs read <url…> [--out runs/<name>] [--screens 8] [--arms A|ABCD]");
  process.exit(cmd ? 1 : 0);
}

registerFixtureScheme();
app.setName("grid-cli");
app.setPath("userData", path.join(ROOT, ".userdata", "cli"));
app.commandLine.appendSwitch("force-device-scale-factor", "1"); // 사진 = CSS px 그대로 (칸 겹쳐 보기 쉽게)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (u) => {
  try {
    const x = new URL(u);
    return `${x.hostname}${x.pathname}`.replace(/[^a-zA-Z0-9가-힣]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "page";
  } catch {
    return "page";
  }
};

app.whenReady().then(async () => {
  app.dock?.hide();
  const reader = createReader({ fixturesDir: path.join(HERE, "fixtures") });
  mkdirSync(outRoot, { recursive: true });
  const summary = [];
  for (const url of urls) {
    const dir = path.join(outRoot, slug(url));
    mkdirSync(dir, { recursive: true });
    const r = await reader.read(url, { shots: true, screens: maxScreens });
    let line;
    if (r.ok) {
      const cap = r.capture;
      r.images.forEach((im, i) => writeFileSync(path.join(dir, `shot-${i + 1}.jpg`), im.jpeg));
      writeFileSync(path.join(dir, "capture.json"), JSON.stringify(cap, null, 1));
      const sizes = {};
      for (const arm of arms) {
        const text = arm === "A" ? r.text : format(cap, arm);
        writeFileSync(path.join(dir, `grid-${arm}.txt`), text);
        sizes[arm] = { chars: text.length, tokens: roughTokens(text) };
      }
      writeFileSync(path.join(dir, "view.html"), viewHtml(cap, dir));
      const acts = cap.items.filter((i) => i.kind === "action");
      line = { ok: true, items: cap.items.length, actions: acts.length, covered: acts.filter((i) => i.hit === false).length, dropped: cap.dropped, sizes, screens: cap.shots?.length || 0, ms: r.ms, walkMs: cap.ms, title: cap.title, finalUrl: cap.log?.finalUrl, loadError: cap.log?.loadError };
    } else {
      line = { ok: false, error: r.error, ms: r.ms, loadError: r.loadError };
    }
    summary.push({ url, dir: path.relative(ROOT, dir), ...line });
    console.log(JSON.stringify({ url, ...line }));
    await sleep(1500); // 사이트에 부담 주지 않게 천천히
  }
  writeFileSync(path.join(outRoot, "summary.json"), JSON.stringify(summary, null, 1));
  app.quit();
});
app.on("window-all-closed", () => {});
