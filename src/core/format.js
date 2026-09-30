// SPDX-FileCopyrightText: 2026 Hwang Dae Jin (Philosophy That Works)
// SPDX-License-Identifier: AGPL-3.0-only
// grid — 원자료(capture/1)를 모델이 읽는 글로 (순수 계산, 의존성 없음)
//
// 네 가지 형식 (A가 GRID/1, B · C · D는 비교 실험용):
//   A  GRID/1   — 가로 12칸 A–L · 페이지 기준 40px 줄 · 한 화면 = 20줄 · 항목마다 @칸
//   B  칸 없음   — A에서 @칸만 뺌 (영역 · 읽는 순서 · 화면 구분 · 검사 결과는 그대로)
//   C  % 가운데점 — A의 @칸 대신 @x,y (페이지 너비 · 높이의 %)
//   D  그냥 목록 — 널리 쓰는 꼴 ([n] 종류 "이름"), 영역 · 자리 · 화면 · 검사 없음 (기준선)
// 넷 다 같은 줄이기 규칙과 같은 숨은 글 격리를 쓴다 → 차이는 "자리를 어떻게 알려 주느냐"뿐.

export const COLS = 12;
const TEXT_CHARS = 200;
export const ROW_H = 40;
const LETTERS = "ABCDEFGHIJKL";

const REGION_LABEL = {
  banner: "header", navigation: "nav", main: "main", complementary: "aside", contentinfo: "footer",
  search: "search", form: "form", region: "section", dialog: "dialog", alertdialog: "dialog",
};

/** 모델에게 한 번 주는 설명 (형식마다) */
export const LEGEND = {
  // SPDX-SnippetBegin
  // SPDX-SnippetCopyrightText: 2026 Hwang Dae Jin (Philosophy That Works)
  // SPDX-License-Identifier: CC0-1.0
  // (GRID/1 읽는 법 문단 — 누구나 자유롭게 프롬프트 · 다른 구현에 붙여 써도 돼요)
  A: [
    "The page is one tall sheet. Columns A–L split the window width into 12 equal parts.",
    "Rows are 40-px bands counted from the top of the page and keep counting down; one screen is 20 rows (screen 2 = rows 21–40).",
    "\"@E6-F7\" is the box an item covers (top-left cell to bottom-right cell). Items under \"pinned\" stay in the window while scrolling; their @v cells count rows from the window top.",
    "[n] is an element you can act on; the number never changes while the page is open. Act by number; never compute positions.",
    "\"covered by O1\" means another layer sits on top of it; the ⚠ line for O1 says what it is and how to get past it.",
  ].join(" "),
  // SPDX-SnippetEnd
  B: [
    "The page is listed in reading order, grouped by region; \"── screen k ──\" marks where each window-height of the page begins.",
    "Items under \"pinned\" stay in the window while scrolling.",
    "[n] is an element you can act on; the number never changes while the page is open. Act by number.",
    "\"covered by O1\" means another layer sits on top of it; the ⚠ line for O1 says what it is and how to get past it.",
  ].join(" "),
  C: [
    "The page is listed in reading order, grouped by region. \"@x,y\" is an item's center as a percentage of the whole page's width and height (0–100; y=50 is halfway down the page).",
    "\"── screen k ──\" marks where each window-height of the page begins. Items under \"pinned\" stay in the window; their @v x,y is a percentage of the window.",
    "[n] is an element you can act on; the number never changes while the page is open. Act by number; never compute positions.",
    "\"covered by O1\" means another layer sits on top of it; the ⚠ line for O1 says what it is and how to get past it.",
  ].join(" "),
  D: "[n] is an element you can act on. Act by number.",
};

/** 이 원자료에 맞춘 읽는 법 — 창 높이가 800px이 아니면 "한 화면 = N줄"을 바꿔 적는다 */
export function legendFor(cap, arm = "A") {
  const rows = Math.max(1, Math.floor((cap?.viewport?.h || 800) / ROW_H));
  return LEGEND[arm].replace("one screen is 20 rows (screen 2 = rows 21–40)", `one screen is ${rows} rows (screen 2 = rows ${rows + 1}–${rows * 2})`);
}

const col = (x, w) => LETTERS[Math.max(0, Math.min(COLS - 1, Math.floor(x / (w / COLS))))];
const row = (y) => Math.max(1, Math.floor(y / ROW_H) + 1);
const cell = (x, y, w) => `${col(x, w)}${row(y)}`;

/** 항목의 칸 (한 칸이면 "E6", 여러 칸이면 "E6-F7") */
export function spanOf(r, w, v = false) {
  const [x, y, rw, rh] = r;
  const a = cell(x, y, w);
  const b = cell(x + Math.max(0, rw - 1), y + Math.max(0, rh - 1), w);
  const p = v ? "v" : "";
  return a === b ? `${p}${a}` : `${p}${a}-${p}${b}`;
}
const pct = (r, W, H) => `${Math.round(((r[0] + r[2] / 2) / W) * 100)},${Math.round(((r[1] + r[3] / 2) / H) * 100)}`;

/**
 * 보이지 않는 글자 — AI를 속이는 숨은 글에 쓰임: 서식 문자 전부(\p{Cf}: 폭 없는 글자 · 양방향 제어 · 태그 문자 U+E0000–E007F · 소프트 하이픈 …) ·
 * 모양 선택 글자(U+FE00–FE0F · U+E0100–E01EF, "이모지 밀수") · 한글 채움 문자(U+115F · U+1160 · U+3164 · U+FFA0) · CGJ(U+034F, combining grapheme joiner) · 몽골 모양 선택(U+180B–180F)
 */
export const INVISIBLE = /[\p{Cf}\u{E0000}-\u{E007F}\uFE00-\uFE0F\u{E0100}-\u{E01EF}\u115F\u1160\u3164\uFFA0\u034F\u180B-\u180F]/gu;
/** 제어 문자 (빈칸 · 줄바꿈 말고) — ESC 같은 것이 터미널 화면을 흔들지 못하게 · NEL(U+0085) 포함 */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
/** 셀 때는 빼 줌: 이모지 뒤의 모양 선택(❤️) · 이모지 사이의 잇기(👨‍👩‍👧) — 보통 이모지를 숨은 글자로 잘못 세지 않게 (지우기는 함) */
const EMOJI_OK = /(\p{Extended_Pictographic})[\uFE0E\uFE0F]|(\p{Extended_Pictographic})\u200D(?=\p{Extended_Pictographic})/gu;
/** 글자(코드 포인트) 수로 자름 — 이모지가 반으로 잘려 깨진 글자(외톨이 서로게이트)가 남지 않게 */
const short = (s, n) => {
  const a = [...s];
  return a.length > n ? `${a.slice(0, n - 1).join("")}…` : s;
};
/** 페이지에서 온 글 한 조각: 보이지 않는 글자 빼기 · 줄바꿈과 빈칸은 한 칸으로 · 길이 제한 (따옴표 없이 적는 곳에도 — 가짜 줄을 만들지 못하게) */
export const pageStr = (s, n = 300) => short(String(s ?? "").replace(/\s+/g, " ").replace(CONTROL, "").replace(INVISIBLE, ""), n);
/** 페이지에서 온 글은 늘 따옴표 안에 한 줄로 (" 는 ' 로) */
const q = (s, n = 300) => `"${pageStr(s, n).replace(/"/g, "'")}"`;
/** 태그 · id · 역할 같은 이름표: 영숫자와 # . _ - 만 */
const token = (s, n = 40) => String(s ?? "").replace(/[^\w#.-]/g, "").slice(0, n);
/** 원자료 속 보이지 않는 글자 수 (checks 줄에 적음) */
export function countInvisible(cap) {
  let n = 0;
  const add = (v) => {
    if (typeof v !== "string") return;
    const s = v.replace(/\s+/g, " ").replace(EMOJI_OK, "$1$2");
    n += (s.match(INVISIBLE) || []).length + (s.match(CONTROL) || []).length;
  };
  add(cap.title);
  add(cap.facts?.product?.name);
  for (const r of cap.regions || []) add(r.name);
  for (const it of cap.items || []) {
    add(it.name);
    add(it.text);
    add(it.value);
    for (const o of it.options || []) add(o);
  }
  return n;
}

/** 덮개 안의 "닫기" 단추로 볼 이름 (쿠키 "모두 허용" 같은 선택은 닫기로 치지 않는다 — 고르는 건 사람 몫). src/page/walker.js와 같게 */
export const CLOSE_NAME = /^(닫기|창\s?닫기|close|dismiss|×|✕|✖|x|오늘\s?하루\s?(보지|열지)\s?않기|다시\s?보지\s?않기|그만\s?보기)$/i;
/** "확인 · OK"는 단추가 하나뿐인 알림 층(대화상자 아님)에서만 닫기로 — 대화상자의 [취소][확인]에서 확인은 "예"라는 대답 */
export const ACK_NAME = /^(확인|알겠습니다|ok|okay|got it)$/i;

/** 가린 것 이름: [n] · 투명한 가짜 링크 · 이름표 붙은 덮개 · 태그 (덮개 층은 format 안에서 O1 · O2로 따로 적는다) */
export function covererText(by) {
  if (!by) return "something";
  if (by.n) return `[${by.n}]`;
  if (by.invisible) return by.link ? `an invisible link${by.host ? ` to ${String(by.host).replace(/[^\w.:[\]-]/g, "").slice(0, 80)}` : ""} ⚠` : "an invisible layer ⚠";
  if (by.label) return q(by.label, 60);
  return token(by.tag) || "something";
}

/** 모든 형식이 같이 쓰는 줄이기: 메뉴 · 바닥의 링크가 많으면 앞의 8개만 (정답 문제는 보이는 항목에서만 낸다) */
export function prune(cap, { navLinks = 8, maxItems = 450, screen = 0, view = false } = {}) {
  const regionRole = new Map(cap.regions.map((r) => [r.id, r.role]));
  const linkCount = new Map();
  const kept = [];
  const collapsed = new Map(); // 영역 → 줄인 링크들 (자리 없이 이름과 번호만 짧게 적는다)
  for (const it of cap.items) {
    const rr = regionRole.get(it.region);
    if (it.kind === "action" && it.role === "link" && (rr === "navigation" || rr === "contentinfo")) {
      const c = (linkCount.get(it.region) || 0) + 1;
      linkCount.set(it.region, c);
      if (c > navLinks) {
        if (!collapsed.has(it.region)) collapsed.set(it.region, []);
        collapsed.get(it.region).push(it);
        continue;
      }
    }
    kept.push(it);
  }
  if (screen || view) {
    // 한 화면만 온전히 (고정된 것은 늘 · 붙어 다니는 것은 그 화면에 걸치면)
    // view (v0.1.4): 화면 칸이 아니라 사람이 실제로 보던 창 높이 그대로 (창이 두 화면에 걸쳐 있어도 본 줄이 빠지지 않게)
    const SPx = Math.max(1, Math.floor(cap.viewport.h / ROW_H)) * ROW_H;
    const vy = Math.max(0, cap.scroll?.y || 0);
    const on = view
      ? (it) => it.pin === "fixed" || (it.r[1] + it.r[3] > vy && it.r[1] < vy + cap.viewport.h)
      : (it) => it.pin === "fixed" || Math.max(1, Math.floor(it.r[1] / SPx) + 1) === screen;
    const keep = new Set(kept.filter(on));
    for (const [rid, list] of collapsed) {
      const l = list.filter(on);
      if (l.length) collapsed.set(rid, l);
      else collapsed.delete(rid);
    }
    return { items: kept.filter((it) => keep.has(it)), collapsed, over: 0, cutScreen: 0 };
  }
  if (kept.length <= maxItems) return { items: kept, collapsed, over: 0, cutScreen: 0 };
  // 너무 길면: **앞 화면들은 온전히**, 그 뒤는 제목(차례)과 고정된 것만 (화면 먼저 · 나머지는 화면 번호로 더 읽기)
  const SP = Math.max(1, Math.floor(cap.viewport.h / ROW_H)) * ROW_H; // 한 화면 = 창 높이를 40px 줄로 내린 것 (800px → 20줄)
  const screenOf = (it) => Math.max(1, Math.floor(it.r[1] / SP) + 1); // 페이지 위로 벗어난 것(음수 y)은 1화면으로
  const always = (it) => it.pin === "fixed" || it.pin === "sticky";
  const perScreen = new Map();
  for (const it of kept) if (!always(it)) perScreen.set(screenOf(it), (perScreen.get(screenOf(it)) || 0) + 1);
  let budget = maxItems - kept.filter(always).length;
  let cutScreen = 1;
  const last = Math.max(...perScreen.keys(), 1);
  for (let sc = 1; sc <= last; sc++) {
    const c = perScreen.get(sc) || 0;
    if (sc > 1 && c > budget) break;
    budget -= c;
    cutScreen = sc;
  }
  const items = kept.filter((it) => always(it) || screenOf(it) <= cutScreen || it.kind === "heading");
  return { items, collapsed, over: kept.length - items.length, cutScreen };
}

const MARK = /\u27E6(\d+)\|([^\u27E7]*)\u27E7/g;
/** 문단 속 링크 표시 ⟦n|이름⟧ → [n 이름] (+ 가려졌으면 ⚠O1) — 자른 뒤 남은 번호도 돌려준다 */
function inlineText(text, limit, mark = () => "") {
  const rendered = String(text).replace(MARK, (_, n, name) => `[${n} ${name}${mark(+n)}]`).replace(/\s+/g, " ").replace(/\] ([,.;:!?)」』])/g, "]$1").trim();
  const shown = short(rendered, limit);
  const kept = new Set([...shown.matchAll(/\[(\d+) /g)].map((m) => +m[1]));
  return { shown, kept };
}

/** capture(+ 짚기 결과) → 형식 A/B/C/D 글 */
/**
 * @param {object} cap 원자료 (capture/1)
 * @param {"A"|"B"|"C"|"D"} [arm] 형식 (기본 A = GRID/1)
 * @param {{ maxItems?: number, screen?: number, view?: boolean }} [opts] maxItems: 긴 페이지를 줄이는 항목 수 (기본 450) · screen: 이 화면만 온전히 · view: 사람이 보던 창 높이만 온전히 (v0.1.4)
 */
export function format(cap, arm = "A", opts = {}) {
  const W = cap.viewport.w;
  const VH = cap.viewport.h;
  const PW = cap.page.w;
  const PH = cap.page.h;
  const screenRows = Math.max(1, Math.floor(VH / ROW_H)); // 한 화면의 줄 수 (800px → 20)
  const SP = screenRows * ROW_H; // 한 화면의 높이 (줄에 맞춤)
  const screens = Math.max(1, Math.ceil(PH / SP));
  const totalRows = Math.ceil(PH / ROW_H);
  const { items, collapsed, over, cutScreen } = prune(cap, { maxItems: opts.maxItems ?? 450, screen: opts.screen || 0, view: !!opts.view });
  const regions = new Map(cap.regions.map((r) => [r.id, r]));
  const screenOf = (it) => Math.max(1, Math.floor(it.r[1] / SP) + 1); // 페이지 위로 벗어난 것(음수 y)은 1화면으로
  // 읽은 순간 보이던 곳 (숨은 창은 맨 위 · 보이는 창은 사람이 보던 자리)
  const vy = Math.max(0, cap.scroll?.y || 0);
  const inView = (i) => i.pin === "fixed" || (i.r[1] + i.r[3] > vy && i.r[1] < vy + VH);
  const lines = [];
  const pos = (it) => {
    // 슬라이드 · 스크롤 상자 밖으로 잘려 안 보이는 것은 자리를 적지 않는다 (적으면 엉뚱한 곳을 가리킴)
    if (it.clipped || it.scHidden) return "";
    if (arm === "A") return it.pin === "fixed" ? ` @${spanOf([it.r[0], it.r[1] - cap.scroll.y, it.r[2], it.r[3]], W, true)}` : ` @${spanOf(it.r, W)}`;
    if (arm === "C") return it.pin === "fixed" ? ` @v${pct([it.r[0], it.r[1] - cap.scroll.y, it.r[2], it.r[3]], W, VH)}` : ` @${pct(it.r, PW, PH)}`;
    return "";
  };

  // ── 덮개 층 (O1 · O2 …): 누를 것을 가린 것이 고정된 층 · 대화상자이면 "covered by O1"로 적고, 머리에 무엇인지 · 어떻게 비키는지 한 번 적는다 ──
  const byN = new Map(cap.items.filter((i) => i.kind === "action").map((i) => [i.n, i]));
  const pinnedRegion = new Set(cap.items.filter((i) => i.pin === "fixed" && i.region != null).map((i) => i.region));
  const closeIn = (regionId) => {
    const acts = cap.items.filter((i) => i.kind === "action" && i.region === regionId);
    const strict = acts.find((i) => CLOSE_NAME.test(String(i.name).trim()));
    if (strict) return strict.n;
    const role = regions.get(regionId)?.role;
    return acts.length === 1 && role !== "dialog" && role !== "alertdialog" && ACK_NAME.test(String(acts[0].name).trim()) ? acts[0].n : undefined;
  };
  const modal = [...cap.regions].reverse().find((r) => r.modal); // 겹쳐 열려 있으면 맨 뒤(맨 위에 뜬) 것
  const regionText = (role, name) => `${REGION_LABEL[role] || token(role, 24) || "layer"}${name ? ` ${q(name, 60)}` : ""}`;
  // 층의 종류: 대화상자(답하거나 닫기) · 팝업(닫기 단추가 있음) · 고정 바(닫을 수 없음 — 넘겨서 비키기)
  const layerInfo = (key, role, name, close, acts, h) => {
    const kind = role === "dialog" || role === "alertdialog" ? "dialog" : close || (h || 0) >= VH / 4 ? "popup" : "bar";
    let text = kind === "dialog" ? `dialog${name ? ` ${q(name)}` : ""}` : kind === "popup" ? `popup ${regionText(role, name)}` : `pinned bar${name ? ` ${q(name)}` : ""}`;
    if (!name && acts?.length) text += ` with ${acts.map((n) => `[${n}] ${q(short(String(byN.get(n)?.name ?? ""), 16))}`).join(" · ")}`;
    const how = kind === "bar" ? "it stays on screen — scroll until they are clear of it" : close ? `close it with [${close}] first` : "answer or close it first";
    return { key, text, close, how };
  };
  const layerOf = (by) => {
    if (!by) return null;
    if (by.layer) {
      const L = by.layer;
      if (L.pin !== "fixed" && L.role !== "dialog" && L.role !== "alertdialog") return null;
      if (!L.name && !(L.acts || []).length && modal) return layerInfo(`R|${modal.id}`, modal.role, modal.name, closeIn(modal.id), null, modal.r?.[3]);
      return layerInfo(`L|${L.role}|${L.name}|${(L.acts || []).join(",")}`, L.role, L.name, L.close, L.acts, L.h);
    }
    // 예전 원자료: 번호 → 그 번호의 영역 · 이름표 → 같은 이름의 영역
    let reg = null;
    if (by.n) {
      const a = byN.get(by.n);
      reg = a && a.region != null ? regions.get(a.region) : null;
    } else if (by.label) reg = cap.regions.find((r) => r.name && r.name === by.label) || null;
    if (!reg) return null;
    const layer = reg.pin === "fixed" || pinnedRegion.has(reg.id) || reg.role === "dialog" || reg.role === "alertdialog" || reg.modal;
    return layer ? layerInfo(`R|${reg.id}`, reg.role, reg.name, closeIn(reg.id), null, reg.r?.[3]) : null;
  };
  const overlays = new Map(); // key → { id, text, close, count, first }
  const coverText = (it) => {
    const lay = layerOf(it.by);
    if (lay) {
      let o = overlays.get(lay.key);
      if (!o) overlays.set(lay.key, (o = { id: `O${overlays.size + 1}`, ...lay, count: 0, first: 0 }));
      return o.id;
    }
    if (it.by?.n) {
      const a = byN.get(it.by.n);
      return a ? `${a.pin === "fixed" ? "pinned " : a.pin === "sticky" ? "sticky " : ""}[${a.n}] ${q(short(String(a.name), 24))}` : `[${it.by.n}]`;
    }
    return covererText(it.by);
  };
  const allActs = cap.items.filter((i) => i.kind === "action");
  const coveredItems = allActs.filter((i) => i.hit === false);
  const coverOf = new Map(coveredItems.map((i) => [i.n, coverText(i)]));
  for (const i of coveredItems) {
    const lay = layerOf(i.by);
    if (!lay) continue;
    const o = overlays.get(lay.key);
    o.count++;
    if (inView(i)) o.first++;
  }
  // 문단 속 · 접힌 링크에 붙이는 짧은 가림 표시
  const markOf = (n) => (arm === "D" || !coverOf.has(n) ? "" : /^O\d+$/.test(coverOf.get(n)) ? ` ⚠${coverOf.get(n)}` : " ⚠covered");

  const describe = (it) => {
    if (it.kind === "action") {
      const flags = [...(it.states || [])];
      if (it.pin === "sticky" && arm !== "D") flags.push("sticky");
      if (it.hit === false && arm !== "D") flags.push(`covered by ${coverOf.get(it.n)}`);
      if (it.scHidden && arm !== "D") flags.push(`hidden in scroll box S${it.sc} — scroll it`);
      else if (it.clipped && arm !== "D") flags.push("out of view (clipped, e.g. a slider — use its next/prev button)");
      const st = flags.length ? ` (${flags.join(", ")})` : "";
      const val = it.value !== undefined ? ` =${pageStr(it.value, 80)}` : "";
      const opts = it.options?.length ? ` · ${it.options.slice(0, 8).map((o) => pageStr(o, 30)).join("/")}` : "";
      return `[${it.n}] ${token(it.role, 24)} ${q(it.name)}${st}${val}${opts}`;
    }
    if (it.kind === "heading") return arm === "D" ? `heading ${q(inlineText(it.text, 160).shown)}` : `# t${it.t} ${q(inlineText(it.text, 160, markOf).shown)}`;
    if (it.kind === "media") {
      const big = it.r[2] >= 300 && it.r[3] >= 300;
      const warn = !it.name && big && arm !== "D" ? " ⚠ no text — info may be only in the image" : "";
      return arm === "D" ? `${it.role} ${q(it.name || "(no alt)")}` : `${it.role} t${it.t} ${q(it.name || "(no alt)")}${warn}`;
    }
    return arm === "D" ? `text ${q(inlineText(it.text, TEXT_CHARS).shown)}` : `t${it.t} ${q(inlineText(it.text, TEXT_CHARS, markOf).shown)}`;
  };
  // 문단 속에 적힌 링크는 따로 줄로 쓰지 않는다 (잘려서 안 보이게 된 것만 따로)
  const inlineShown = new Set();
  for (const it of items) {
    // 가림 표시를 붙인 채로 잘라야 실제로 적히는 것과 같다 (표시 때문에 뒤 링크가 잘려 나가면 따로 줄로)
    if ((it.kind === "text" || it.kind === "heading") && it.text && !it.onlyLinks) for (const n of inlineText(it.text, it.kind === "heading" ? 160 : TEXT_CHARS, markOf).kept) inlineShown.add(n);
  }
  const skip = (it) => (it.kind === "text" && it.onlyLinks) || (it.kind === "action" && it.inT && inlineShown.has(it.n));

  // ── 머리 ──
  if (arm === "D") {
    lines.push(`PAGE ${pageStr(cap.url)} · ${q(cap.title, 200)}`);
  } else {
    lines.push(`GRID/1${arm === "A" ? "" : `-${arm}`} · ${pageStr(cap.url)} · ${q(cap.title, 200)}`);
    if (arm === "A") lines.push(`sheet A–L × ${ROW_H}px rows from page top · screen = ${screenRows} rows · page ≈ ${(PH / SP).toFixed(1)} screens (rows 1–${totalRows})`);
    else lines.push(`page ≈ ${(PH / SP).toFixed(1)} screens`);
    const vRow = Math.floor(vy / ROW_H) + 1;
    // 보던 화면 = 창 가운데가 걸친 화면 (budget.js viewScreen과 같은 규칙 — v0.1.4)
    const vScreen = Math.min(screens, Math.floor((vy + VH / 2) / SP) + 1);
    if (opts.view) lines.push(arm === "A" ? `this is the part the user was viewing, in full (rows ${vRow}–${vRow + screenRows - 1}, screen ${vScreen}/${screens}) · pinned items are shown too` : "this is the part the user was viewing, in full");
    else if (opts.screen) lines.push(arm === "A" ? `this is screen ${opts.screen}/${screens} in full (rows ${(opts.screen - 1) * screenRows + 1}–${opts.screen * screenRows}) · pinned items are shown too` : `this is screen ${opts.screen}/${screens} in full`);
    else lines.push(arm === "A" ? `view rows ${vRow}–${vRow + screenRows - 1} (screen ${vScreen}/${screens})` : `view: screen ${vScreen}/${screens}`);
    const f = cap.facts || {};
    const facts = [];
    if (f.product) facts.push(`product ${q(f.product.name, 120)}${f.product.price !== undefined ? ` · ${pageStr(f.product.price, 30)} ${pageStr(f.product.currency || "", 10)}`.trimEnd() : ""}${f.product.availability ? ` · ${pageStr(String(f.product.availability).split("/").pop(), 30)}` : ""}`);
    if (f.og?.type) facts.push(`og:type ${pageStr(f.og.type, 30)}`);
    if (facts.length) lines.push(`facts (page metadata): ${facts.join(" · ")}`);
    const acts = allActs.filter((i) => i.hit !== undefined && i.hit !== null);
    const d = cap.dropped || {};
    const hiddenN = ["aria-hidden", "tiny", "transparent", "sr-only", "offscreen", "low-contrast"].reduce((s, k) => s + (k === "aria-hidden" ? 0 : d[k] || 0), 0);
    const inv = countInvisible(cap);
    lines.push(`checks: covered ${coveredItems.length}/${acts.length} tested · hidden text dropped ${hiddenN}${d.nameless ? ` · unnamed controls ${d.nameless}` : ""}${inv ? ` · invisible characters removed ${inv}` : ""}`);
    // 가린 것 (v0.1.3) — 모델이 "빈 칸"으로 오해하지 않게
    const pv = cap.privacy || {};
    if (pv.maskValues || pv.dropQuery) lines.push(`privacy: ${[pv.maskValues ? "typed values hidden — fields show only (filled) or (empty)" : "", pv.dropQuery ? "address shown without its ?query and #part" : ""].filter(Boolean).join(" · ")}`);
    // 덮개 층: 무엇이 · 몇 개를 · 어떻게 닫나
    for (const o of overlays.values()) {
      const where = o.first ? ` (${o.first} in view)` : "";
      lines.push(`⚠ ${o.id} = ${o.text} — covers ${o.count} item${o.count > 1 ? "s" : ""}${where}; ${o.how}`);
    }
    // 그 밖의 가림: 보는 화면에서 같은 것이 여러 개를 가리면
    const byWho = new Map();
    for (const i of coveredItems) {
      if (!inView(i) || layerOf(i.by)) continue;
      const k = coverOf.get(i.n);
      byWho.set(k, (byWho.get(k) || 0) + 1);
    }
    for (const [who, n] of byWho) if (n >= 2) lines.push(`⚠ ${who} covers ${n} items in view — scroll or look closer first`);
    for (const r of cap.regions) if (r.modal) lines.push(`⚠ modal dialog ${q(r.name)} is open`);
  }

  // 접은 링크: 자리 없이 [번호 이름]만 한 줄로 (영역이 끝날 때 · 고정 층도)
  const MAX_FOLDED = 40;
  const ind = arm === "D" ? "" : "  ";
  const flushFolded = (regionId) => {
    const extra = collapsed.get(regionId);
    if (!extra?.length) return;
    const shown = extra.slice(0, MAX_FOLDED).map((i) => `[${i.n} ${pageStr(i.name, 24).replace(/[[\]]/g, "")}${markOf(i.n)}]`).join(" ");
    const rest = extra.length > MAX_FOLDED ? ` … +${extra.length - MAX_FOLDED} not listed` : "";
    lines.push(`${ind}⋯ ${extra.length} more links${arm === "D" ? "" : " here (positions not shown)"}: ${shown}${rest}`);
    collapsed.delete(regionId);
  };

  // ── 고정 층 (영역별로 묶어서) ──
  const pinned = arm === "D" ? [] : items.filter((i) => i.pin === "fixed" && !skip(i));
  let pinRegion = Symbol("none");
  for (const it of pinned) {
    if (it.region !== pinRegion) {
      if (pinned.some((x) => x.region === pinRegion) && !items.some((x) => x.region === pinRegion && x.pin !== "fixed")) flushFolded(pinRegion);
      pinRegion = it.region;
      const reg = regions.get(it.region);
      const label = reg ? ` · ${REGION_LABEL[reg.role] || token(reg.role, 24)}${reg.name ? ` ${q(reg.name)}` : ""}` : "";
      lines.push(`▸ pinned (stays on screen while scrolling)${label}`);
    }
    lines.push(`  ${describe(it)}${pos(it)}`);
  }
  if (pinned.length && !items.some((x) => x.region === pinRegion && x.pin !== "fixed")) flushFolded(pinRegion);

  // ── 본문: 읽는 순서 · 영역 · 화면 구분 ──
  let lastRegion = Symbol("none");
  let lastScreen = 1;
  let lastSc = null;
  const scrollerOf = new Map((cap.scrollers || []).map((x) => [x.id, x]));
  const closeRegion = () => flushFolded(lastRegion);
  const rowsOf = (sc) => (arm === "A" ? ` · rows ${(sc - 1) * screenRows + 1}–${sc * screenRows}` : "");
  for (const it of items) {
    if (skip(it)) continue;
    if (arm !== "D" && it.pin === "fixed") continue;
    if (it.region !== lastRegion) {
      closeRegion();
      lastRegion = it.region;
      lastSc = null;
      if (arm !== "D") {
        const reg = regions.get(it.region);
        const label = reg ? `${REGION_LABEL[reg.role] || token(reg.role, 24)}${reg.name ? ` ${q(reg.name)}` : ""}` : "page";
        const span = reg && arm === "A" ? ` @${spanOf(reg.r, W)}` : "";
        lines.push(`▸ ${label}${span}`);
      }
    }
    if (arm !== "D") {
      if (it.sc && it.sc !== lastSc) {
        const sc = scrollerOf.get(it.sc);
        if (sc) {
          const vert = sc.axis !== "x";
          const shownPx = vert ? sc.clientHeight : sc.clientWidth;
          const totalPx = vert ? sc.scrollHeight : sc.scrollWidth;
          const span = arm === "A" ? ` @${spanOf(sc.r, W)}` : "";
          lines.push(`  ⤷ scroll box S${sc.id} scrolls by itself (${vert ? "up/down" : "sideways"}, shows ${shownPx} of ${totalPx}px)${span}`);
        }
      }
      lastSc = it.sc || null;
      // 화면 구분 (붙어 다니는 것 · 잘려 안 보이는 것은 자리가 뜻이 없으므로 세지 않는다) — 옆 기둥처럼 뒤에 적혔지만 위에 있는 것은 "위로 돌아감"
      if (it.pin !== "sticky" && !it.clipped && !it.scHidden) {
        const sc = screenOf(it);
        if (sc > lastScreen) {
          lastScreen = sc;
          const outline = cutScreen && sc > cutScreen ? (sc === cutScreen + 1 ? " · from here only headings are listed" : " · headings only") : "";
          lines.push(`  ── screen ${sc}${rowsOf(sc)}${outline} ──`);
        } else if (sc < lastScreen && it.r[1] < (lastScreen - 1) * SP - 2 * ROW_H) {
          // 화면 경계에서 한두 줄 위로 걸친 것(코드 상자의 복사 단추 등)은 되돌리지 않는다
          lastScreen = sc;
          lines.push(`  ── back up to screen ${sc}${rowsOf(sc)} (this part sits beside what came before) ──`);
        }
      }
    }
    lines.push(`${ind}${describe(it)}${pos(it)}`);
  }
  closeRegion();
  for (const regionId of [...collapsed.keys()]) flushFolded(regionId); // 목록에 한 번도 안 나온 영역의 접힌 링크도 빠짐없이
  if (over) lines.push(arm === "D" ? `… page is long: ${over} items near the end are left out (only headings kept)` : `… page is long: from screen ${cutScreen + 1} on only headings are listed (${over} items left out)`);
  return lines.join("\n").toWellFormed();
}

/** 조금 넉넉하게 잡은 토큰 어림 (연결의 분량 제한용) — 영숫자 묶음은 4자에 1, 그 밖의 글자(한글 · 기호 · 따옴표)는 하나에 1. 기호가 많은 GRID/1 줄을 적게 세지 않게 (검토) */
export function estimateTokens(s) {
  let n = 0;
  for (const m of String(s).matchAll(/[A-Za-z0-9]+|[^\sA-Za-z0-9]/gu)) n += /^[A-Za-z0-9]/.test(m[0]) ? Math.ceil(m[0].length / 4) : 1;
  return n;
}

/** 대략의 토큰 수 (ASCII 4자 ≈ 1토큰, 한글 등 1자 ≈ 1토큰 — 비교용 어림) */
export function roughTokens(s) {
  let ascii = 0;
  let other = 0;
  for (const ch of s) ch.charCodeAt(0) < 128 ? ascii++ : other++;
  return Math.round(ascii / 4 + other * 0.9);
}
