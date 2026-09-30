// SPDX-FileCopyrightText: 2026 Hwang Dae Jin (Philosophy That Works)
// SPDX-License-Identifier: AGPL-3.0-only
// grid 읽기 모듈 (Electron) — 숨은 창에서 주소를 읽거나, 이미 열린 창을 읽는다. 시험 프로그램(cli/)과 이 엔진을 쓰는 앱이 같이 쓴다.
//
//   import { createReader, captureFrom } from "…/ptw-grid/src/hosts/electron/reader.mjs";
//   const reader = createReader();                        // grid 전용 · 메모리에만 있는 읽기 방
//   const r = await reader.read("https://example.com");   // → { ok, capture, text(12칸 GRID/1), images }
//   const v = await captureFrom(win.webContents, { scroll: false });  // 이미 보이는 창: 넘기지 않고 지금 화면만 짚기
//
// 안전 (읽기 방 — grid만 씀, 다른 앱의 세션과 나누지 않음):
//   메모리에만(persist 없음 — 끄면 다 사라짐) · http/https만 열기(넘어가는 주소도 검사) · 이 컴퓨터 · 내부망 주소 막기(이름을 풀어 본 실제 주소까지) ·
//   WebRTC가 이 컴퓨터 · 내부망 주소를 쓰지 않게 · 권한 · 팝업 · 다운로드 · 대화상자(alert/confirm) · 인증서 자동 제출 끔 · 소리 끔.
// 누르기 · 입력 · 제출은 하지 않는다 — 읽기만 (걸음 스크립트는 격리된 세계에서 돌아 페이지의 스크립트와 섞이지 않음).
// 앱 전체 설정(userData 폴더 · 화면 배율 · 주소 방식 등록)은 이 모듈이 건드리지 않는다 — 쓰는 쪽(host 앱)이 정한다.
import { app, BrowserWindow, protocol, session } from "electron";
import { readFileSync } from "node:fs";
import path from "node:path";
import { format } from "../../core/format.js";
import { mergeHits } from "../../core/merge.js";
import { hostVerdict, isIpLiteral, isLocalHost, topAllowed } from "../../core/net.js";

/** 판 번호 — 사이트에 "ptw-grid/판"으로 밝힘 (사람이 부탁한 읽기임을 숨기지 않음) */
export const VERSION = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")).version;
/** 페이지 안에 넣는 걸음 스크립트 (__grid.capture · __grid.hitTest) */
export const WALKER = readFileSync(new URL("../../page/walker.js", import.meta.url), "utf8");
/** 격리된 세계 번호 (0 · 999 · 1<<20 이상은 피함) */
const WORLD = 1047;
/** 읽는 창의 크기 (CSS px) — 한 화면 = 20줄(40px) */
export const VIEWPORT = { w: 1280, h: 800 };
/** 시험 페이지 주소 방식 — 쓰는 앱이 자기 registerSchemesAsPrivileged 한 번에 함께 넣는다 (Electron은 한 번만 부를 수 있음) */
export const FIXTURE_SCHEME = { scheme: "gridfix", privileges: { standard: true, secure: true, supportFetchAPI: true } };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** 시간 상한 — 끝나면 타이머도 지운다. ms는 Node 타이머 한도(2³¹-1) 안으로 (넘으면 Node가 1ms로 바꿔 곧바로 끝나 버림) */
const withTimeout = (p, ms, what) => {
  const limit = Math.min(2 ** 31 - 1, Math.max(1, Number(ms) || 1));
  let timer;
  return Promise.race([p, new Promise((_, rej) => (timer = setTimeout(() => rej(new Error(`${what} timeout ${limit}ms`)), limit)))]).finally(() => clearTimeout(timer));
};
const FRAME = "new Promise((r) => { let done = false; const f = () => { if (!done) { done = true; r(1); } }; requestAnimationFrame(() => requestAnimationFrame(f)); setTimeout(f, 300); })";
const PAGE_H = "JSON.stringify({ h: (document.scrollingElement || document.documentElement).scrollHeight })";
/** 읽기 방에서 나가도 되는 요청 방식 (file · chrome 같은 것은 막음) */
const SCHEMES = new Set(["http:", "https:", "ws:", "wss:", "data:", "blob:"]);

/** 시험 페이지 주소 방식(gridfix://fixture/…)만 따로 등록 — 시험 프로그램처럼 다른 방식이 없는 앱에서, app이 준비되기 전에 한 번 */
export function registerFixtureScheme() {
  protocol.registerSchemesAsPrivileged([FIXTURE_SCHEME]);
}

/** 창마다 네트워크 요청 수 · 막은 수 — 조용해질 때까지 기다리려고 (읽기 방에서만 셈) */
function netTracker() {
  return {
    count: new Map(),
    last: new Map(),
    blocked: new Map(),
    block(id) {
      if (id != null) this.blocked.set(id, (this.blocked.get(id) || 0) + 1);
    },
    track(id, d) {
      if (id == null) return;
      this.count.set(id, Math.max(0, (this.count.get(id) || 0) + d));
      this.last.set(id, Date.now());
    },
    forget(id) {
      this.count.delete(id);
      this.last.delete(id);
      this.blocked.delete(id);
    },
    async quiet(id, { quietMs = 800, maxMs = 8000 } = {}) {
      const t0 = Date.now();
      while (Date.now() - t0 < maxMs) {
        const busy = (this.count.get(id) || 0) > 0;
        const since = Date.now() - (this.last.get(id) || t0);
        if (!busy && since >= quietMs) return Date.now() - t0;
        await sleep(100);
      }
      return maxMs;
    },
  };
}
const sessions = new WeakMap(); // 읽기 방 → { net, fixturesDir }
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 이름 판정은 core/net.js의 hostVerdict (보이는 브라우저에서도 같은 것) · 예전 이름으로도 내보냄 */
export { hostVerdict };

/**
 * grid 전용 읽기 방 — 메모리에만 있고 안전 설정이 된 세션. 다른 앱의 세션을 넘기지 말 것 (요청 검사기가 겹치면 한쪽이 사라짐).
 * @param {{ partition?: string, fixturesDir?: string | null }} [o] partition은 "grid-"로 시작 (persist: 금지). fixturesDir를 주면 gridfix://fixture/<이름>을 그 폴더에서 읽음 (FIXTURE_SCHEME 등록 필요)
 */
export function readerSession({ partition = "grid-reader", fixturesDir = null } = {}) {
  if (!/^grid-[\w-]+$/.test(partition)) throw new Error(`grid reader: the reading session name must start with "grid-" and stay in memory only (got "${partition}")`);
  const ses = session.fromPartition(partition);
  const known = sessions.get(ses);
  if (known) {
    if ((known.fixturesDir || null) !== (fixturesDir || null)) throw new Error(`grid reader: session "${partition}" is already open with a different test-page folder`);
    return ses;
  }
  const net = netTracker();
  sessions.set(ses, { net, fixturesDir });
  const appTok = new RegExp(`\\s${escapeRe(app.getName().replace(/\s+/g, ""))}/\\S+`, "g"); // 사용자 에이전트에는 앱 이름이 빈칸 없이 들어감 ("My App" → "MyApp/1.0")
  // 사이트에는 보통 크롬 + "ptw-grid/판"으로 보임 — 사람이 부탁한 읽기임을 숨기지 않음 · 언어는 이 컴퓨터의 언어 먼저, 그다음 영어
  const loc = String(app.getLocale?.() || "en-US").replace(/_/g, "-");
  const langs = [...new Set([loc, loc.split("-")[0], "en-US", "en"])].join(",");
  ses.setUserAgent(`${ses.getUserAgent().replace(/\sElectron\/\S+/, "").replace(appTok, "")} ptw-grid/${VERSION}`, langs);
  ses.setPermissionRequestHandler((_wc, _p, cb) => cb(false));
  ses.setPermissionCheckHandler(() => false);
  ses.setDevicePermissionHandler(() => false);
  const verdict = hostVerdict((host) => ses.resolveHost(host));
  ses.webRequest.onBeforeRequest({ urls: ["<all_urls>"] }, (d, cb) => {
    const deny = () => {
      net.block(d.webContentsId);
      cb({ cancel: true });
    };
    const allow = () => {
      net.track(d.webContentsId, +1);
      cb({});
    };
    let u;
    try {
      u = new URL(d.url);
    } catch {
      return deny();
    }
    if (u.protocol === "gridfix:" && fixturesDir) return allow();
    if (!SCHEMES.has(u.protocol)) return deny();
    if (!/^(https?|wss?):$/.test(u.protocol)) return allow();
    if (isLocalHost(u.hostname)) return deny();
    if (isIpLiteral(u.hostname)) return allow();
    verdict(u.hostname).then((v) => (v === "ok" ? allow() : deny()));
  });
  const done = (d) => net.track(d.webContentsId, -1);
  ses.webRequest.onCompleted({ urls: ["<all_urls>"] }, done);
  ses.webRequest.onErrorOccurred({ urls: ["<all_urls>"] }, done);
  ses.on("will-download", (_e, item) => item.cancel());
  if (fixturesDir) {
    ses.protocol.handle("gridfix", (req) => {
      const name = path.basename(new URL(req.url).pathname) || "index.html";
      try {
        const body = readFileSync(path.join(fixturesDir, name));
        const type = name.endsWith(".html") ? "text/html; charset=utf-8" : name.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
        return new Response(body, { headers: { "content-type": type } });
      } catch {
        return new Response("not found", { status: 404 });
      }
    });
  }
  return ses;
}

/**
 * 이미 열린 창(webContents)을 읽는다: 걸음 스크립트 → 첫 capture → 화면마다 짚기(+사진) → 처음 스크롤로 되돌림 → 마지막 capture + 짚기 합치기.
 * 보이는 창(앱 안의 브라우저 등)은 scroll: false로 — 사람이 보는 화면을 넘기지 않고 지금 화면만 짚는다 (다른 화면의 항목은 hit: null).
 * @param {Electron.WebContents} wc
 * maskValues: 사람이 적은 값은 "(filled)"/"(empty)"만 · dropQuery: 주소의 ?뒤 · #뒤 빼기 (둘 다 페이지 안에서 — 값이 밖으로 안 나옴) · totalMs: 전체 시간 상한(기본 30초)
 * @param {{ screens?: number, scroll?: boolean, shots?: boolean, settleMs?: number, maskValues?: boolean, dropQuery?: boolean, totalMs?: number }} [o]
 * @returns {Promise<{ capture: import("../../core/capture").Capture, images: Array<{ scrollY: number, jpeg: Buffer, w: number, h: number }>, firstItems: number }>}
 */
export function captureFrom(wc, o = {}) {
  // 전체 시간 상한 (v0.1.3 — 한 번에 8초 × 여러 번이 쌓이지 않게). 숨은 창은 부른 쪽이 창을 닫아 멈추고, 보이는 창은 몇 번 안 불러요
  return withTimeout(captureInner(wc, o), o.totalMs ?? 30000, "capture");
}

/** 걸음 스크립트가 돌려준 JSON — 너무 크면 읽지 않음 (적대적인 페이지가 메모리를 채우지 않게, v0.1.3) */
const MAX_JSON = 12_000_000;
const parseJson = (s) => {
  if (typeof s !== "string" || s.length > MAX_JSON) throw new Error(`walker returned ${typeof s === "string" ? `${s.length} chars` : typeof s} (limit ${MAX_JSON})`);
  return JSON.parse(s);
};

async function captureInner(wc, { screens = 8, scroll = true, shots = false, settleMs = 450, maskValues = false, dropQuery = false } = {}) {
  const run = (code, ms = 8000) => withTimeout(wc.executeJavaScriptInIsolatedWorld(WORLD, [{ code }]), ms, "script");
  // 적은 값 가리기 · 주소 ?뒤 빼기는 페이지 안에서 (값이 페이지 밖으로 아예 안 나오게 — v0.1.3)
  const CAPTURE = `__grid.capture(${JSON.stringify({ maskValues: maskValues === true, dropQuery: dropQuery === true })})`;
  await run(WALKER);
  const first = parseJson(await run(CAPTURE));
  // 가리기를 부탁했는데 옛 걸음(같은 세계에 먼저 들어간 v1)이 답했으면 쓰지 않는다 — 값이 가려지지 않았을 수 있다
  if ((maskValues || dropQuery) && !first.privacy) throw new Error("walker is too old for maskValues/dropQuery — reload the page");
  const vh = first.viewport.h;
  const { x: startX, y: startY } = first.scroll;
  const results = [];
  const images = [];
  let pageH = first.page.h;
  try {
    // 넘기다 늦게 뜨는 내용으로 페이지가 길어지면 짚을 화면도 늘어난다 (screens까지)
    for (let k = 0; k < (scroll ? Math.max(1, Math.min(screens, Math.ceil(pageH / vh))) : 1); k++) {
      if (scroll) {
        await run(`scrollTo({ top: ${k * vh}, left: 0, behavior: "instant" }); 1`);
        await sleep(settleMs);
      }
      await run(FRAME);
      const ht = parseJson(await run("__grid.hitTest()"));
      results.push(ht);
      if (shots) {
        const img = await withTimeout(wc.capturePage(), 8000, "capture");
        images.push({ scrollY: ht.scrollY, jpeg: img.toJPEG(80), w: img.getSize().width, h: img.getSize().height });
      }
      if (scroll) pageH = Math.max(pageH, parseJson(await run(PAGE_H)).h);
    }
  } finally {
    // 잘못돼도 처음 보던 자리로 (보이는 창이면 사람이 보던 곳)
    if (scroll) {
      await run(`scrollTo({ top: ${startY}, left: ${startX}, behavior: "instant" }); 1`).catch(() => {});
      await sleep(300);
    }
  }
  const capture = mergeHits(parseJson(await run(CAPTURE)), results);
  if (shots) capture.shots = images.map(({ scrollY, w, h }, i) => ({ file: `shot-${i + 1}.jpg`, scrollY, w, h }));
  return { capture, images, firstItems: first.items.length };
}

/**
 * 숨은 창으로 주소를 읽는 읽기 도구. http/https 주소만 (시험 페이지 폴더를 주면 gridfix://fixture/…도).
 * @param {{ partition?: string, fixturesDir?: string | null, viewport?: { w: number, h: number }, screens?: number }} [o]
 */
export function createReader({ partition = "grid-reader", fixturesDir = null, viewport = VIEWPORT, screens = 8 } = {}) {
  const ses = readerSession({ partition, fixturesDir });
  const { net } = sessions.get(ses);
  const allowed = (url) => topAllowed(url) || (!!fixturesDir && /^gridfix:\/\/fixture\//.test(url));
  return {
    session: ses,
    /**
     * @param {string} url
     * @param {{ shots?: boolean, screens?: number, loadMs?: number, fresh?: boolean }} [o] fresh: 읽기 전에 쿠키 · 저장소를 비움 (읽기끼리 섞이지 않게)
     */
    async read(url, { shots = false, screens: n = screens, loadMs = 30000, fresh = false } = {}) {
      const t0 = Date.now();
      if (!allowed(url)) return { ok: false, error: "grid reader: only public http/https pages (no local or private addresses, file/chrome pages, or URLs with a username or password)", ms: 0, loadError: null };
      if (fresh) {
        await ses.closeAllConnections();
        await ses.clearStorageData();
        await ses.clearCache();
        await ses.clearAuthCache();
      }
      const win = new BrowserWindow({
        show: false,
        width: viewport.w,
        height: viewport.h,
        useContentSize: true,
        paintWhenInitiallyHidden: true,
        webPreferences: {
          session: ses,
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          webviewTag: false,
          disableDialogs: true,
          backgroundThrottling: false,
          spellcheck: false,
          navigateOnDragDrop: false,
          autoplayPolicy: "document-user-activation-required",
        },
      });
      const wc = win.webContents;
      const id = wc.id;
      wc.setAudioMuted(true);
      wc.setWebRTCIPHandlingPolicy("disable_non_proxied_udp"); // WebRTC로 이 컴퓨터 안 주소가 새지 않게
      wc.setWindowOpenHandler(() => ({ action: "deny" }));
      wc.on("will-prevent-unload", (e) => e.preventDefault());
      // 페이지가 넘어가려는 주소도 같은 규칙으로 (file · chrome · 이 컴퓨터 안 주소로 못 감)
      wc.on("will-navigate", (e) => allowed(e.url) || e.preventDefault());
      wc.on("will-redirect", (e) => allowed(e.url) || e.preventDefault());
      // 인증서를 달라는 사이트에 이 컴퓨터의 인증서를 자동으로 내주지 않음
      wc.on("select-client-certificate", (e, _u, _list, cb) => {
        e.preventDefault();
        cb();
      });
      const log = { url, loadError: null, status: null };
      // 맨 위 페이지의 HTTP 응답 번호 (404 · 500 같은 것을 알려 주려고)
      wc.on("did-navigate", (_e, _u, code) => {
        log.status = code;
      });
      try {
        try {
          await withTimeout(wc.loadURL(url), loadMs, "load");
        } catch (e) {
          log.loadError = String(e.message || e).slice(0, 200);
        }
        log.quietMs = await net.quiet(id);
        log.loadMs = Date.now() - t0;
        log.finalUrl = wc.getURL();
        const { capture, images, firstItems } = await captureFrom(wc, { screens: n, shots, totalMs: 90_000 });
        capture.log = { ...log, blocked: net.blocked.get(id) || 0, totalMs: Date.now() - t0, firstItems };
        return { ok: true, capture, text: format(capture, "A"), images, ms: Date.now() - t0 };
      } catch (e) {
        return { ok: false, error: String(e.message || e).slice(0, 300), ms: Date.now() - t0, loadError: log.loadError, blocked: net.blocked.get(id) || 0 };
      } finally {
        win.destroy();
        net.forget(id);
      }
    },
  };
}
