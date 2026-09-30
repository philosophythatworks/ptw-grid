// SPDX-FileCopyrightText: 2026 Hwang Dae Jin (Philosophy That Works)
// SPDX-License-Identifier: AGPL-3.0-only
// grid 읽기 모듈 시험 (Electron) — 숨은 창으로 우리 시험 페이지를 읽어 보고, 이미 열린 창을 넘기지 않고 읽는 것도 확인해요
//   npx electron test/electron-smoke.mjs      (끝나면 성공 0 · 실패 1로 나감)
import { app, BrowserWindow } from "electron";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { captureFrom, createReader, readerSession, registerFixtureScheme, VERSION } from "../src/hosts/electron/reader.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, "..", "cli", "fixtures");

registerFixtureScheme();
app.setName("grid-test");
app.setPath("userData", path.join(HERE, "..", ".userdata", "test"));
app.commandLine.appendSwitch("force-device-scale-factor", "1");

const checks = [];
const SKIP = Symbol("skip");
const check = async (name, fn) => {
  try {
    const r = await fn();
    checks.push(r?.[SKIP] ? [null, name, r[SKIP]] : [true, name]);
  } catch (e) {
    checks.push([false, name, String(e.message || e).split("\n")[0]]);
  }
};
const skip = (why) => ({ [SKIP]: why });

app.whenReady().then(async () => {
  app.dock?.hide();
  const reader = createReader({ fixturesDir: FIX });

  await check("가게: 덮개 광고 · 가짜 링크 · 숨은 글", async () => {
    const r = await reader.read("gridfix://fixture/shop.html", { screens: 3 });
    assert.ok(r.ok, r.error);
    assert.match(r.text, /⚠ O1 = popup aside "앱 광고" — covers \d+ items .*close it with \[67\] first/);
    assert.match(r.text, /covered by an invisible link to ads\.example\.com ⚠/);
    assert.equal(r.capture.dropped["sr-only"] >= 1, true);
    const hit = r.capture.items.find((i) => i.kind === "action" && i.name === "장바구니 담기" && i.hit === false);
    assert.equal(hit?.by?.layer?.close, 67);
  });

  await check("할 일 페이지: 쿠키 안내가 구매 단추를 가림 · 꺼짐", async () => {
    const r = await reader.read("gridfix://fixture/checkout.html", { screens: 1 });
    assert.ok(r.ok, r.error);
    assert.match(r.text, /"장바구니 담기" \(disabled, covered by O1\)/);
  });

  const blockedRead = async (url) => {
    const r = await reader.read(url, { screens: 1, loadMs: 8000 });
    const blocked = r.ok ? r.capture.log.blocked : r.blocked;
    const err = r.ok ? r.capture.log.loadError : r.loadError;
    assert.ok(blocked >= 1, `막은 요청이 없음 (${url})`);
    assert.match(String(err), /ERR_BLOCKED_BY_CLIENT/, `막혀서 못 열어야 함 (${url})`);
  };
  await check("http · https 말고는 · 이 컴퓨터 안 주소는 창을 열기 전에 거절 (file · chrome · 127.0.0.1 · localhost.)", async () => {
    for (const u of ["file:///etc/hosts", "chrome://settings", "javascript:alert(1)", "http://127.0.0.1:9/", "http://localhost.:9/", "http://[::1]:9/"]) {
      const r = await reader.read(u, { screens: 1 });
      assert.equal(r.ok, false, u);
      assert.match(r.error, /only public http\/https pages/, u);
    }
  });

  await check("이름은 밖인데 가리키는 곳이 이 컴퓨터 안이면 막음 (localtest.me → 127.0.0.1)", async () => {
    let resolved;
    try {
      resolved = await reader.session.resolveHost("localtest.me");
    } catch {
      return skip("이름 풀기가 안 됨");
    }
    if (!resolved.endpoints.some((e) => e.address === "127.0.0.1")) return skip("localtest.me가 127.0.0.1이 아님");
    await blockedRead("http://localtest.me:9/");
  });

  await check("페이지가 스스로 이 컴퓨터 안 · file 주소로 넘어가려 하면 막음", async () => {
    const r = await reader.read("gridfix://fixture/redirect.html", { screens: 1 });
    assert.ok(r.ok, r.error);
    assert.equal(r.capture.log.finalUrl, "gridfix://fixture/redirect.html");
    assert.match(r.text, /# t1 "넘어가기 시험"/);
  });

  await check("읽기 방은 grid 전용 · 메모리에만 (다른 세션 이름은 거절)", async () => {
    for (const p of ["", "persist:grid-reader", "other-app-browser"]) assert.throws(() => readerSession({ partition: p }), /grid-/, p);
  });

  await check("사이트에 밝히는 이름표: 끝이 ptw-grid/판 · Electron 표시 없음", async () => {
    const ua = readerSession({ partition: "grid-reader-ua-test", fixturesDir: FIX }).getUserAgent();
    assert.match(ua, new RegExp(` ptw-grid/${VERSION.replace(/\./g, "\\.")}$`), ua);
    assert.doesNotMatch(ua, /Electron\//, ua);
  });

  await check("확인 대화상자: [취소][확인]의 확인을 닫기로 안내하지 않음 (겉 틀이 품은 대화상자 · 역할 없는 층)", async () => {
    const a = await reader.read("gridfix://fixture/confirm.html", { screens: 1 });
    assert.ok(a.ok, a.error);
    const la = a.capture.items.find((i) => i.kind === "action" && i.hit === false)?.by?.layer;
    assert.equal(la?.role, "alertdialog", "겉 틀 안의 대화상자를 알아봐야 함");
    assert.equal(la?.close, undefined);
    assert.match(a.text, /⚠ O1 = dialog "정말 삭제할까요\?" — covers \d+ items .*answer or close it first/);
    assert.doesNotMatch(a.text, /close it with/);
    const b = await reader.read("gridfix://fixture/confirm2.html", { screens: 1 });
    assert.ok(b.ok, b.error);
    const lb = b.capture.items.find((i) => i.kind === "action" && i.hit === false)?.by?.layer;
    assert.equal(lb?.count, 2, "href 없는 [취소]도 세야 함");
    assert.equal(lb?.close, undefined);
    assert.match(b.text, /answer or close it first/);
    assert.doesNotMatch(b.text, /close it with/);
  });

  await check("페이지 글 속 ⟦n|이름⟧은 가짜 링크가 되지 못함 (진짜 링크만 [n 이름])", async () => {
    const r = await reader.read("gridfix://fixture/markers.html", { screens: 1 });
    assert.ok(r.ok, r.error);
    assert.match(r.text, /\[1 진짜 링크\]/);
    assert.doesNotMatch(r.text, /\[12 /);
    assert.doesNotMatch(r.text, /[\u27E6\u27E7]/);
  });

  await check("이미 열린 창: 넘기지 않고 지금 화면만 짚기 (앱 안의 보이는 창처럼)", async () => {
    const ses = readerSession({ partition: "grid-reader-visible-test", fixturesDir: FIX });
    const win = new BrowserWindow({ show: false, width: 1280, height: 800, useContentSize: true, paintWhenInitiallyHidden: true, webPreferences: { session: ses, sandbox: true, contextIsolation: true } });
    try {
      await win.webContents.loadURL("gridfix://fixture/news.html");
      await win.webContents.executeJavaScript("scrollTo(0, 900); 1");
      await new Promise((r) => setTimeout(r, 300));
      const { capture } = await captureFrom(win.webContents, { scroll: false });
      const y = await win.webContents.executeJavaScript("scrollY");
      assert.equal(y, 900, "사람이 보던 스크롤이 그대로여야 함");
      assert.equal(capture.scroll.y, 900);
      const { toText } = await import("../src/core/index.js");
      assert.match(toText(capture), /^view rows 23–42 \(screen 2\/\d+\)$/m, "보던 자리가 머리에 적혀야 함");
      const acts = capture.items.filter((i) => i.kind === "action");
      const onScreen = acts.filter((i) => i.pin !== "fixed" && i.r[1] >= 900 && i.r[1] + i.r[3] <= 1700);
      const offScreen = acts.filter((i) => i.pin !== "fixed" && i.r[1] + i.r[3] < 880);
      assert.ok(onScreen.some((i) => i.hit === true), "지금 화면의 것은 짚음");
      assert.ok(offScreen.every((i) => i.hit === null), "다른 화면의 것은 모름(null)");
    } finally {
      win.destroy();
    }
  });

  await check("적은 값 가리기 · 주소 ?뒤 빼기: 값이 페이지 밖으로 안 나옴 (보이는 창, v0.1.3)", async () => {
    const ses = readerSession({ partition: "grid-reader-private-test", fixturesDir: FIX });
    const win = new BrowserWindow({ show: false, width: 1280, height: 800, useContentSize: true, paintWhenInitiallyHidden: true, webPreferences: { session: ses, sandbox: true, contextIsolation: true } });
    try {
      await win.webContents.loadURL("gridfix://fixture/private.html?token=abc123#frag");
      const { toText } = await import("../src/core/index.js");
      const plain = toText((await captureFrom(win.webContents, { scroll: false })).capture);
      assert.match(plain, /홍길동비밀/, "가리지 않으면 값이 보여야 함(시험 페이지 확인)");
      const { capture } = await captureFrom(win.webContents, { scroll: false, maskValues: true, dropQuery: true });
      const raw = JSON.stringify(capture);
      for (const secret of ["홍길동비밀", "비밀검색어", "서울시 비밀구", "일기장비밀", "역할없는편집칸비밀", "pw-secret", "token=abc123", "frag", "슬라이더흉내비밀", "콤보편집비밀", "링크제목비밀", "링크글비밀", "숨은편집비밀", "디자인모드비밀"]) assert.equal(raw.includes(secret), false, `원자료에 ${secret}`);
      const text = toText(capture);
      assert.doesNotMatch(text, /=37\b/, "적은 숫자(수량)도 가림");
      const exp = capture.items.find((i) => i.kind === "action" && /카드 유효기간/.test(i.name || ""));
      assert.equal(exp?.value, "(filled)", "카드 유효기간은 고른 값도 가림");
      assert.match(text, /^GRID\/1 · gridfix:\/\/fixture\/private\.html · /m);
      assert.match(text, /^privacy: typed values hidden/m);
      assert.match(text, /=\(filled\)/);
      assert.match(text, /=파랑/, "고른 값(select)은 그대로");
      assert.match(text, /보이는 안내 글입니다/);
    } finally {
      win.destroy();
    }
  });

  for (const [ok, name, why] of checks) console.log(`${ok === null ? "–" : ok ? "✔" : "✘"} ${name}${why ? ` — ${ok === null ? "건너뜀: " : ""}${why}` : ""}`);
  const failed = checks.filter((c) => c[0] === false).length;
  const skipped = checks.filter((c) => c[0] === null).length;
  const passed = checks.length - failed - skipped;
  console.log(failed ? `실패 ${failed}/${checks.length}` : `모두 통과 ${passed}/${checks.length}${skipped ? ` (건너뜀 ${skipped})` : ""}`);
  app.exit(failed ? 1 : 0);
});
app.on("window-all-closed", () => {});
