// SPDX-FileCopyrightText: 2026 Hwang Dae Jin (Philosophy That Works)
// SPDX-License-Identifier: AGPL-3.0-only
// grid 연결(MCP)의 읽기 프로세스 (Electron) — 연결 본체(server.mjs)가 처음 읽을 때 띄우고, fd 3 통로로 한 줄 JSON을 주고받는다.
// stdout에는 아무것도 쓰지 않는다 (macOS에서 크로뮴 도우미가 stdout을 같이 씀 — 본체가 이 프로세스의 stdout · stderr를 자기 stderr로 돌림).
// 통로가 닫히면(본체가 끝나면) 바로 끝난다. 읽기 방은 grid 전용 · 메모리에만 · 읽을 때마다 쿠키 · 저장소를 비움.
import { app } from "electron";
import { rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createReader, registerFixtureScheme, VERSION } from "../electron/reader.mjs";

// 시험 전용 — grid의 시험 페이지 폴더(cli/fixtures)일 때만 gridfix://fixture/… 읽기 (다른 폴더는 무시)
const OWN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../cli/fixtures");
const FIXTURES = process.env.GRID_TEST_FIXTURES && path.resolve(process.env.GRID_TEST_FIXTURES) === OWN ? OWN : null;
if (FIXTURES) registerFixtureScheme();
// 앱 자료 폴더: 본체가 정해 줌(사용자 전용 폴더 안) · 없으면 임시 폴더 — 끝나면 지움
const DATA = process.env.GRID_READER_DATA && path.isAbsolute(process.env.GRID_READER_DATA) ? process.env.GRID_READER_DATA : path.join(os.tmpdir(), `grid-mcp-${process.pid}`);
const wipe = () => {
  try {
    rmSync(DATA, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  } catch {} // 크로뮴이 아직 쓰는 중이어도 오류 창을 띄우지 않게 — 남은 것은 본체가 지움
};
app.setName("grid-mcp");
app.setPath("userData", DATA);
app.on("window-all-closed", () => {}); // 읽을 때마다 창을 닫아도 앱은 살아 있게
app.on("will-quit", wipe);

app.whenReady().then(() => {
  app.dock?.hide();
  const reader = createReader({ partition: "grid-mcp", fixturesDir: FIXTURES });
  const sock = new net.Socket({ fd: 3, readable: true, writable: true });
  sock.setEncoding("utf8");
  const send = (o) => sock.write(`${JSON.stringify(o)}\n`);
  const bye = () => {
    try {
      wipe(); // app.exit은 will-quit을 건너뛰므로 여기서 지움
    } finally {
      app.exit(0);
    }
  };
  sock.on("close", bye);
  sock.on("error", bye);
  let buf = "";
  let chain = Promise.resolve(); // 하나씩 차례로
  sock.on("data", (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      let req;
      try {
        req = JSON.parse(line);
      } catch {
        continue;
      }
      chain = chain.then(async () => {
        if (req.op !== "read") return send({ id: req.id, ok: false, error: `unknown op ${req.op}` });
        const r = await reader.read(req.url, { screens: req.screens || 8, fresh: true });
        send(r.ok ? { id: req.id, ok: true, capture: r.capture } : { id: req.id, ok: false, error: r.error, loadError: r.loadError });
      }).catch((e) => send({ id: req.id, ok: false, error: String(e?.message || e).slice(0, 300) })); // 한 번 잘못돼도 다음 읽기가 막히지 않게
    }
  });
  send({ ready: true, version: VERSION });
});
