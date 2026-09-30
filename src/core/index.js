// SPDX-FileCopyrightText: 2026 Hwang Dae Jin (Philosophy That Works)
// SPDX-License-Identifier: AGPL-3.0-only
// grid 공개 입구 — 원자료(capture/1)를 에이전트가 읽는 글(GRID/1)로. 순수 계산 · 의존성 없음 (Node · Electron · 브라우저 어디서든)
//
//   import { toText, legend } from "ptw-grid";                  // 패키지로 (package.json exports)
//   import { toText, legend } from "…/ptw-grid/src/core/index.js"; // 또는 파일 길로 (복사해 쓸 때)
//   const text = toText(capture);      // 에이전트에게 주는 글 (12칸 GRID/1)
//   const how = legend(capture);       // 에이전트에게 한 번 주는 읽는 법 (창 높이에 맞춤)
//
// 문법 명세: spec/GRID-1.md · 원자료 모양: src/core/capture.d.ts
import { format, LEGEND, legendFor } from "./format.js";

export { format, LEGEND, legendFor, prune, spanOf, covererText, roughTokens, estimateTokens, pageStr, countInvisible, INVISIBLE, CLOSE_NAME, ACK_NAME, COLS, ROW_H } from "./format.js";
export { mergeHits } from "./merge.js";
export { budgeted, fit, forView, frame, newTag, screensOf, viewScreen } from "./budget.js";
export { hostVerdict, isIpLiteral, isLocalHost, topAllowed } from "./net.js";

/** 이 글 문법의 이름 · 판 */
export const GRAMMAR = "GRID/1";

/**
 * 에이전트에게 주는 글 (기본 12칸 GRID/1). 실험용 다른 형식은 format(capture, "B" | "C" | "D").
 * @param {import("./capture").Capture} capture
 */
export const toText = (capture) => format(capture, "A");

/**
 * 에이전트에게 한 번 주는 읽는 법 (GRID/1). 원자료를 주면 그 창 높이에 맞춘 "한 화면 = N줄" (기본 800px → 20줄)
 * @param {import("./capture").Capture} [capture]
 */
export const legend = (capture) => (capture ? legendFor(capture, "A") : LEGEND.A);
