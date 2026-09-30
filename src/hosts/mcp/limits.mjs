// SPDX-FileCopyrightText: 2026 Hwang Dae Jin (Philosophy That Works)
// SPDX-License-Identifier: AGPL-3.0-only
// grid 연결(MCP) — 천천히 · 적게 읽기(속도 제한)와 페이지 손잡이 (순수 계산, 시계를 넣어 줄 수 있음)
//
// 원칙: 읽기는 "천천히 · 적게" — 사이트에 폐를 끼치지 않게:
//   한 번에 하나 · 읽기 사이 3초 · 같은 사이트 10초 · 10분에 20번 · 2분 안의 같은 주소는 있던 페이지를 다시 씀
//   (제한은 이 컴퓨터의 grid 연결 전체가 함께 — 사용자 전용 폴더의 기록 파일 하나)
//   페이지는 8개까지 · 30분 기억 (grid_screen은 기억한 원자료로 — 네트워크 없음)
import { randomBytes } from "node:crypto";
import { closeSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";

/** 그 프로세스가 살아 있나 (같은 사용자의 것) */
export const alive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM"; // 다른 사용자의 것이면 살아 있음
  }
};
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * 속도 제한 기록 — 이 컴퓨터의 grid 연결이 **모두 함께** 쓰는 파일 (AI 클라이언트 창 여럿 · 판 확인용 두 번째 실행도 한 줄로 세움)
 * 파일: { reads: [{ id, site, start, end, pid }] } — 사용자 전용 폴더(만드는 쪽이 정함, 0700)에 둔다
 * 잠금: 잠금 파일(wx)에 프로세스 번호 · 주인이 죽었거나 5초가 넘으면 치움 · 6초까지 기다림
 * 읽는 중인 기록의 주인이 죽었으면 바로 끝난 것으로 · 미래 시각(시계가 뒤로 감)의 기록은 버림 · 연결이 끝날 때 차례를 바로 비움(endSync)
 * @param {{ file: string, now?: () => number, gapMs?: number, sameSiteGapMs?: number, windowMs?: number, maxInWindow?: number, runMs?: number, pid?: number }} o
 */
export function createLedger({ file, now = Date.now, gapMs = 3000, sameSiteGapMs = 10000, windowMs = 600000, maxInWindow = 20, runMs = 120000, pid = process.pid }) {
  const lock = `${file}.lock`;
  const tryLock = () => {
    try {
      const fd = openSync(lock, "wx", 0o600);
      writeFileSync(fd, String(pid));
      closeSync(fd);
      return true;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      try {
        const owner = Number(readFileSync(lock, "utf8"));
        if ((owner && !alive(owner)) || Date.now() - statSync(lock).mtimeMs > 5000) rmSync(lock, { force: true }); // 죽은 주인 · 오래된 잠금
      } catch {}
      return false;
    }
  };
  const unlock = () => rmSync(lock, { force: true });
  async function withLock(fn) {
    for (let k = 0; k < 300; k++) {
      if (tryLock()) {
        try {
          return fn();
        } finally {
          unlock();
        }
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error("the shared read log is busy — try again");
  }
  function withLockSync(fn) {
    for (let k = 0; k < 100; k++) {
      if (tryLock()) {
        try {
          return fn();
        } finally {
          unlock();
        }
      }
      sleepSync(10);
    }
  }
  const load = () => {
    try {
      const d = JSON.parse(readFileSync(file, "utf8"));
      return Array.isArray(d.reads) ? d.reads : [];
    } catch {
      return [];
    }
  };
  const save = (reads) => {
    const tmp = `${file}.${pid}.${randomBytes(4).toString("hex")}.tmp`;
    const fd = openSync(tmp, "wx", 0o600); // 새 파일로만 (남의 파일 · 링크를 따라가지 않게)
    writeFileSync(fd, JSON.stringify({ reads }));
    closeSync(fd);
    renameSync(tmp, file);
  };
  const markEnd = (id) => {
    const reads = load();
    const r = reads.find((x) => x.id === id);
    if (r && r.end == null) {
      r.end = now();
      save(reads);
    }
  };
  return {
    /** 읽어도 되면 시작을 적고 { ok, id } — 아니면 { ok: false, waitMs, why, busy } */
    async tryStart(site) {
      return withLock(() => {
        const t = now();
        const reads = load()
          .filter((r) => Number.isFinite(r.start) && r.start <= t + 5000) // 미래 시각의 기록은 버림
          .map((r) => (r.end == null && r.pid !== pid && !alive(r.pid) ? { ...r, end: r.start } : r)); // 주인이 죽은 읽기는 끝난 것으로
        const running = (r) => r.end == null && t - r.start < runMs;
        const kept = reads.filter((r) => t - r.start < windowMs || running(r));
        const busy = kept.find(running);
        if (busy) return { ok: false, busy: true, waitMs: Math.max(1000, Math.min(runMs - (t - busy.start), 5000)), why: "another grid read is still running (grid reads one page at a time on this computer)" };
        const inWin = kept.filter((r) => t - r.start < windowMs);
        if (inWin.length >= maxInWindow) return { ok: false, waitMs: windowMs - (t - Math.min(...inWin.map((r) => r.start))), why: `read limit: ${maxInWindow} pages per ${Math.round(windowMs / 60000)} minutes` };
        const done = (r) => Math.min(r.end ?? r.start, t);
        const lastAny = Math.max(-Infinity, ...kept.map(done));
        const lastSite = Math.max(-Infinity, ...kept.filter((r) => r.site === site).map(done));
        if (t - lastSite < sameSiteGapMs) return { ok: false, waitMs: sameSiteGapMs - (t - lastSite), why: `reading the same site again too soon (${sameSiteGapMs / 1000} s apart)` };
        if (t - lastAny < gapMs) return { ok: false, waitMs: gapMs - (t - lastAny), why: `reading too fast (${gapMs / 1000} s apart)` };
        const id = randomBytes(6).toString("hex");
        kept.push({ id, site, start: t, end: null, pid });
        save(kept);
        return { ok: true, id };
      });
    },
    /** 읽기 끝 (성공 · 실패 모두) — 간격은 끝난 때부터 */
    async end(id) {
      return withLock(() => markEnd(id));
    },
    /** 연결이 끝날 때: 기다리지 않고 바로 (다른 연결이 막히지 않게) */
    endSync(id) {
      try {
        withLockSync(() => markEnd(id));
      } catch {}
    },
  };
}

/**
 * 읽은 페이지 기억 — 손잡이(page) → 원자료. 손잡이는 짐작할 수 없게 무작위.
 * @param {{ now?: () => number, max?: number, ttlMs?: number, reuseMs?: number }} [o]
 */
export function createPages({ now = Date.now, max = 8, ttlMs = 1800000, reuseMs = 120000 } = {}) {
  const pages = new Map(); // handle → { url, capture, t }
  const sweep = () => {
    const t = now();
    for (const [h, p] of pages) if (t - p.t >= ttlMs) pages.delete(h);
    while (pages.size > max) pages.delete(pages.keys().next().value); // 가장 오래된 것부터
  };
  return {
    put(url, capture) {
      const handle = `p${randomBytes(6).toString("hex")}`;
      pages.set(handle, { url, capture, t: now() });
      sweep();
      return handle;
    },
    get(handle) {
      sweep();
      return pages.get(handle) || null;
    },
    /** 조금 전(reuseMs 안에) 같은 주소를 읽었으면 그 손잡이 */
    recent(url) {
      sweep();
      const t = now();
      let found = null;
      for (const [h, p] of pages) if (p.url === url && t - p.t < reuseMs) found = h;
      return found;
    },
    get size() {
      sweep();
      return pages.size;
    },
  };
}
