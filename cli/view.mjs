// SPDX-FileCopyrightText: 2026 Hwang Dae Jin (Philosophy That Works)
// SPDX-License-Identifier: AGPL-3.0-only
// "AI가 보는 화면": 화면 사진 위에 12칸 격자 · 40px 줄 · 번호표를 겹친 한 장짜리 HTML (이 컴퓨터에서만 여는 파일)
import { readFileSync } from "node:fs";
import path from "node:path";
import { LEGEND, toText } from "../src/core/index.js";

/**
 * @param {import("../src/core/capture").Capture} cap
 * @param {string} dir 사진(shot-k.jpg)이 있는 폴더
 */
export function viewHtml(cap, dir) {
  // 사진을 파일 안에 넣어 한 장으로 (어디서 열어도 보이게)
  const img = (file) => `data:image/jpeg;base64,${readFileSync(path.join(dir, file)).toString("base64")}`;
  const W = cap.viewport.w;
  const VH = cap.viewport.h;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const cols = Array.from({ length: 12 }, (_, i) => `<div class="col" style="left:${(i * W) / 12}px;width:${W / 12}px"><b>${"ABCDEFGHIJKL"[i]}</b></div>`).join("");
  const screens = (cap.shots || [])
    .map((s, k) => {
      const rows = Array.from({ length: Math.ceil(VH / 40) }, (_, i) => {
        const row = Math.floor(s.scrollY / 40) + i + 1;
        return `<div class="row" style="top:${i * 40 - (s.scrollY % 40)}px"><b>${row}</b></div>`;
      }).join("");
      const marks = cap.items
        .filter((it) => it.kind === "action")
        .map((it) => {
          const fixed = it.pin === "fixed";
          const y = fixed ? it.r[1] - cap.scroll.y : it.r[1] - s.scrollY;
          if (y + it.r[3] < 0 || y > VH) return "";
          const cls = it.hit === false ? "mark covered" : "mark";
          return `<div class="${cls}" style="left:${it.r[0]}px;top:${y}px;width:${it.r[2]}px;height:${it.r[3]}px" title="[${it.n}] ${esc(it.role)} ${esc(it.name)}"><span>${it.n}</span></div>`;
        })
        .join("");
      return `<h2>화면 ${k + 1} · 스크롤 ${s.scrollY}px</h2><div class="screen" style="width:${W}px;height:${VH}px"><img src="${img(s.file)}" width="${W}" height="${VH}">${cols}${rows}${marks}</div>`;
    })
    .join("");
  return `<!doctype html><meta charset="utf-8"><title>AI가 보는 화면 · ${esc(cap.title)}</title>
<style>
body{font:13px -apple-system,system-ui,sans-serif;margin:16px;background:#fafafa;color:#111}
h1{font-size:15px;margin:0 0 4px}h2{font-size:13px;margin:18px 0 6px;color:#555}
.wrap{display:flex;gap:16px;align-items:flex-start}.screen{position:relative;overflow:hidden;border:1px solid #ccc;background:#fff;flex:none}
.screen img{position:absolute;left:0;top:0}
.col{position:absolute;top:0;bottom:0;border-left:1px dashed rgba(255,0,80,.35)}.col b{position:absolute;top:0;left:2px;font-size:10px;color:#e0005a;background:#fff8;padding:0 2px}
.row{position:absolute;left:0;right:0;height:40px;border-top:1px dashed rgba(0,90,255,.25)}.row b{position:absolute;left:0;top:0;font-size:9px;color:#0050d0;background:#fff8;padding:0 2px}
.mark{position:absolute;border:1.5px solid rgba(0,160,90,.9);box-sizing:border-box}.mark span{position:absolute;left:-1px;top:-1px;background:#0a8f55;color:#fff;font-size:10px;line-height:13px;padding:0 3px;border-radius:0 0 3px 0}
.mark.covered{border-color:#e33;border-style:dashed}.mark.covered span{background:#e33}
pre{white-space:pre-wrap;font:11.5px ui-monospace,Menlo,monospace;background:#fff;border:1px solid #ddd;padding:10px;max-width:640px;margin:0}
</style>
<h1>AI가 보는 화면 — ${esc(cap.title)}</h1><div>${esc(cap.url)} · 초록 = 누를 수 있는 것(번호) · 빨강 점선 = 가려짐 · 분홍 = 12칸 · 파랑 = 40px 줄</div>
<div class="wrap"><div>${screens}</div><div><h2>그리드 글 (GRID/1)</h2><pre>${esc(toText(cap))}</pre><h2>모델에게 주는 설명</h2><pre>${esc(LEGEND.A)}</pre></div></div>`;
}
