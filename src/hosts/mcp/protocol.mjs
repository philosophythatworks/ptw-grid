// SPDX-FileCopyrightText: 2026 Hwang Dae Jin (Philosophy That Works)
// SPDX-License-Identifier: AGPL-3.0-only
// grid 연결(MCP) — 말 규칙만 (순수 계산 · 의존성 없음). stdio로 오가는 한 줄 JSON-RPC를 받아 대답을 만든다.
//
// 두 세대를 다 알아듣는다:
//   새 판 2026-07-28 — 요청마다 params._meta에 판 · 클라이언트 능력을 싣고 옴 · server/discover 필수 · 결과마다 resultType
//   옛 판 2025-11-25 · 2025-06-18 · 2025-03-26 · 2024-11-05 — initialize → notifications/initialized → tools/list · tools/call · ping
// 도구가 하는 일(읽기)은 여기 없다 — createProtocol({ call })로 받아 쓴다.

export const MODERN = ["2026-07-28"];
export const LEGACY = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
export const SUPPORTED = [...MODERN, ...LEGACY];
const V = "io.modelcontextprotocol/protocolVersion";
const CAPS = "io.modelcontextprotocol/clientCapabilities";
const SERVER_INFO = "io.modelcontextprotocol/serverInfo";

export const ERR = { PARSE: -32700, INVALID_REQUEST: -32600, METHOD: -32601, PARAMS: -32602, INTERNAL: -32603, UNSUPPORTED_VERSION: -32022 };

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const reply = (id, result) => ({ jsonrpc: "2.0", id, result });
const fail = (id, code, message, data) => ({ jsonrpc: "2.0", id: id ?? null, error: data === undefined ? { code, message } : { code, message, data } });

/**
 * @param {{
 *   name: string, title?: string, version: string, instructions: string,
 *   tools: Array<{ name: string, title?: string, description: string, inputSchema: object, annotations?: object }>,
 *   call: (name: string, args: object, ctx: { id: string|number, signal: AbortSignal, progress: (message: string) => void }) => Promise<{ text: string, isError?: boolean }>,
 *   notify?: (message: object) => void,
 * }} o  notify: 알림을 내보내는 곳 (진행 알림 — 부른 쪽이 progressToken을 줬을 때만)
 */
export function createProtocol({ name, title, version, instructions, tools, call, notify = () => {} }) {
  const info = { name, ...(title ? { title } : {}), version };
  const toolNames = new Set(tools.map((t) => t.name));
  const inflight = new Map(); // 요청 id → AbortController (취소 알림용)
  let legacyVersion = null; // 옛 판으로 인사한 뒤의 판

  /** 들어온 알림 처리 (대답 없음) — 내보내는 notify와 이름이 겹치지 않게 */
  function onNotification(msg) {
    if (msg.method === "notifications/cancelled") {
      const rid = msg.params?.requestId;
      inflight.get(rid)?.abort();
    }
    // notifications/initialized 등은 받기만
  }

  /** 도구 부르기 — 결과 모양은 세대에 따라 */
  async function callTool(id, params, modern) {
    if (!isObj(params) || typeof params.name !== "string") return fail(id, ERR.PARAMS, "tools/call needs params.name");
    if (!toolNames.has(params.name)) return fail(id, ERR.PARAMS, `Unknown tool: ${params.name}`);
    if (params.arguments !== undefined && !isObj(params.arguments)) return fail(id, ERR.PARAMS, "tools/call arguments must be an object");
    const ac = new AbortController();
    inflight.set(id, ac);
    // 진행 알림: 부른 쪽이 _meta.progressToken을 줬을 때만 · 숫자는 늘기만 (오래 걸리는 읽기에서 부른 쪽이 기다리게)
    const token = isObj(params._meta) ? params._meta.progressToken : undefined;
    let step = 0;
    const progress = (message) => {
      if (token === undefined || ac.signal.aborted) return;
      notify({ jsonrpc: "2.0", method: "notifications/progress", params: { progressToken: token, progress: ++step, message: String(message).slice(0, 200) } });
    };
    try {
      const r = await call(params.name, params.arguments || {}, { id, signal: ac.signal, progress });
      if (ac.signal.aborted) return null; // 취소된 요청에는 아무것도 보내지 않음
      const content = [{ type: "text", text: r.text }];
      return reply(id, modern ? { resultType: "complete", content, isError: !!r.isError, _meta: { [SERVER_INFO]: info } } : { content, isError: !!r.isError });
    } catch (e) {
      if (ac.signal.aborted) return null;
      const content = [{ type: "text", text: `[grid] ${String(e?.message || e).slice(0, 300)}` }];
      return reply(id, modern ? { resultType: "complete", content, isError: true, _meta: { [SERVER_INFO]: info } } : { content, isError: true });
    } finally {
      inflight.delete(id);
    }
  }

  /** 한 메시지 → 대답 (알림이면 null) */
  async function handle(msg) {
    if (!isObj(msg) || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
      return fail(isObj(msg) && (typeof msg.id === "string" || typeof msg.id === "number") ? msg.id : null, ERR.INVALID_REQUEST, "Invalid JSON-RPC request");
    }
    if (!("id" in msg)) {
      onNotification(msg);
      return null;
    }
    const { id, method } = msg;
    if (id === null || (typeof id !== "string" && typeof id !== "number")) return fail(null, ERR.INVALID_REQUEST, "Request id must be a string or number");
    const params = msg.params;
    const meta = isObj(params) && isObj(params._meta) ? params._meta : null;

    // ── 새 판: 요청마다 판이 실려 옴 ──
    if (meta && meta[V] !== undefined) {
      const ver = meta[V];
      if (!MODERN.includes(ver)) return fail(id, ERR.UNSUPPORTED_VERSION, "Unsupported protocol version", { supported: SUPPORTED, requested: ver });
      if (!isObj(meta[CAPS])) return fail(id, ERR.PARAMS, `Missing required _meta field ${CAPS}`);
      const done = (result) => reply(id, { resultType: "complete", ...result, _meta: { [SERVER_INFO]: info } });
      if (method === "server/discover") return done({ supportedVersions: SUPPORTED, capabilities: { tools: {} }, instructions, ttlMs: 3600000, cacheScope: "public" });
      if (method === "tools/list") return done({ tools, ttlMs: 3600000, cacheScope: "public" });
      if (method === "tools/call") return callTool(id, params, true);
      return fail(id, ERR.METHOD, `Method not found: ${method}`);
    }

    // ── 옛 판: 인사(initialize)로 판을 정함 ──
    if (method === "initialize") {
      const asked = isObj(params) ? params.protocolVersion : undefined;
      legacyVersion = LEGACY.includes(asked) ? asked : LEGACY[0];
      return reply(id, { protocolVersion: legacyVersion, capabilities: { tools: { listChanged: false } }, serverInfo: info, instructions });
    }
    if (method === "ping") return reply(id, {});
    if (method === "tools/list") return reply(id, { tools });
    if (method === "tools/call") return callTool(id, params, false);
    if (method === "server/discover") return fail(id, ERR.PARAMS, `server/discover needs _meta["${V}"] (supported: ${SUPPORTED.join(", ")})`);
    return fail(id, ERR.METHOD, `Method not found: ${method}`);
  }

  /**
   * 한 줄 → 보낼 줄들 (0개 · 1개). 옛 판의 묶음(배열)도 받는다.
   * @param {string} line
   * @returns {Promise<string[]>}
   */
  async function handleLine(line) {
    const t = line.trim();
    if (!t) return [];
    let msg;
    try {
      msg = JSON.parse(t);
    } catch {
      return [JSON.stringify(fail(null, ERR.PARSE, "Parse error"))];
    }
    if (Array.isArray(msg)) {
      if (!msg.length) return [JSON.stringify(fail(null, ERR.INVALID_REQUEST, "Empty batch"))];
      const out = (await Promise.all(msg.map(handle))).filter(Boolean);
      return out.length ? [JSON.stringify(out)] : [];
    }
    const r = await handle(msg);
    return r ? [JSON.stringify(r)] : [];
  }

  return { handle, handleLine, get legacyVersion() { return legacyVersion; } };
}
