// SPDX-FileCopyrightText: 2026 Hwang Dae Jin (Philosophy That Works)
// SPDX-License-Identifier: AGPL-3.0-only
// grid — 페이지 안에서 도는 걸음 (시험판 capture/1)
//
// 격리된 세계(isolated world)에서 한 번 실행되어 globalThis.__grid 를 설치한다.
// 페이지의 JS와 섞이지 않아서 페이지가 이 코드를 가로채거나 흉내 낼 수 없다.
//
//   __grid.capture({ maskValues, dropQuery }?)  → 글 · 누를 것 · 그림 · 영역 · 고정/붙음 · 스크롤 상자 · 숨은 글 (문서 좌표, JSON 문자열로 돌려준다)
//   __grid.hitTest()  → 지금 화면 안의 누를 것마다 가운데를 짚어 "정말 맨 위에 있는지" (가려짐)
//
// 원칙: 코드로 알 수 있는 건 모두 코드로 — 비용 없이, 늘 같게 웹 화면을 교차 검증
// 번호(n)는 이 문서가 살아 있는 동안 바뀌지 않는다 — 새 요소는 다음 번호, 지운 번호는 다시 쓰지 않는다.
(() => {
  if (globalThis.__grid) return "already";

  const MAX_VISIT = 60000;
  const MAX_TEXT = 500;
  const ACTION_ROLES = new Set([
    "button", "link", "checkbox", "radio", "switch", "tab", "menuitem", "menuitemcheckbox", "menuitemradio",
    "option", "combobox", "select", "textbox", "searchbox", "slider", "spinbutton", "treeitem", "file", "clickable",
  ]);
  const LANDMARK_ROLES = new Set(["banner", "navigation", "main", "complementary", "contentinfo", "search", "form", "region", "dialog", "alertdialog"]);
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "HEAD", "META", "LINK", "TITLE", "BASE"]);
  const BLOCKY = /^(block|list-item|table|table-cell|table-row|table-caption|flex|grid|flow-root|inline-block|inline-flex|inline-grid)$/;

  let seq = 0; // 누를 것 번호
  const idOf = new WeakMap(); // 요소 → 번호
  const refs = new Map(); // 번호 → WeakRef(요소)
  let captureNo = 0;

  const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  // 글자(코드 포인트) 수로 자름 — 이모지가 반으로 잘려 깨진 글자가 남지 않게 (검토)
  const cut = (s, n) => {
    const a = [...s];
    return a.length > n ? `${a.slice(0, n - 1).join("")}…` : s;
  };
  const R = (v) => Math.round(v);

  // ── 역할 · 이름 · 상태 ─────────────────────────────
  function roleOf(el, cs) {
    const explicit = el.getAttribute("role");
    if (explicit) return explicit.trim().split(/\s+/)[0].toLowerCase();
    const tag = el.tagName;
    if ((tag === "A" || tag === "AREA") && el.hasAttribute("href")) return "link";
    if (tag === "BUTTON") return "button";
    if (tag === "SUMMARY") return "button";
    if (tag === "SELECT") return "select";
    if (tag === "TEXTAREA") return "textbox";
    if (tag === "INPUT") {
      const t = (el.getAttribute("type") || "text").toLowerCase();
      if (t === "hidden") return null;
      if (t === "checkbox") return "checkbox";
      if (t === "radio") return "radio";
      if (t === "range") return "slider";
      if (t === "number") return "spinbutton";
      if (t === "search") return "searchbox";
      if (t === "file") return "file";
      if (t === "submit" || t === "reset" || t === "button" || t === "image" || t === "color") return "button";
      return "textbox";
    }
    if (el.isContentEditable && el.getAttribute("contenteditable") !== null) return "textbox";
    if (/^H[1-6]$/.test(tag)) return "heading";
    if (tag === "IMG" || (tag === "svg" && el.getAttribute("role") === "img")) return "img";
    if (tag === "VIDEO") return "video";
    if (tag === "CANVAS") return "canvas";
    if (tag === "IFRAME") return "iframe";
    if (tag === "DIALOG") return "dialog";
    if (tag === "NAV") return "navigation";
    if (tag === "MAIN") return "main";
    if (tag === "ASIDE") return "complementary";
    if (tag === "HEADER" && !el.closest("article, aside, main, nav, section")) return "banner";
    if (tag === "FOOTER" && !el.closest("article, aside, main, nav, section")) return "contentinfo";
    if (tag === "FORM" && (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby"))) return "form";
    if (tag === "SECTION" && (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby"))) return "region";
    // 의미가 없는데 눌리는 것(onclick · 손가락 모양): **작고, 안에 진짜 컨트롤이 없는 것**만.
    // 큰 상자(목록 전체 등)를 하나로 삼키지 않게 — 큰 파일 목록이 통째로 "버튼 하나"가 되던 문제
    const pointer = cs && cs.cursor === "pointer" && !el.parentElement?.closest?.("a[href], button, [role=button], [role=link], summary, label, select") && getComputedStyle(el.parentElement || el).cursor !== "pointer";
    if (el.hasAttribute("onclick") || pointer) {
      const r = el.getBoundingClientRect();
      if (r.width * r.height > 0.15 * innerWidth * innerHeight || r.height > 220) return null;
      if (el.querySelector("a[href], button, input, select, textarea, [role=button], [role=link], [role=checkbox], [role=tab], [contenteditable]")) return null;
      if ((el.innerText || "").length > 160) return null;
      return "clickable";
    }
    return null;
  }

  const textOfIds = (el, attr) =>
    clean(
      (el.getAttribute(attr) || "")
        .split(/\s+/)
        .map((id) => {
          const ref = el.ownerDocument.getElementById(id);
          // 적은 값 가리기: 사람이 쓰는 편집 칸의 글은 이름으로도 내보내지 않는다 (v0.1.3 검토)
          return ref && !(opts.maskValues && ref.isContentEditable) ? ref.textContent || "" : "";
        })
        .join(" "),
    );

  /** 접근 가능한 이름 (간단판): aria-labelledby → aria-label → 라벨 · placeholder → alt → 보이는 글 → title → 안쪽 그림의 alt/title */
  function nameOf(el, role) {
    let n = el.hasAttribute("aria-labelledby") ? textOfIds(el, "aria-labelledby") : "";
    if (!n) n = clean(el.getAttribute("aria-label"));
    const tag = el.tagName;
    if (!n && (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA")) {
      if (el.labels?.length) n = clean([...el.labels].map((l) => l.innerText).join(" "));
      if (!n) n = clean(el.getAttribute("placeholder") || el.getAttribute("aria-placeholder"));
      if (!n && tag === "INPUT" && /^(submit|reset|button)$/i.test(el.type)) n = clean(el.value) || (el.type === "submit" ? "Submit" : "");
      if (!n && tag === "INPUT" && el.type === "image") n = clean(el.alt);
    }
    if (!n && (tag === "IMG" || tag === "AREA")) n = clean(el.getAttribute("alt"));
    // 편집 칸(contenteditable · designMode)의 글은 이름이 아니라 사람이 쓴 값이다 (v0.1.3 검토)
    const editable = el.isContentEditable;
    if (!n && !editable && role !== "textbox" && role !== "searchbox" && role !== "select" && role !== "img") n = clean(el.innerText);
    if (!n) n = clean(el.getAttribute("title"));
    if (!n && !editable) {
      const inner = el.querySelector?.("img[alt], [aria-label], svg title, [title]");
      if (inner) n = clean(inner.getAttribute?.("alt") || inner.getAttribute?.("aria-label") || inner.textContent || inner.getAttribute?.("title"));
    }
    return cut(n, 120);
  }

  /** 이름이 없는 아이콘: class · id에서 추측 (~ 표시) */
  function guessOf(el) {
    const hint = `${el.id || ""} ${typeof el.className === "string" ? el.className : el.getAttribute("class") || ""}`.toLowerCase();
    const table = [
      [/close|dismiss|btn[-_]?x\b/, "닫기"], [/search/, "검색"], [/cart|basket/, "장바구니"], [/menu|hamburger|gnb/, "메뉴"],
      [/share/, "공유"], [/like|heart|wish|zzim/, "찜"], [/prev|left/, "이전"], [/next|right/, "다음"], [/play/, "재생"],
      [/user|my|account|login/, "내 정보"], [/home|logo/, "홈"], [/setting/, "설정"], [/more|kebab|dots/, "더보기"],
    ];
    for (const [re, name] of table) if (re.test(hint)) return `~${name}`;
    return "";
  }

  function statesOf(el, role) {
    const s = [];
    const a = (k) => el.getAttribute(k);
    if (el.disabled || a("aria-disabled") === "true" || el.closest?.("fieldset[disabled]") || el.closest?.("[inert]")) s.push("disabled");
    if (role === "checkbox" || role === "radio" || role === "switch" || role === "menuitemcheckbox" || role === "menuitemradio") {
      if (el.checked || a("aria-checked") === "true") s.push("checked");
    }
    if (a("aria-expanded") === "true" || (el.tagName === "SUMMARY" && el.parentElement?.open)) s.push("expanded");
    if (a("aria-selected") === "true" || (el.tagName === "OPTION" && el.selected)) s.push("selected");
    if (a("aria-pressed") === "true") s.push("pressed");
    if (el.required || a("aria-required") === "true") s.push("required");
    if (el.readOnly || a("aria-readonly") === "true") s.push("readonly");
    if (a("aria-invalid") === "true") s.push("invalid");
    if (a("aria-current") && a("aria-current") !== "false") s.push("current");
    if (a("aria-haspopup") && a("aria-haspopup") !== "false") s.push("popup");
    return s;
  }

  const SENSITIVE = /cc-|one-time-code|current-password|new-password/;
  // 읽기 선택 (capture(opts)가 정함) — maskValues: 사람이 적은 값은 "(filled)"/"(empty)"만 (v0.1.3)
  //   값이 이 페이지 밖으로 아예 나가지 않게 여기서 가린다. 고른 값(select) · 끌기(slider)는 페이지가 준 글이라 그대로.
  let opts = {};
  function valueOf(el, role) {
    const tag = el.tagName;
    if (tag === "SELECT") {
      // 카드 유효기간(cc-exp-*) 같은 것은 고른 값도 가린다
      if (SENSITIVE.test(el.autocomplete || "")) return el.value ? "(filled)" : "(empty)";
      return cut(clean(el.selectedOptions?.[0]?.text ?? ""), 40);
    }
    if (tag === "TEXTAREA" || (tag === "INPUT" && (role === "textbox" || role === "searchbox" || role === "spinbutton" || role === "slider"))) {
      const sensitive = el.type === "password" || SENSITIVE.test(el.autocomplete || "");
      const range = tag === "INPUT" && el.type === "range"; // 끌기 막대만 그대로 (역할이 아니라 type으로 — role=slider를 단 글 칸이 새지 않게)
      if (sensitive || (opts.maskValues && !range)) return el.value ? "(filled)" : "(empty)";
      return el.value ? cut(clean(el.value), 60) : "(empty)";
    }
    if (el.isContentEditable) {
      const text = clean(el.innerText);
      if (opts.maskValues) return text ? "(filled)" : "(empty)";
      return cut(text, 60) || "(empty)";
    }
    return undefined;
  }
  const isSensitive = (el) => el.tagName === "INPUT" && (el.type === "password" || SENSITIVE.test(el.autocomplete || ""));

  // ── 자리 · 고정 · 스크롤 상자 · 보임 ──────────────────
  // 기억들은 capture() 때마다 새로 — 넘기며 나타난 글 · 바뀐 상자 크기를 예전 값으로 보지 않게
  let pinMemo = new WeakMap();
  /** 스스로나 조상이 position: fixed/sticky 인지 (이 조상 체인에서 가장 가까운 것) */
  function pinOf(el) {
    if (!el || el.nodeType !== 1) return null;
    if (pinMemo.has(el)) return pinMemo.get(el);
    const pos = getComputedStyle(el).position;
    let v = pos === "fixed" ? "fixed" : pos === "sticky" ? "sticky" : null;
    if (!v) {
      const parent = el.parentElement || (el.getRootNode() instanceof ShadowRoot ? el.getRootNode().host : null);
      v = parent ? pinOf(parent) : null;
    }
    pinMemo.set(el, v);
    return v;
  }

  const scrollerIds = new WeakMap(); // 상자 번호는 페이지가 열려 있는 동안 그대로
  let scrollerSeq = 0;
  let scrollers = [];
  let scSeen = new Set();
  let scMemo = new WeakMap();
  /** 스스로 스크롤하는 가장 가까운 상자 (페이지 전체는 빼고) */
  function scrollerOf(el) {
    let p = el.parentElement;
    const root = el.ownerDocument.scrollingElement;
    while (p && p !== root && p !== el.ownerDocument.body) {
      if (scMemo.has(p)) {
        const v = scMemo.get(p);
        if (v !== null) return v;
      } else {
        const cs = getComputedStyle(p);
        const y = /(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 2;
        const x = /(auto|scroll)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 2;
        if (x || y) {
          let id = scrollerIds.get(p);
          if (!id) {
            id = ++scrollerSeq;
            scrollerIds.set(p, id);
          }
          if (!scSeen.has(id)) {
            scSeen.add(id);
            const r = p.getBoundingClientRect();
            scrollers.push({ id, axis: y && x ? "xy" : y ? "y" : "x", r: [R(r.left + scrollX), R(r.top + scrollY), R(r.width), R(r.height)], scrollHeight: p.scrollHeight, clientHeight: p.clientHeight, scrollWidth: p.scrollWidth, clientWidth: p.clientWidth, pin: pinOf(p) });
          }
          scMemo.set(p, id);
          return id;
        }
        scMemo.set(p, null);
      }
      p = p.parentElement;
    }
    return null;
  }

  const shown = (el) => {
    try {
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    } catch {}
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const docRect = (r, off) => [R(r.left + scrollX + off.x), R(r.top + scrollY + off.y), R(r.width), R(r.height)];

  // ── 숨은 글 (모델에 보내지 않고 센다) ────────────────
  let opMemo = new WeakMap();
  function opacityOf(el) {
    if (!el || el.nodeType !== 1) return 1;
    if (opMemo.has(el)) return opMemo.get(el);
    const own = parseFloat(getComputedStyle(el).opacity || "1");
    const v = own * opacityOf(el.parentElement);
    opMemo.set(el, v);
    return v;
  }
  const parseRGB = (c) => {
    const m = /rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?/.exec(c || "");
    return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
  };
  const lum = ([r, g, b]) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  /** 첫 불투명 조상의 배경색 (배경 그림이 있으면 알 수 없음 → null) */
  function backgroundOf(el) {
    for (let p = el; p && p.nodeType === 1; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.backgroundImage && cs.backgroundImage !== "none") return null;
      const c = parseRGB(cs.backgroundColor);
      if (c && c[3] > 0.9) return c;
    }
    return [255, 255, 255, 1];
  }
  /** 화면 읽기 프로그램 전용 글(보이지 않게 잘라 둔 것): clip rect(0…) · clip-path inset(50%) · 1–2px 상자 */
  function srOnly(el) {
    for (let p = el, i = 0; p && p.nodeType === 1 && i < 5; p = p.parentElement, i++) {
      const cs = getComputedStyle(p);
      if (cs.clip && cs.clip !== "auto" && /rect\(\s*0(px)?[ ,]+0(px)?[ ,]+0(px)?[ ,]+0(px)?\s*\)/.test(cs.clip)) return true;
      if (/inset\(\s*(50|100)%/.test(cs.clipPath || "")) return true;
      const r = p.getBoundingClientRect();
      if (r.width <= 2 && r.height <= 2 && cs.overflow !== "visible") return true;
    }
    return false;
  }

  function hiddenReason(el, rect, pageW, pageH) {
    const cs = getComputedStyle(el);
    if (el.closest("[aria-hidden=true]")) return "aria-hidden";
    if (srOnly(el)) return "sr-only";
    if (parseFloat(cs.fontSize) < 4) return "tiny";
    if (opacityOf(el) < 0.1) return "transparent";
    const fg = parseRGB(cs.color);
    if (fg && fg[3] < 0.1 && !/text/.test(cs.backgroundClip || cs.webkitBackgroundClip || "")) return "transparent";
    if (rect.width <= 1 && rect.height <= 1) return "sr-only";
    const x = rect.left + scrollX;
    const y = rect.top + scrollY;
    if (x + rect.width < 0 || y + rect.height < 0 || x > pageW + 50 || y > pageH + 50) return "offscreen";
    if (fg) {
      const bg = backgroundOf(el);
      if (bg) {
        const a = lum(fg);
        const b = lum(bg);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        if (ratio < 1.25) return "low-contrast";
      }
    }
    return null;
  }

  // ── 걷기 ──────────────────────────────────────────
  /** 그려지는 순서대로 자식들: shadow root(열린 것) · slot에 꽂힌 것 · 같은 출처 iframe 문서 */
  function kids(node) {
    if (node.nodeType === 1) {
      if (node.shadowRoot) return [...node.shadowRoot.childNodes];
      if (node.tagName === "SLOT") {
        const assigned = node.assignedNodes({ flatten: true });
        return assigned.length ? assigned : [...node.childNodes];
      }
    }
    return [...node.childNodes];
  }

  /** @param {{ maskValues?: boolean, dropQuery?: boolean }} [o] maskValues: 적은 값 가리기 · dropQuery: 주소의 ?뒤 · #뒤 빼기 */
  function capture(o) {
    opts = o && typeof o === "object" ? { maskValues: o.maskValues === true, dropQuery: o.dropQuery === true } : {};
    const t0 = performance.now();
    captureNo++;
    pinMemo = new WeakMap();
    opMemo = new WeakMap();
    scMemo = new WeakMap();
    scrollers = [];
    scSeen = new Set();
    const doc = document;
    const root = doc.scrollingElement || doc.documentElement;
    const pageW = Math.max(root.scrollWidth, innerWidth);
    const pageH = Math.max(root.scrollHeight, innerHeight);
    const out = [];
    const regions = [];
    const dropped = { "aria-hidden": 0, tiny: 0, transparent: 0, "sr-only": 0, offscreen: 0, "low-contrast": 0, nameless: 0 };
    const hiddenSamples = [];
    const blocks = new Map(); // 글 묶음 요소 → 기록
    const blockLast = new Map(); // 글 묶음 → 마지막 글의 부모 (다른 요소의 글이면 띄어 쓴다)
    let visits = 0;
    let truncated = false;
    let tseq = 0;

    /** 글이 속한 덩어리(가장 가까운 블록 조상)의 기록 — 처음 보면 만든다 (읽는 순서대로) */
    const blockFor = (el, regionId) => {
      let b = el;
      while (b && b.parentElement && !BLOCKY.test(getComputedStyle(b).display)) b = b.parentElement;
      let rec = blocks.get(b);
      if (!rec) {
        const level = /^H([1-6])$/.exec(b.tagName)?.[1] || (b.getAttribute("role") === "heading" ? b.getAttribute("aria-level") || "2" : null);
        rec = { kind: level ? "heading" : "text", t: 0, text: "", level: level ? +level : undefined, r: null, region: regionId, pin: pinOf(b), sc: scrollerOf(b) };
        blocks.set(b, rec);
        out.push(rec);
      }
      return { b, rec };
    };
    const grow = (rec, r) => {
      if (!rec.r) rec.r = r;
      else {
        const x0 = Math.min(rec.r[0], r[0]);
        const y0 = Math.min(rec.r[1], r[1]);
        const x1 = Math.max(rec.r[0] + rec.r[2], r[0] + r[2]);
        const y1 = Math.max(rec.r[1] + rec.r[3], r[1] + r[3]);
        rec.r = [x0, y0, x1 - x0, y1 - y0];
      }
    };

    const addText = (textNode, parentEl, regionId, off) => {
      const raw = textNode.nodeValue;
      if (!raw || !raw.trim()) return;
      // 적은 값 가리기: 편집 칸(contenteditable · designMode 문서) 안의 글은 사람이 쓴 것 — 글 줄로도, 숨은 글 표본으로도 내보내지 않는다 (v0.1.3 검토)
      if (opts.maskValues && parentEl.isContentEditable) return;
      // 입력칸 라벨의 글은 그 칸의 이름이 되므로 따로 세지 않는다
      const label = parentEl.closest("label");
      if (label?.control && shown(label.control)) return;
      const range = doc.createRange();
      range.selectNodeContents(textNode);
      const rr = range.getBoundingClientRect();
      if (!rr.width && !rr.height) {
        // 글자 크기 0 같은 숨긴 글도 센다 (AI를 속이는 숨은 지시에 흔함)
        if (parseFloat(getComputedStyle(parentEl).fontSize) < 4) {
          dropped.tiny++;
          if (hiddenSamples.length < 12) hiddenSamples.push({ why: "tiny", text: cut(clean(raw), 80) });
        }
        return;
      }
      const why = hiddenReason(parentEl, rr, pageW, pageH);
      if (why) {
        dropped[why]++;
        if (hiddenSamples.length < 12) hiddenSamples.push({ why, text: cut(clean(raw), 80) });
        return;
      }
      const { b, rec } = blockFor(parentEl, regionId);
      // 취소선 가격은 ~~ ~~로 (할인 전 가격임을 알게)
      const strike = parentEl.closest("del, s, strike");
      // 페이지 글 속의 ⟦ ⟧는 뺀다 — 문단 속 링크 표시(⟦n|이름⟧)를 흉내 내 가짜 [n 이름] 링크를 만들지 못하게 (검토)
      const txt = raw.replace(/[\u27E6\u27E7]/g, "");
      const piece = strike && b.contains(strike) ? ` ~~${clean(txt)}~~ ` : txt;
      const last = blockLast.get(b);
      rec.text += (last && last !== parentEl ? " " : "") + piece;
      blockLast.set(b, parentEl);
      grow(rec, docRect(rr, off));
      rec.plain = true; // 링크 말고 진짜 글이 있음
    };

    /** node를 걸으며: 누를 것이면 기록하고(그 안의 글은 이름이 되므로 글로 따로 세지 않는다), 영역이면 들어간다 */
    const walk = (node, regionId, inAction, off) => {
      if (++visits > MAX_VISIT) {
        truncated = true;
        return;
      }
      if (node.nodeType === 3) {
        if (!inAction) addText(node, node.parentElement, regionId, off);
        return;
      }
      if (node.nodeType !== 1) {
        if (node.nodeType === 11) for (const k of kids(node)) walk(k, regionId, inAction, off);
        return;
      }
      const el = node;
      if (SKIP_TAGS.has(el.tagName)) return;
      const cs = getComputedStyle(el);
      if (cs.display === "none") return;
      if (el.getAttribute("aria-hidden") === "true") {
        // 모델에는 보내지 않지만 누를 것이 들어 있으면 센다 (장식용 아이콘이 대부분)
        dropped["aria-hidden"]++;
        return;
      }
      let role = roleOf(el, cs);
      if (opts.maskValues && el.isContentEditable && !(role && ACTION_ROLES.has(role))) return;
      let region = regionId;
      if (role && LANDMARK_ROLES.has(role) && shown(el)) {
        const r = el.getBoundingClientRect();
        region = regions.length + 1;
        regions.push({ id: region, role, name: cut(clean(el.getAttribute("aria-label") || (el.hasAttribute("aria-labelledby") ? textOfIds(el, "aria-labelledby") : "")), 60), r: docRect(r, off), pin: pinOf(el), parent: regionId, modal: role === "dialog" || role === "alertdialog" ? el.getAttribute("aria-modal") === "true" || (el.tagName === "DIALOG" && el.matches(":modal")) : undefined });
        role = null;
      }
      const actionable = role && ACTION_ROLES.has(role) && !inAction;
      // 보이지 않게 숨긴 컨트롤(건너뛰기 링크 등 화면 읽기 전용)은 모델에 보내지 않는다
      if (actionable && shown(el) && srOnly(el)) {
        dropped["sr-only"]++;
        return;
      }
      if (actionable && shown(el)) {
        let n = idOf.get(el);
        if (!n) {
          n = ++seq;
          idOf.set(el, n);
          refs.set(n, new WeakRef(el));
        }
        let name = nameOf(el, role);
        if (!name) {
          name = guessOf(el);
          if (!name) dropped.nameless++;
          // 의미 없이 "눌리는 것"인데 이름도 없으면 잡음 — 목록에서 뺀다 (진짜 버튼 · 링크는 "(unnamed)"로 남김)
          if (!name && role === "clickable") {
            for (const k of kids(el)) walk(k, region, true, off);
            return;
          }
          if (!name) name = "(unnamed)";
        }
        const r = el.getBoundingClientRect();
        const rec = { kind: "action", n, role, name, tag: el.tagName.toLowerCase(), states: statesOf(el, role), r: docRect(r, off), region, pin: pinOf(el), sc: scrollerOf(el) };
        const v = valueOf(el, role);
        if (v !== undefined) rec.value = v;
        if (isSensitive(el)) rec.sensitive = true;
        if (role === "link") rec.href = cut(el.href || "", 300);
        if (role === "select") rec.options = [...el.options].slice(0, 12).map((o) => cut(clean(o.text), 30));
        out.push(rec);
        // 문단 속 링크: 문장 안에 번호와 함께 남긴다 ("서울은 중앙에 [45 한강]이 흐르고") — 문장이 끊기지 않게
        if (role === "link" && cs.display === "inline" && el.parentElement) {
          const { b, rec: block } = blockFor(el.parentElement, region);
          const last = blockLast.get(b);
          block.text += `${last ? " " : ""}\u27E6${n}|${name}\u27E7 `;
          blockLast.set(b, el);
          (block.links ||= []).push(n);
          grow(block, rec.r);
          rec.inBlock = block;
        }
        // 누를 것 안의 누를 것(링크 안 버튼 등)은 따로 번호를 주지 않는다 — 안의 글도 이름에 들어갔다
        for (const k of kids(el)) walk(k, region, true, off);
        return;
      }
      if ((role === "img" || role === "video" || role === "canvas" || role === "iframe") && shown(el)) {
        const r = el.getBoundingClientRect();
        if (r.width >= 24 && r.height >= 24 && !inAction) {
          out.push({ kind: "media", t: 0, role, name: cut(clean(el.getAttribute("alt") || el.getAttribute("aria-label") || el.getAttribute("title") || ""), 100), r: docRect(r, off), region, pin: pinOf(el), sc: scrollerOf(el) });
        }
      }
      if (role === "iframe") {
        // 같은 출처 iframe만 들어간다 (다른 출처는 v1.1에 CDP로)
        try {
          const inner = el.contentDocument;
          if (inner?.documentElement) {
            const fr = el.getBoundingClientRect();
            walk(inner.documentElement, region, inAction, { x: off.x + fr.left + el.clientLeft, y: off.y + fr.top + el.clientTop });
          }
        } catch {}
        return;
      }
      for (const k of kids(el)) walk(k, region, inAction, off);
    };

    walk(doc.documentElement, null, false, { x: 0, y: 0 });

    // 잘라서 숨기는 상자(overflow hidden/clip — 옆으로 넘기는 슬라이드 등) 밖으로 완전히 나간 항목: 지금 안 보임
    const clipMemo = new WeakMap();
    const clips = (p) => {
      if (clipMemo.has(p)) return clipMemo.get(p);
      const cs = getComputedStyle(p);
      const v = cs.overflowX !== "visible" || cs.overflowY !== "visible";
      clipMemo.set(p, v);
      return v;
    };
    const byN = new Map(out.filter((x) => x.kind === "action").map((x) => [x.n, x]));
    for (const [n, ref] of refs) {
      const el = ref.deref();
      if (!el || !el.isConnected) continue;
      const rec = byN.get(n);
      if (!rec) continue;
      const r = el.getBoundingClientRect();
      let x0 = r.left, x1 = r.right, y0 = r.top, y1 = r.bottom;
      for (let p = el.parentElement; p && p !== doc.body && p !== doc.documentElement && x1 > x0 && y1 > y0; p = p.parentElement) {
        if (!clips(p)) continue;
        const cs = getComputedStyle(p);
        const pr = p.getBoundingClientRect();
        if (cs.overflowX !== "visible") (x0 = Math.max(x0, pr.left)), (x1 = Math.min(x1, pr.right));
        if (cs.overflowY !== "visible") (y0 = Math.max(y0, pr.top)), (y1 = Math.min(y1, pr.bottom));
      }
      if (!(x1 - x0 >= 1 && y1 - y0 >= 1) || r.left >= pageW) rec.clipped = true;
    }

    // 스스로 스크롤하는 상자 안에서 지금 안 보이는 항목 표시 (상자를 넘겨야 보임)
    const scRect = new Map(scrollers.map((s) => [s.id, s.r]));
    for (const rec of out) {
      if (!rec.sc || !rec.r) continue;
      const s = scRect.get(rec.sc);
      if (!s) continue;
      const [x, y, w, h] = rec.r;
      const inside = x + w > s[0] + 1 && x < s[0] + s[2] - 1 && y + h > s[1] + 1 && y < s[1] + s[3] - 1;
      if (!inside) rec.scHidden = true;
    }

    // 글 묶음: 번호(t)를 매기고 너무 긴 건 자른다
    for (const rec of out) {
      if (rec.kind === "text" || rec.kind === "heading" || rec.kind === "media") {
        rec.t = ++tseq;
        if (rec.text !== undefined) {
          const full = clean(rec.text);
          rec.chars = full.length;
          rec.text = cut(full, MAX_TEXT);
        }
        // 링크만 있고 다른 글이 없는 덩어리(메뉴의 한 칸 등)는 글 줄로 쓰지 않는다 → 링크를 보통 줄로
        if (rec.links && !rec.plain) rec.onlyLinks = true;
        delete rec.plain;
      }
    }
    for (const rec of out) {
      if (rec.inBlock) {
        if (!rec.inBlock.onlyLinks) rec.inT = rec.inBlock.t;
        delete rec.inBlock;
      }
    }

    // 사실 (JSON-LD · OpenGraph) — 페이지가 스스로 밝힌 것
    const facts = { lang: doc.documentElement.lang || "", types: [], og: {} };
    for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const j = JSON.parse(s.textContent);
        const arr = Array.isArray(j) ? j : j["@graph"] || [j];
        for (const x of arr) {
          if (!x) continue;
          const t = x["@type"];
          if (t) facts.types.push(...(Array.isArray(t) ? t : [t]).map(String));
          if (/Product/i.test(String(t)) && !facts.product) {
            const offer = Array.isArray(x.offers) ? x.offers[0] : x.offers;
            const price = offer?.price ?? offer?.lowPrice;
            facts.product = { name: cut(clean(x.name), 120), price: price === undefined ? undefined : cut(clean(String(price)), 30), currency: offer?.priceCurrency ? cut(clean(offer.priceCurrency), 10) : undefined, availability: offer?.availability ? cut(clean(offer.availability), 80) : undefined };
          }
        }
      } catch {}
    }
    for (const m of doc.querySelectorAll('meta[property^="og:"]')) facts.og[m.getAttribute("property").slice(3)] = cut(clean(m.getAttribute("content")), 160);
    facts.types = [...new Set(facts.types)].slice(0, 12);

    return JSON.stringify({
      capture: 1,
      no: captureNo,
      url: opts.dropQuery ? location.href.replace(/[?#].*$/, "") : location.href,
      title: cut(clean(doc.title), 300),
      ...(opts.maskValues || opts.dropQuery ? { privacy: { maskValues: !!opts.maskValues, dropQuery: !!opts.dropQuery } } : {}),
      viewport: { w: innerWidth, h: innerHeight },
      page: { w: pageW, h: pageH },
      scroll: { x: R(scrollX), y: R(scrollY) },
      dpr: devicePixelRatio,
      items: out,
      regions,
      scrollers,
      dropped,
      hiddenSamples,
      facts,
      visits,
      truncated,
      ms: R(performance.now() - t0),
    });
  }

  /** 지금 화면 안의 누를 것마다 가운데(+ 안쪽 두 점)를 짚어 본다: 그 요소 · 자식 · 라벨이면 통과, 아니면 가린 것 */
  /** 요소가 실제로 보이는 사각형: 화면 + 잘라 내는 조상들(overflow ≠ visible)과 겹치는 부분만 */
  function visibleRect(el) {
    const r = el.getBoundingClientRect();
    let x0 = Math.max(0, r.left), y0 = Math.max(0, r.top), x1 = Math.min(innerWidth, r.right), y1 = Math.min(innerHeight, r.bottom);
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement && x1 > x0 && y1 > y0; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
      const pr = p.getBoundingClientRect();
      if (cs.overflowX !== "visible") (x0 = Math.max(x0, pr.left)), (x1 = Math.min(x1, pr.right));
      if (cs.overflowY !== "visible") (y0 = Math.max(y0, pr.top)), (y1 = Math.min(y1, pr.bottom));
    }
    return x1 - x0 >= 1 && y1 - y0 >= 1 ? { x0, y0, x1, y1 } : null;
  }

  // 덮개 층의 "닫기" 이름 — src/core/format.js CLOSE_NAME · ACK_NAME과 같게.
  // "확인 · OK"는 단추가 하나뿐인 알림 층(대화상자 아님)에서만 닫기로 친다 — 대화상자의 [취소][확인]에서 확인은 "예"라는 대답 (검토: 삭제 확인을 닫기로 안내할 뻔함)
  const CLOSE_NAME = /^(닫기|창\s?닫기|close|dismiss|×|✕|✖|x|오늘\s?하루\s?(보지|열지)\s?않기|다시\s?보지\s?않기|그만\s?보기)$/i;
  const ACK_NAME = /^(확인|알겠습니다|ok|okay|got it)$/i;
  /** 가린 것이 속한 층: 가장 바깥의 고정(fixed) 조상이나 대화상자 → 이름 · 역할 · 닫기 단추 번호 (실험 1: "covered by [66]"이 닫기 [67]과 헷갈림) */
  function layerOf(hit) {
    let fixed = null;
    let dialog = null;
    let land = null;
    for (let p = hit; p && p.nodeType === 1; p = p.parentElement || (p.getRootNode() instanceof ShadowRoot ? p.getRootNode().host : null)) {
      if (p === document.body || p === document.documentElement) break;
      const cs = getComputedStyle(p);
      if (cs.position === "fixed") fixed = p;
      const r = roleOf(p, cs);
      if (!dialog && (r === "dialog" || r === "alertdialog")) dialog = p;
      if (!land && r && LANDMARK_ROLES.has(r)) land = { el: p, role: r };
    }
    const root = fixed || dialog;
    if (!root) return null;
    const inside = (e) => e && (e === root || root.contains(e));
    // 층이 대화상자를 품고 있으면(겉 틀이 fixed인 MUI 꼴 등) 대화상자로 본다 (이름도 그 대화상자에서)
    const inner = !inside(dialog) && root.querySelector("[role=dialog], [role=alertdialog], dialog, [aria-modal=true]");
    const named = [land?.el, dialog, inner || null, root].find((e) => inside(e) && (e.getAttribute("aria-label") || e.getAttribute("aria-labelledby")));
    const name = named ? cut(clean(named.getAttribute("aria-label") || textOfIds(named, "aria-labelledby")), 60) : cut(clean(root.querySelector("h1, h2, h3, h4, [role=heading]")?.textContent || ""), 60);
    const role = inside(dialog) ? roleOf(dialog, getComputedStyle(dialog)) : inner ? (/^alertdialog$/.test(inner.getAttribute("role") || "") ? "alertdialog" : "dialog") : inside(land?.el) ? land.role : null;
    let close;
    let count = 0;
    let only = null;
    const acts = [];
    // 번호가 있는 것은 모두 센다 (href 없는 a · 손가락 모양으로 눌리는 것 · submit도) — [취소]를 빼고 세면 [확인] 하나뿐인 알림으로 잘못 봄 (검토 2차)
    for (const [n, ref] of refs) {
      const el = ref.deref();
      if (!el || !el.isConnected || !root.contains(el)) continue;
      const nm = nameOf(el, "button").trim() || guessOf(el).replace("~", "");
      if (++count === 1) only = { n, nm };
      if (acts.length < 3) acts.push(n);
      if (!close && CLOSE_NAME.test(nm)) close = n;
    }
    if (!close && count === 1 && role !== "dialog" && role !== "alertdialog" && ACK_NAME.test(only.nm)) close = only.n;
    return { role, name, pin: fixed ? "fixed" : undefined, close, acts, count, h: R(root.getBoundingClientRect().height) };
  }

  /** 가린 것이 무엇인지: 번호가 있으면 번호, 투명한 링크면 ⚠ 가짜(어디로 가는지), 이름표(aria-label)가 있는 덮개면 그 이름, 아니면 태그 (+ 덮개 층) */
  function coverer(hit) {
    const layer = layerOf(hit);
    const extra = layer ? { layer } : {};
    let p = hit;
    while (p && !idOf.has(p)) p = p.parentElement;
    if (p) return { n: idOf.get(p), ...extra };
    let op = 1;
    for (let q = hit; q && q.nodeType === 1; q = q.parentElement) op *= parseFloat(getComputedStyle(q).opacity || "1");
    const link = hit.closest("a[href]");
    if (op < 0.1) {
      let host = "";
      try {
        host = link ? new URL(link.href).host : "";
      } catch {}
      return { invisible: true, link: !!link, host };
    }
    const labelled = hit.closest("[aria-label]");
    // id · class는 페이지가 정하는 글 — 이름표 글자만 남긴다 (줄바꿈 · 가짜 표시를 넣지 못하게, 검토)
    const tok = (v) => String(v || "").replace(/[^\w-]/g, "").slice(0, 30);
    const tag = `${hit.tagName.toLowerCase()}${hit.id ? `#${tok(hit.id)}` : ""}${typeof hit.className === "string" && hit.className ? `.${tok(hit.className.split(/\s+/)[0])}` : ""}`;
    return labelled ? { tag, label: cut(clean(labelled.getAttribute("aria-label")), 40), ...extra } : { tag, ...extra };
  }

  function hitTest() {
    const res = [];
    for (const [n, ref] of refs) {
      const el = ref.deref();
      if (!el || !el.isConnected) continue;
      // 화면 밖이거나 스크롤 상자 · 캐러셀 밖으로 잘려 안 보이면 짚지 않는다 (가려진 게 아니라 안 보이는 것)
      const v = visibleRect(el);
      if (!v) continue;
      const { x0, x1, y0, y1 } = v;
      const full = el.getBoundingClientRect();
      const a = Math.round((((x1 - x0) * (y1 - y0)) / Math.max(1, full.width * full.height)) * 100) / 100; // 얼마나 보였나 (0~1)
      const pts = [[(x0 + x1) / 2, (y0 + y1) / 2], [x0 + (x1 - x0) * 0.25, (y0 + y1) / 2], [x0 + (x1 - x0) * 0.75, (y0 + y1) / 2]];
      let ok = false;
      let by = null;
      for (const [x, y] of pts) {
        let hit = el.getRootNode().elementFromPoint?.(x, y) ?? document.elementFromPoint(x, y);
        // shadow 안으로 따라 들어간다
        while (hit?.shadowRoot) {
          const inner = hit.shadowRoot.elementFromPoint(x, y);
          if (!inner || inner === hit) break;
          hit = inner;
        }
        if (!hit || hit === document.documentElement || hit === document.body) continue;
        if (hit === el || el.contains(hit) || (el.labels && [...el.labels].some((l) => l === hit || l.contains(hit))) || (hit.tagName === "LABEL" && hit.control === el)) {
          ok = true;
          break;
        }
        if (!by) by = coverer(hit);
      }
      // 가린 것을 못 찾았으면(점마다 비어 있음) 가려졌다고 하지 않는다 — 모름
      if (ok) res.push({ n, ok: true, a });
      else if (by) res.push({ n, ok: false, by, a });
    }
    return JSON.stringify({ scrollY: R(scrollY), res });
  }

  globalThis.__grid = { capture, hitTest, version: 2 }; // 2 = capture(opts) (v0.1.3)
  return "ok";
})();
