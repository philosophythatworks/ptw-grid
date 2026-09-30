// SPDX-FileCopyrightText: 2026 Hwang Dae Jin (Philosophy That Works)
// SPDX-License-Identifier: AGPL-3.0-only
// grid — 주소 규칙 (순수 계산)
// 끝에 점이 붙은 이름("localhost.")도 끝 점을 떼고 검사해요.
// IPv6는 여덟 칸으로 읽어 판단 — ::7f00:1 · ::ffff:0:7f00:1 · 64:ff9b:1::/48 · fec0::/10 · 2002::/16(6to4) · 멀티캐스트도 막음.

const privateV4 = (a, b) =>
  a === 127 || a === 10 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
/** 16비트 두 칸(IPv6 안에 품은 IPv4)의 앞 칸으로 판단 */
const privateHex = (hi) => privateV4(hi >> 8, hi & 255);

/**
 * IPv6 글을 16비트 여덟 칸으로 — "::" 줄임 · 끝의 IPv4 점 꼴(::ffff:1.2.3.4)도. 읽을 수 없으면 null
 * @param {string} h 대괄호 없는 소문자
 */
function hextets(h) {
  const dotted = /^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (dotted) {
    const n = dotted.slice(2).map(Number);
    if (n.some((v) => v > 255)) return null;
    h = `${dotted[1]}${((n[0] << 8) | n[1]).toString(16)}:${((n[2] << 8) | n[3]).toString(16)}`;
  }
  const halves = h.split("::");
  if (halves.length > 2) return null;
  const part = (x) => (x ? x.split(":") : []);
  const left = part(halves[0]);
  const right = halves.length === 2 ? part(halves[1]) : [];
  const fill = halves.length === 2 ? 8 - left.length - right.length : 0;
  if (fill < 0 || (halves.length === 2 && fill === 0 && left.length + right.length === 8)) return null;
  const all = [...left, ...Array(fill).fill("0"), ...right];
  if (all.length !== 8 || !all.every((x) => /^[0-9a-f]{1,4}$/.test(x))) return null;
  return all.map((x) => parseInt(x, 16));
}

/** 이 컴퓨터 안이나 우리 집 안을 가리키는 주소인지 (루프백 · 사설 · link-local · CGNAT · localhost · mDNS .local) */
export function isLocalHost(hostname) {
  let h = String(hostname || "").toLowerCase();
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
  h = h.replace(/\.+$/, ""); // "localhost." 같은 끝 점은 같은 이름
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(h);
  if (v4) return privateV4(+v4[1], +v4[2]);
  if (!h.includes(":")) return false;
  // IPv6 — 여덟 칸으로 읽어서 판단 (줄임 꼴이 달라도 같은 주소는 같게)
  const x = hextets(h.replace(/%.*$/, "")); // "fe80::1%en0" 같은 영역 표시는 떼고
  if (!x) return true; // 읽을 수 없으면 막음
  const zero = (i, j) => x.slice(i, j).every((v) => v === 0);
  if (zero(0, 6)) return true; // :: · ::1 · ::a.b.c.d (IPv4 호환, 옛 꼴 — 통째로 막음)
  if (zero(0, 5) && x[5] === 0xffff) return privateHex(x[6]); // ::ffff:a.b.c.d (IPv4 대응)
  if (zero(0, 4) && x[4] === 0xffff && x[5] === 0) return privateHex(x[6]); // ::ffff:0:a.b.c.d (IPv4 번역)
  if (x[0] === 0x64 && x[1] === 0xff9b) return x[2] === 1 || (zero(2, 6) && privateHex(x[6])); // NAT64: 64:ff9b:1::/48(이 망 안)은 통째로, 64:ff9b::/96은 품은 IPv4로 (공개면 통과 — DNS64 망이 안 깨지게)
  if (x[0] === 0x2002) return privateHex(x[1]); // 6to4 (2002:AABB:CCDD::)에 품은 IPv4
  return (x[0] & 0xfe00) === 0xfc00 || (x[0] & 0xffc0) === 0xfe80 || (x[0] & 0xffc0) === 0xfec0 || (x[0] & 0xff00) === 0xff00; // ULA · link-local · site-local(옛) · 멀티캐스트
}

const parse = (url) => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};

/** 맨 위 페이지로 열 수 있는 주소인지 (http · https만, 이 컴퓨터 안 주소 · 아이디/비밀번호가 든 주소는 안 됨 — 뒤의 것은 grid에서 더함) */
export function topAllowed(url) {
  if (url === "about:blank") return true;
  const u = parse(url);
  if (!u || (u.protocol !== "http:" && u.protocol !== "https:")) return false;
  if (u.username || u.password) return false;
  return !isLocalHost(u.hostname);
}

/** 이름이 아니라 숫자 주소(IPv4 · IPv6)인지 — 이름이면 풀어 본 실제 주소도 확인해야 함.
 *  (주소 규칙은 URL이 다듬은 이름 · 풀어 본 주소를 받는다고 봐요 — "127.1" · "2130706433" 같은 꼴은 new URL()이 127.0.0.1로 바꿔 줘요) */
export function isIpLiteral(hostname) {
  let h = String(hostname || "").toLowerCase();
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":");
}

/**
 * 이름을 풀어 본 실제 주소로 판정 (숨은 읽기 창과, 이 모듈을 쓰는 앱의 보이는 브라우저가 함께 씀)
 *   "ok" 공개 · "local" 이 컴퓨터 안이나 집 안 · "sink" 모두 0.0.0.0 / :: (광고 차단 DNS가 막은 이름) · "dns" 못 풂
 * - 못 풀면 막되 기억하지 않아요 (한 번 실패시키고 다음에 이 컴퓨터 안을 주는 속임수 방지). 공개는 10초, 로컬 · sink는 1분 기억 (최대 2000개).
 * - 같은 이름을 동시에 물으면 한 번만 풀어요 (보이는 브라우저는 요청이 몰려서).
 * - clear(): 기억을 비우고, 날고 있는 조회의 결과도 버려요 (로그아웃 · 네트워크가 바뀔 때).
 * - resolve가 던지거나 이상한 값을 줘도 "dns"로 (요청 검사기가 영영 기다리지 않게).
 * 남는 틈: 이름의 수명이 0이면 검사와 실제 연결 사이에 주소가 바뀔 수 있어요 — 그래서 로컬 네트워크 권한 거절을 함께 둬요.
 * @param {(host: string) => Promise<{ endpoints: { address: string }[] }>} resolve 예: (h) => session.resolveHost(h)
 * @returns {((host: string) => Promise<"ok" | "local" | "sink" | "dns">) & { clear: () => void }}
 */
export function hostVerdict(resolve) {
  const cache = new Map();
  const flying = new Map();
  let gen = 0;
  const classify = (r) => {
    const a = (Array.isArray(r?.endpoints) ? r.endpoints : []).map((e) => String(e?.address ?? ""));
    if (!a.length) return "dns";
    if (a.every((x) => x === "0.0.0.0" || x === "::")) return "sink";
    return a.some((x) => isLocalHost(x)) ? "local" : "ok";
  };
  const verdict = (host) => {
    const now = Date.now();
    const c = cache.get(host);
    if (c && now - c.t < (c.v === "ok" ? 10_000 : 60_000)) return Promise.resolve(c.v);
    if (c) cache.delete(host);
    if (!flying.has(host)) {
      const mine = gen;
      const p = Promise.resolve()
        .then(() => resolve(host))
        .then(classify)
        .catch(() => "dns")
        .then((v) => {
          if (mine === gen) {
            flying.delete(host);
            if (v !== "dns") {
              if (cache.size >= 2000) for (const [k, e] of cache) if (Date.now() - e.t > 60_000 || cache.size >= 2000) cache.delete(k);
              cache.set(host, { v, t: Date.now() });
            }
          }
          return v;
        });
      flying.set(host, p);
    }
    return flying.get(host);
  };
  verdict.clear = () => {
    gen++;
    cache.clear();
    flying.clear();
  };
  return verdict;
}
