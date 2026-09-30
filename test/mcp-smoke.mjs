// SPDX-FileCopyrightText: 2026 Hwang Dae Jin (Philosophy That Works)
// SPDX-License-Identifier: AGPL-3.0-only
// grid 연결(MCP) 끝까지 시험 — 연결 본체를 진짜로 띄워, 에이전트처럼 인사하고 우리 시험 페이지(cli/fixtures)를 읽는다
//   node test/mcp-smoke.mjs      (Electron 읽기 프로세스가 뜸 · 시험 페이지만 · 끝나면 성공 0 / 실패 1 · 1분쯤 걸림)
// 속도 제한 기록은 시험용 임시 파일 (실제 기록과 따로)
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TMP = mkdtempSync(path.join(os.tmpdir(), "grid-smoke-"));
const srv = spawn(process.execPath, [path.join(ROOT, "src/hosts/mcp/server.mjs")], {
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, GRID_TEST_FIXTURES: path.join(ROOT, "cli/fixtures"), GRID_READ_LOG: path.join(TMP, "reads.json") },
});
const progress = []; // 받은 진행 알림
let stderr = "";
srv.stderr.on("data", (d) => (stderr += d));
const pids = () => [...stderr.matchAll(/reader started \(pid (\d+)\)/g)].map((m) => +m[1]);
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const bad = [];
const answered = new Set();
const waiters = new Map();
readline.createInterface({ input: srv.stdout }).on("line", (line) => {
  let m;
  try {
    m = JSON.parse(line);
  } catch {
    bad.push(line); // stdout에는 연결 말만 있어야 함
    return;
  }
  if (m.method === "notifications/progress") progress.push(m.params);
  answered.add(m.id);
  waiters.get(m.id)?.(m);
});
let seq = 0;
const send = (method, params) => {
  const id = ++seq;
  srv.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) })}\n`);
  return id;
};
const ask = (method, params, ms = 120000) =>
  new Promise((resolve, reject) => {
    const id = send(method, params);
    const t = setTimeout(() => reject(new Error(`${method} timeout`)), ms);
    waiters.set(id, (m) => {
      clearTimeout(t);
      resolve(m);
    });
  });
const tell = (method, params) => srv.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, ...(params ? { params } : {}) })}\n`);
const call = async (name, args) => {
  const r = await ask("tools/call", { name, arguments: args });
  assert.ok(r.result, JSON.stringify(r.error));
  return { text: r.result.content[0].text, isError: r.result.isError };
};
const checks = [];
const check = async (name, fn) => {
  try {
    await fn();
    checks.push([true, name]);
  } catch (e) {
    checks.push([false, name, String(e.message || e).split("\n")[0]]);
  }
};

let handle;
await check("옛 판 인사 · 도구 목록", async () => {
  const init = await ask("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "grid-test", version: "1" } });
  assert.equal(init.result.protocolVersion, "2025-06-18");
  assert.match(init.result.instructions, /untrusted web content/);
  tell("notifications/initialized");
  const list = await ask("tools/list");
  assert.deepEqual(list.result.tools.map((t) => t.name), ["grid_read", "grid_screen"]);
});

await check("grid_read: 가게 시험 페이지 → 믿을 수 없는 웹 글 표시 · 무작위 표시로 감싼 GRID/1 · 손잡이", async () => {
  const r = await call("grid_read", { url: "gridfix://fixture/shop.html" });
  assert.equal(r.isError, false, r.text);
  const tag = /everything between the ([0-9a-f]{12}) markers/.exec(r.text)?.[1];
  assert.ok(tag, "무작위 표시");
  assert.match(r.text, new RegExp(`<<<grid-page ${tag} begin>>>\\nGRID/1 · gridfix://fixture/shop\\.html`));
  assert.match(r.text, new RegExp(`<<<grid-page ${tag} end>>>`));
  assert.match(r.text, /⚠ O1 = popup aside "앱 광고"/);
  assert.match(r.text, /How to read it: The page is one tall sheet/);
  handle = /page (p[0-9a-f]{12})/.exec(r.text)?.[1];
  assert.ok(handle, "손잡이");
});

await check("같은 주소를 곧바로 다시: 새로 읽지 않고 다시 씀", async () => {
  const r = await call("grid_read", { url: "gridfix://fixture/shop.html" });
  assert.match(r.text, /reused a read from the last 2 minutes/);
  assert.match(r.text, new RegExp(`page ${handle}`));
});

await check("grid_screen: 기억한 페이지의 화면 하나를 온전히 · 모르는 손잡이는 잘못", async () => {
  const r = await call("grid_screen", { page: handle, screen: 2 });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /this is screen 2\/\d+ in full \(rows 21–40\)/);
  const x = await call("grid_screen", { page: "p000000000000", screen: 1 });
  assert.equal(x.isError, true);
  assert.match(x.text, /unknown or expired page handle/);
});

await check("이 컴퓨터 안 · 아이디/비밀번호 · file 주소는 거절 (읽기 전에)", async () => {
  for (const url of ["http://127.0.0.1:9/", "https://user:pw@example.com/", "file:///etc/hosts"]) {
    const r = await call("grid_read", { url });
    assert.equal(r.isError, true, url);
    assert.match(r.text, /only reads public http\/https pages/, url);
  }
});

await check("읽기 프로세스가 죽어도: 다음 읽기는 새 프로세스로 (천천히 — 간격은 연결이 알아서 기다림)", async () => {
  const [first] = pids();
  assert.ok(first && alive(first), "첫 읽기 프로세스");
  process.kill(first, "SIGKILL");
  await new Promise((r) => setTimeout(r, 500));
  const r = await call("grid_read", { url: "gridfix://fixture/news.html" });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /GRID\/1 · gridfix:\/\/fixture\/news\.html/);
  assert.equal(pids().length, 2, "새 읽기 프로세스");
});

await check("진행 알림 · 읽는 도중 취소: 대답하지 않고 읽기 프로세스를 바꾸며, 다음 읽기가 막히지 않음", async () => {
  const before = pids().length;
  const id = send("tools/call", { name: "grid_read", arguments: { url: "gridfix://fixture/share.html" }, _meta: { progressToken: "cancel-me" } });
  // "reading …" 진행 알림이 오면(간격을 기다린 뒤 실제로 읽기 시작) 취소
  for (let k = 0; k < 200 && !progress.some((p) => p.progressToken === "cancel-me" && /^reading /.test(p.message)); k++) await new Promise((r) => setTimeout(r, 100));
  assert.ok(progress.some((p) => p.progressToken === "cancel-me" && /^reading /.test(p.message)), "읽기 시작 진행 알림");
  const steps = progress.filter((p) => p.progressToken === "cancel-me").map((p) => p.progress);
  assert.deepEqual(steps, [...steps].sort((a, b) => a - b), "진행 숫자는 늘기만");
  tell("notifications/cancelled", { requestId: id, reason: "test" });
  await new Promise((r) => setTimeout(r, 1500));
  assert.equal(answered.has(id), false, "취소한 요청에 대답이 옴");
  const r = await call("grid_read", { url: "gridfix://fixture/catalog.html" });
  assert.equal(r.isError, false, r.text);
  assert.ok(pids().length > before, "취소하면 읽던 프로세스를 바꿈");
});

await check("없는 주소는 빈 성공이 아니라 잘못으로", async () => {
  const r = await call("grid_read", { url: "http://grid-nonexistent-host.invalid/" });
  assert.equal(r.isError, true, r.text.slice(0, 200));
  assert.match(r.text, /could not read/);
});

await check("시간 초과: 오류로 알리고 다음 읽기는 새 프로세스로 (시험용으로 제한 시간을 2.5초로)", async () => {
  const quick = spawn(process.execPath, [path.join(ROOT, "src/hosts/mcp/server.mjs")], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, GRID_TEST_FIXTURES: path.join(ROOT, "cli/fixtures"), GRID_READ_LOG: path.join(TMP, "reads-quick.json"), GRID_TEST_READ_MS: "2500" },
  });
  let qerr = "";
  quick.stderr.on("data", (d) => (qerr += d));
  const qwait = new Map();
  readline.createInterface({ input: quick.stdout }).on("line", (line) => {
    const m = JSON.parse(line);
    qwait.get(m.id)?.(m);
  });
  let qid = 0;
  const qcall = (name, args) =>
    new Promise((resolve, reject) => {
      const id = ++qid;
      const t = setTimeout(() => reject(new Error("timeout")), 90000);
      qwait.set(id, (m) => (clearTimeout(t), resolve(m.result)));
      quick.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } })}\n`);
    });
  try {
    const slow = await qcall("grid_read", { url: "gridfix://fixture/feed.html" }); // 여러 화면을 짚느라 2.5초를 넘김
    assert.equal(slow.isError, true);
    assert.match(slow.content[0].text, /took longer than 2\.5 s/);
    const ok = await qcall("grid_read", { url: "gridfix://fixture/form.html" });
    assert.equal(ok.isError, false, ok.content[0].text.slice(0, 200));
    assert.ok([...qerr.matchAll(/reader started \(pid (\d+)\)/g)].length >= 2, "새 읽기 프로세스");
  } finally {
    const gone = new Promise((r) => quick.on("exit", r));
    quick.stdin.end();
    await gone;
    for (const m of qerr.matchAll(/reader started \(pid (\d+)\)/g)) {
      await new Promise((r) => setTimeout(r, 300));
      assert.equal(alive(+m[1]), false, `읽기 프로세스 ${m[1]}가 남음`);
    }
  }
});

await check("새 판: server/discover", async () => {
  const d = await ask("server/discover", { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {} } });
  assert.equal(d.result.resultType, "complete");
  assert.ok(d.result.supportedVersions.includes("2026-07-28"));
});

await check("stdout에는 연결 말만", async () => {
  assert.deepEqual(bad, []);
});

await check("stdin을 닫으면 본체 · 읽기 프로세스가 끝나고 임시 폴더도 남지 않음", async () => {
  const exited = new Promise((r) => srv.on("exit", r));
  srv.stdin.end();
  await Promise.race([exited, new Promise((_, rej) => setTimeout(() => rej(new Error("본체가 5초 안에 안 끝남")), 5000))]);
  await new Promise((r) => setTimeout(r, 2000));
  for (const pid of pids()) {
    assert.equal(alive(pid), false, `읽기 프로세스 ${pid}가 남음`);
  }
  const cache = process.platform === "darwin" ? path.join(os.homedir(), "Library", "Caches", "ptw-grid") : path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "ptw-grid");
  const { readdirSync } = await import("node:fs");
  const left = existsSync(cache) ? readdirSync(cache).filter((f) => f.startsWith("reader-")) : [];
  assert.deepEqual(left, [], `남은 읽기 자료 폴더: ${left.join(", ")}`);
});

for (const [ok, name, why] of checks) console.log(`${ok ? "✔" : "✘"} ${name}${why ? ` — ${why}` : ""}`);
const failed = checks.filter((c) => !c[0]).length;
console.log(failed ? `실패 ${failed}/${checks.length}` : `모두 통과 ${checks.length}/${checks.length}`);
if (failed) console.log(`--- 본체 stderr (끝부분) ---\n${stderr.slice(-1500)}`);
srv.kill();
rmSync(TMP, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
