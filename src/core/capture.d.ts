// SPDX-FileCopyrightText: 2026 Hwang Dae Jin (Philosophy That Works)
// SPDX-License-Identifier: CC0-1.0
// (원자료 모양 — 다른 구현이 GRID/1을 맞춰 보는 데 쓰는 적합성 자료라 누구나 자유롭게 써요)
// 원자료 capture/1의 모양 — 걸음 스크립트(src/page/walker.js)의 __grid.capture()가 만들고, 읽기 모듈이 짚기 결과(hit · by)를 채운다.
// 좌표는 모두 CSS px, 문서(페이지 맨 위 왼쪽) 기준 [x, y, 너비, 높이]. 고정(fixed)된 것은 capture 순간의 스크롤(scroll.y)을 빼면 창 기준.

export type Rect = [x: number, y: number, w: number, h: number];

/** 가린 것이 속한 층 (가장 바깥의 fixed 조상이나 대화상자) */
export interface Layer {
  role: string | null;
  name: string;
  pin?: "fixed";
  /** 층 안의 닫기 단추 번호 — 닫기 · × · close 같은 것. "확인 · OK"는 단추가 하나뿐인 알림(대화상자 아님)에서만 */
  close?: number;
  /** 층 안의 첫 번호들 (이름이 없을 때 설명용) */
  acts?: number[];
  /** 층 안의 번호 붙은 것의 수 */
  count?: number;
  /** 층의 높이 (px) — 창의 1/4 이상이면 팝업으로 봄 */
  h?: number;
}

/** 무엇이 가렸나: 번호 · 투명한 링크(가짜 단추 ⚠) · 이름표 · 태그 (+ 층) */
export interface Coverer {
  n?: number;
  invisible?: boolean;
  link?: boolean;
  host?: string;
  label?: string;
  tag?: string;
  layer?: Layer;
}

export type State = "disabled" | "checked" | "expanded" | "selected" | "pressed" | "required" | "readonly" | "invalid" | "current" | "popup";

interface Base {
  r: Rect;
  /** 속한 영역 번호 (regions[].id), 없으면 null */
  region: number | null;
  pin: "fixed" | "sticky" | null;
  /** 스스로 스크롤하는 상자 번호 (scrollers[].id) */
  sc: number | null;
  /** 그 상자 안에서 지금 안 보임 (상자를 넘겨야 보임) */
  scHidden?: boolean;
}

/** 누를 수 있는 것 — 번호 n은 페이지가 열려 있는 동안 바뀌지 않는다 */
export interface Action extends Base {
  kind: "action";
  n: number;
  role: string;
  name: string;
  tag: string;
  states: State[];
  /** 입력칸 값 ("(empty)" · 암호 칸은 "(filled)"/"(empty)"만 · maskValues면 적은 값 모두 "(filled)"/"(empty)"만 — 고른 값(select) · slider는 그대로) */
  value?: string;
  sensitive?: boolean;
  href?: string;
  options?: string[];
  /** 잘라서 숨기는 상자(슬라이드 등) 밖이라 지금 안 보임 */
  clipped?: boolean;
  /** 문단 글(t 번호) 속에 [n 이름]으로 적힘 */
  inT?: number;
  /** 짚기 결과: true 맨 위 · false 가려짐 · null 모름(짚지 못함) */
  hit?: boolean | null;
  by?: Coverer;
}

export interface Text extends Base {
  kind: "text" | "heading";
  t: number;
  /** 문단 속 링크는 ⟦n|이름⟧ 표시로 들어 있음 */
  text: string;
  level?: number;
  chars?: number;
  links?: number[];
  /** 링크만 있고 다른 글이 없는 덩어리 (글 줄로 쓰지 않음) */
  onlyLinks?: boolean;
}

export interface Media extends Base {
  kind: "media";
  t: number;
  role: "img" | "video" | "canvas" | "iframe";
  name: string;
}

export type Item = Action | Text | Media;

export interface Region {
  id: number;
  role: string;
  name: string;
  r: Rect;
  pin: "fixed" | "sticky" | null;
  parent: number | null;
  modal?: boolean;
}

export interface Scroller {
  id: number;
  axis: "x" | "y" | "xy";
  r: Rect;
  scrollHeight: number;
  clientHeight: number;
  scrollWidth: number;
  clientWidth: number;
  pin: "fixed" | "sticky" | null;
}

export interface HitScreen {
  scrollY: number;
  /** a = 그 화면에서 보인 넓이 비율 (0~1) — 늘 가려졌으면 가장 잘 보이던 화면의 가린 것을 씀 */
  res: Array<{ n: number; ok: boolean; a?: number; by?: Coverer }>;
}

export interface Capture {
  capture: 1;
  no: number;
  /** 페이지 주소 (dropQuery면 ?뒤 · #뒤를 뺀 것) */
  url: string;
  title: string;
  /** (v0.1.3) 읽을 때 가린 것 — maskValues: 사람이 적은 값은 "(filled)"/"(empty)"만 · dropQuery: 주소의 ?뒤 · #뒤 뺌 */
  privacy?: { maskValues: boolean; dropQuery: boolean };
  viewport: { w: number; h: number };
  page: { w: number; h: number };
  scroll: { x: number; y: number };
  dpr: number;
  items: Item[];
  regions: Region[];
  scrollers: Scroller[];
  /** 모델에게 보내지 않은 숨은 글 · 컨트롤 수 */
  dropped: Record<"aria-hidden" | "tiny" | "transparent" | "sr-only" | "offscreen" | "low-contrast" | "nameless", number>;
  hiddenSamples: Array<{ why: string; text: string }>;
  facts: { lang: string; types: string[]; og: Record<string, string>; product?: { name: string; price?: string | number; currency?: string; availability?: string } };
  visits: number;
  truncated: boolean;
  ms: number;
  shots?: Array<{ file: string; scrollY: number; w: number; h: number }>;
  log?: Record<string, unknown>;
}
