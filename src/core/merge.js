// SPDX-FileCopyrightText: 2026 Hwang Dae Jin (Philosophy That Works)
// SPDX-License-Identifier: AGPL-3.0-only
// 화면마다 짚은 결과(__grid.hitTest)를 원자료(capture/1)에 합친다 — 순수 계산
//
// 한 화면에서라도 맨 위였으면 "누를 수 있음"(hit: true). 짚지 못한 것(화면 밖 · 잘림 · 가린 것을 모름)은 null.
// 늘 가려졌으면 **가장 잘 보이던 화면**(보인 넓이 a가 가장 큰)의 가린 것을 적는다 — 화면 끝에 살짝 걸친 화면의 가린 것은 틀리기 쉬움

/**
 * @param {import("./capture").Capture} cap
 * @param {Array<import("./capture").HitScreen>} screens
 * @returns {import("./capture").Capture} 같은 cap (항목에 hit · by를 채움)
 */
export function mergeHits(cap, screens) {
  const hits = new Map();
  for (const s of screens) {
    for (const h of s.res) {
      const prev = hits.get(h.n);
      if (!prev || (!prev.ok && (h.ok || (h.a ?? 0) > (prev.a ?? 0)))) hits.set(h.n, h);
    }
  }
  for (const it of cap.items) {
    if (it.kind !== "action") continue;
    const h = hits.get(it.n);
    it.hit = h ? h.ok : null;
    if (h && !h.ok) it.by = h.by;
    else delete it.by;
  }
  return cap;
}
