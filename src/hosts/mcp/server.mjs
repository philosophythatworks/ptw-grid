// SPDX-FileCopyrightText: 2026 Hwang Dae Jin (Philosophy That Works)
// SPDX-License-Identifier: AGPL-3.0-only
// PTW grid 연결(MCP) 본체 — 다른 AI 에이전트(Claude Code 등)가 부르는 stdio 서버. 의존성 없음.
//
//   node /path/to/ptw-grid/src/hosts/mcp/server.mjs
//   (AI 클라이언트에 등록하는 법 · 안전은 README)
//
// 도구 (읽기만 — 누르기 · 입력 없음): grid_read { url } · grid_screen { page, screen } — 정의와 결과 글은 tools.mjs
// 읽기는 Electron 읽기 프로세스(child.mjs)가 한다 — 처음 읽을 때 띄우고, 5분 쉬거나 시간이 넘거나 stdin이 닫히면 끔.
// stdout은 연결 말 전용 — 읽기 프로세스의 stdout · stderr는 모두 이 프로세스의 stderr로.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { createLedger, createPages } from "./limits.mjs";
import { createProtocol } from "./protocol.mjs";
import { checkUrl, classify, errText, instructions, readResult, screenResult, screensOf, TOOLS } from "./tools.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const VERSION = JSON.parse(readFileSync(path.join(REPO, "package.json"), "utf8")).version;
// 사용자 전용 폴더 (0700): 속도 제한 기록 · 읽기 프로세스 자료 — 공용 /tmp가 아니라서 남이 끼어들 수 없고, 어느 클라이언트든 같은 곳
const CACHE = process.platform === "darwin" ? path.join(os.homedir(), "Library", "Caches", "ptw-grid") : path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "ptw-grid");
mkdirSync(CACHE, { recursive: true, mode: 0o700 });
try {
  chmodSync(CACHE, 0o700);
} catch {}
const IDLE_MS = 5 * 60000; // 읽기 프로세스를 5분 동안 안 쓰면 끔
const WAIT_MS = 75000; // 차례를 기다리는 것은 1분 15초까지 (앞 읽기 1분 + 간격)
const log = (...a) => process.stderr.write(`[ptw-grid] ${a.join(" ")}\n`);
const sleep = (ms, signal) =>
  new Promise((r) => {
    const t = setTimeout(r, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), r()), { once: true });
  });

// 시험 전용: grid의 시험 페이지 폴더(cli/fixtures)일 때만 gridfix://fixture/… 허용 (다른 폴더는 무시 — 이 컴퓨터의 파일을 읽히지 않게)
const FIXTURES = process.env.GRID_TEST_FIXTURES && path.resolve(process.env.GRID_TEST_FIXTURES) === path.join(REPO, "cli/fixtures") ? path.join(REPO, "cli/fixtures") : null;
if (process.env.GRID_TEST_FIXTURES && !FIXTURES) log("GRID_TEST_FIXTURES ignored (only grid's own cli/fixtures is allowed)");
// 한 페이지를 읽는 데 1분까지 (시험 모드에서만 줄일 수 있음 — 시간 초과 시험용)
const READ_MS = FIXTURES && Number(process.env.GRID_TEST_READ_MS) > 0 ? Number(process.env.GRID_TEST_READ_MS) : 60000;

// ── 읽기 프로세스 (Electron) — 프로세스마다 자기 기다림표 ──
let cur = null; // { proc, sock, ready, waiting, dead, pid }
let idle = null;
let seq = 0;

function die(c, why) {
  if (c.dead) return;
  c.dead = true;
  log(why);
  c.fail?.(new Error(why));
  for (const [id, done] of c.waiting) done({ id, ok: false, error: why });
  c.waiting.clear();
  if (cur === c) cur = null;
  try {
    rmSync(c.data, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); // 읽기 프로세스가 못 지운 자료 폴더
  } catch {}
}

async function ensureChild() {
  if (cur && !cur.dead) return cur.ready;
  const bin = process.versions.electron ? process.execPath : (await import("electron")).default;
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE; // 읽기 프로세스는 진짜 Electron이어야 창을 만듦
  if (FIXTURES) env.GRID_TEST_FIXTURES = FIXTURES;
  else delete env.GRID_TEST_FIXTURES;
  const data = path.join(CACHE, `reader-${randomBytes(6).toString("hex")}`);
  env.GRID_READER_DATA = data;
  const proc = spawn(bin, [path.join(HERE, "child.mjs")], { stdio: ["ignore", "pipe", "pipe", "pipe"], env });
  const c = { proc, sock: proc.stdio[3], waiting: new Map(), dead: false, pid: proc.pid, data };
  c.ready = new Promise((res, rej) => {
    c.ok = res;
    c.fail = rej;
  });
  c.ready.catch(() => {}); // 기다리는 쪽이 따로 받음
  proc.on("error", (e) => die(c, `could not start the reader: ${e.message}`));
  proc.on("exit", (code, sig) => die(c, `reader stopped (${code ?? sig})`));
  proc.stdout?.on("data", (d) => process.stderr.write(d)); // 크로뮴 잡음은 stderr로
  proc.stderr?.on("data", (d) => process.stderr.write(d));
  if (c.sock) {
    c.sock.setEncoding("utf8");
    c.sock.on("error", () => {}); // 끝나는 일은 exit에서
    let buf = "";
    c.sock.on("data", (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        let m;
        try {
          m = JSON.parse(line);
        } catch {
          continue;
        }
        if (m.ready) c.ok();
        else c.waiting.get(m.id)?.(m);
      }
    });
  }
  if (c.pid) log(`reader started (pid ${c.pid})`);
  cur = c;
  return c.ready;
}

/** 지금 읽기 프로세스를 끔 — 다음 읽기는 새 프로세스로 (멈춰 있으면 5초 뒤 강제로) */
function stopChild(why) {
  const c = cur;
  if (!c) return;
  cur = null;
  log(`stopping reader: ${why}`);
  try {
    c.proc.kill("SIGTERM");
  } catch {}
  setTimeout(() => {
    if (!c.dead) {
      try {
        c.proc.kill("SIGKILL");
      } catch {}
    }
  }, 5000).unref();
}

async function request(op, payload, ms, signal) {
  clearTimeout(idle);
  try {
    // 켜지는 동안에도 취소를 받음
    const cancelled = new Promise((res) => (signal?.aborted ? res("cancelled") : signal?.addEventListener("abort", () => res("cancelled"), { once: true })));
    const r = await Promise.race([ensureChild().then(() => "ok"), cancelled, new Promise((_, rej) => setTimeout(() => rej(new Error("the reader did not start in 30 s")), 30000).unref())]);
    if (r === "cancelled") return { ok: false, error: "cancelled" };
  } catch (e) {
    stopChild("start failed");
    return { ok: false, error: e.message };
  }
  const c = cur;
  if (!c) return { ok: false, error: "the reader stopped" };
  if (signal?.aborted) return { ok: false, error: "cancelled" };
  const id = ++seq;
  try {
    return await new Promise((resolve) => {
      const timer = setTimeout(() => {
        c.waiting.delete(id);
        if (cur === c) stopChild("read timeout");
        resolve({ id, ok: false, error: `the page took longer than ${ms / 1000} s` });
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        c.waiting.delete(id);
        if (cur === c) stopChild("read cancelled");
        resolve({ id, ok: false, error: "cancelled" });
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      c.waiting.set(id, (m) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        c.waiting.delete(id);
        resolve(m);
      });
      c.sock.write(`${JSON.stringify({ id, op, ...payload })}\n`);
    });
  } finally {
    idle = setTimeout(() => stopChild("idle"), IDLE_MS);
    idle.unref();
  }
}

// ── 도구가 하는 일 ──
// 속도 제한 기록 — 이 컴퓨터의 grid 연결이 함께 씀 (GRID_READ_LOG: 시험이 실제 기록을 건드리지 않게 따로 둘 때만)
const ledger = createLedger({ file: process.env.GRID_READ_LOG || path.join(CACHE, "reads.json") });
const turns = new Set(); // 지금 이 연결이 쥔 차례 — 끝낼 때 바로 비움
const pages = createPages();
setInterval(() => pages.size, 60000).unref(); // 오래된 페이지를 잊음 (기억을 비움)

async function gridRead(args, { signal, progress = () => {} } = {}) {
  const u = checkUrl(args.url, { fixtures: !!FIXTURES });
  if (!u.ok) return errText(u.error);
  const again = pages.recent(u.href);
  if (again) return readResult(again, pages.get(again), { reused: true, version: VERSION });
  // 차례: 한 번에 하나 · 간격 — 짧은 기다림은 여기서 기다리고(다시 부르며 허락 창이 쌓이지 않게), 긴 것은 알려 줌
  const t0 = Date.now();
  let turn;
  for (;;) {
    if (signal?.aborted) return errText("cancelled");
    turn = await ledger.tryStart(u.site);
    if (turn.ok) break;
    const waited = Date.now() - t0;
    if ((turn.busy || turn.waitMs <= 12000) && waited + turn.waitMs <= WAIT_MS) {
      progress(`waiting for grid's turn: ${turn.why}`);
      await sleep(Math.min(turn.waitMs, 5000), signal);
      continue;
    }
    return errText(`grid reads slowly on purpose: ${turn.why}. Try again in ${Math.ceil(turn.waitMs / 1000)} s.`);
  }
  turns.add(turn.id);
  let ticker = null;
  try {
    // 기다리는 동안 누가 같은 주소를 읽었으면 그것을 씀 (같은 페이지를 두 번 읽지 않게)
    const late = pages.recent(u.href);
    if (late) return readResult(late, pages.get(late), { reused: true, version: VERSION });
    if (signal?.aborted) return errText("cancelled");
    progress(`reading ${u.href}`);
    const t1 = Date.now();
    ticker = setInterval(() => progress(`still reading (${Math.round((Date.now() - t1) / 1000)} s)`), 10000);
    const r = await request("read", { url: u.href, screens: 8 }, READ_MS, signal);
    if (!r.ok) return errText(`could not read ${u.href}: ${r.error || r.loadError || "unknown error"}`);
    const { fatal, note } = classify(r.capture);
    if (fatal) return errText(`could not read ${u.href}: ${note}`);
    const handle = pages.put(u.href, r.capture);
    return readResult(handle, pages.get(handle), { version: VERSION });
  } finally {
    clearInterval(ticker);
    turns.delete(turn.id);
    await ledger.end(turn.id).catch((e) => log(`read log: ${e.message}`));
  }
}

async function gridScreen(args) {
  const page = typeof args.page === "string" ? args.page : "";
  const entry = pages.get(page);
  if (!entry) return errText("unknown or expired page handle — call grid_read again.");
  const n = args.screen;
  const total = screensOf(entry.capture);
  if (!Number.isInteger(n) || n < 1) return errText("screen must be a whole number from 1.");
  if (n > total) return errText(`page ${page} has ${total} screen(s).`);
  return screenResult(page, entry, n, { version: VERSION });
}

const proto = createProtocol({
  name: "ptw-grid",
  title: "PTW grid — AI eyes for web reading (GRID/1)",
  version: VERSION,
  instructions: instructions(),
  tools: TOOLS,
  call: (name, args, ctx) => (name === "grid_read" ? gridRead(args, ctx) : gridScreen(args)),
  notify: (msg) => out(JSON.stringify(msg)),
});

// ── stdio ──
let closing = false;
function shutdown(why) {
  if (closing) return;
  closing = true;
  log(`closing (${why})`);
  clearTimeout(idle);
  for (const id of turns) ledger.endSync(id); // 다른 연결이 이 차례를 기다리지 않게
  turns.clear();
  const c = cur;
  stopChild("closing");
  const finish = () => process.stdout.write("", () => process.exit(0)); // 보낼 말을 다 보내고 끝
  if (!c || c.dead) return finish();
  // 읽기 프로세스가 1.5초 안에 안 꺼지면 강제로 — 본체가 먼저 끝나 멈춘 프로세스가 남지 않게
  const kill = setTimeout(() => {
    try {
      c.proc.kill("SIGKILL");
    } catch {}
    finish();
  }, 1500);
  c.proc.once("exit", () => {
    clearTimeout(kill);
    finish();
  });
  setTimeout(() => process.exit(0), 4000).unref();
}
process.stdout.on("error", (e) => shutdown(`stdout ${e.code || e.message}`)); // 클라이언트가 먼저 끊음 (EPIPE)
const out = (s) => {
  if (!closing) process.stdout.write(`${s}\n`);
};
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  proto.handleLine(line).then((lines) => lines.forEach(out), (e) => log(`internal error: ${e?.message || e}`));
});
rl.on("close", () => shutdown("stdin closed"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
log(`ptw-grid ${VERSION} MCP server ready (stdio) · AGPL-3.0-only · source: https://github.com/philosophythatworks/ptw-grid`);
