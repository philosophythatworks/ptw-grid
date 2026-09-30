# PTW grid — AI eyes for web reading, by Philosophy That Works

**웹을 읽는 AI의 눈**

[English](README.md) · 한국어

PTW grid는 공개된 웹 페이지를 **GRID/1**이라는 한 가지 글 형식으로 바꿔 주는 프로그램이에요. 어떤 AI 에이전트든 같은 방식으로 페이지를 읽고, 무엇이 어디에 있는지, 무엇이 무엇을 가리고 있는지 알 수 있게 해 줘요. (PTW는 Philosophy That Works의 줄임말이에요.)

> **지금은 v0.1.4예요. 읽기만 해요.** 누르기와 입력은 아직 없어요. macOS에서만 시험했어요.

## 무엇을 하나요

주소를 하나 주면 화면에 보이지 않는 브라우저 창에서 페이지를 열고, 이렇게 적어 줘요. 아래는 우리 시험 페이지(`cli/fixtures/checkout.html`)를 읽은 결과의 일부예요(정답 글 `test/snapshots/checkout.A.txt`에서 가져왔고, `…`는 줄인 곳이에요).

```
GRID/1 · gridfix://fixture/checkout.html · "여름 반팔 티셔츠 | 예시몰"
sheet A–L × 40px rows from page top · screen = 20 rows · page ≈ 1.0 screens (rows 1–20)
view rows 1–20 (screen 1/1)
checks: covered 2/14 tested · hidden text dropped 0
⚠ O1 = popup section "쿠키 안내" — covers 2 items (2 in view); close it with [14] first
▸ pinned (stays on screen while scrolling) · section "쿠키 안내"
  t12 "이 사이트는 더 나은 서비스를 위해 쿠키를 사용합니다." @vA12-vD12
  [14] button "확인" @vA13
▸ header @A1-L2
  [1] link "예시몰" (sticky) @A1
  [2] link "장바구니 (0)" (sticky) @L1
▸ main @A2-L18
  img t1 "빨간 반팔 티셔츠 사진" @A2-F13
  # t2 "여름 반팔 티셔츠" @G3-I4
  t3 "~~25,000원~~ 19,900원" @G4-H5
  …
  [4] select "색상" (required) =선택하세요 · 선택하세요/빨강/파랑/검정 @G7-H8
  …
  [12] button "바로 구매" (covered by O1) @H12-I13
  [13] button "장바구니 담기" (disabled, covered by O1) @G12-H13
…
```

이렇게 읽으면 돼요.

- 페이지 전체를 한 장의 긴 **판**으로 봐요. 가로는 창 너비를 **12칸(A–L)**으로 나누고, 세로는 **40px 줄**로 페이지 맨 위부터 끝까지 이어서 세요. 창이 1280×800이라서 **20줄이 한 화면**이에요.
- `[14]`처럼 대괄호 번호가 붙은 건 누르거나 고를 수 있는 것(단추 · 링크 · 입력 칸)이에요. 역할(`button`), 이름(`"확인"`), 상태(`disabled` 같은 것)를 함께 적어요.
- `t2` 같은 건 글이고, `#`은 제목, `img`는 그림이에요.
- `@G7-H8`은 그 항목이 차지하는 칸이에요(왼쪽 위 G7부터 오른쪽 아래 H8까지). `@v…`는 스크롤해도 창에 붙어 있는 것의 자리로, 창 맨 위부터 센 줄이에요.
- `▸ header` · `▸ main` 같은 줄은 페이지의 구역이고, `── screen 2 · rows 21–40 ──` 같은 줄은 다음 화면이 시작되는 곳이에요.
- `⚠ O1`은 다른 것을 덮고 있는 층(쿠키 안내 · 팝업 · 대화상자 같은 것)이에요. 무엇을 몇 개 가리는지, 어떻게 닫는지 알려 줘요. 가려진 항목에는 `covered by O1`이 붙어요.
- `checks:` 줄은 코드로 확인한 결과예요. `covered 2/14 tested`는 누를 수 있는 것 14개를 확인했더니 2개가 무언가에 가려져 있다는 뜻이에요. 보이지 않게 숨긴 글은 AI에게 보내지 않고 **몇 개였는지만** 세요(`hidden text dropped`).
- MCP로 받는 결과는 약 8천 토큰(토큰: AI가 글을 세는 단위) 안에 맞춰요. 긴 페이지는 앞 화면을 온전히 적고 뒤 화면은 제목만 적어요. 나머지는 `grid_screen`으로 더 읽으면 돼요.

## 왜 만들었나요

AI 에이전트가 웹 페이지를 읽을 때는 보통 두 가지 중 하나를 써요. 화면 사진을 보거나(토큰이 많이 들고, 글자나 자리를 잘못 읽기도 해요), 페이지 속 요소를 그냥 목록으로 받거나요(무엇이 어디 있는지, 무엇이 무엇을 가리는지가 사라져요). 코드에 적힌 순서와 눈에 보이는 자리가 다른 페이지도 많아요.

PTW grid는 그 사이를 메워요.

- **한 가지 문법**이에요. 어떤 에이전트든 같은 글을 같은 방식으로 읽어요. 읽는 법은 한 문단이면 돼요.
- **코드로 알 수 있는 건 코드로 재요.** 자리 · 가려짐 · 고정된 것 · 숨은 글처럼 확실히 잴 수 있는 건 프로그램이 재요. 돈이 들지 않고, 정확하고, 늘 같아요. AI는 이해하고 판단하는 데 힘을 쓰면 돼요.
- **안전하게 건네요.** 웹에서 온 글은 믿을 수 없는 자료로 감싸서 주고, AI를 속이려는 숨은 글은 걸러 내요.

작은 실험으로 효과를 확인했어요.

- 적힌 순서와 보이는 자리가 어긋나는 "레이아웃 함정" 질문 35개에서, Claude 모델 네 가지(Haiku · Sonnet · Opus · Fable)가 12칸 자리가 있을 때는 **모두 100%** 맞혔어요. 같은 글에서 자리만 빼면 60.7%였어요.
- 실제 페이지와 시험 페이지를 섞은 12쪽에서 GRID/1은 **99.5%**, 그냥 요소 목록은 87.2%였어요. 여기서는 차이의 대부분이 자리 자체보다 구역 · 화면 구분 · 고정된 것 · 가려짐 표시에서 나왔어요.

규모가 작은 실험이니 참고로만 봐 주세요. 실험 자료는 이 저장소에 들어 있지 않아요.

## 지금 상태

- 판은 **v0.1.4**이고 **읽기 전용**이에요. 누르기 · 입력 같은 "손" 기능은 이번 판에 들어 있지 않아요.
- **macOS**에서 Node.js 26.x · Electron 44.x로만 시험했어요. 다른 운영체제나 다른 판에서는 시험해 보지 않았어요.
- npm 꾸러미 이름은 `ptw-grid`인데, 아직 npm에 올리지 않았어요. 지금은 저장소를 내려받아서 써요.
- 코드 주석은 한국어예요. 사용자에게 보이는 메시지와 도구 설명은 영어예요. 다만 세 가지는 한국어예요. 이름이 없는 아이콘 단추에 class · id를 보고 짐작해 붙이는 이름(`~`가 붙은 것, 예: `"~메뉴"`)은 지금은 한국어로 나와요. 시험 프로그램이 만드는 `view.html`의 안내 글(제목 · 색 설명 등)도 지금은 한국어예요. 시험(`npm test` · `test:electron` · `test:mcp`)의 시험 이름과 확인 결과 글도 한국어예요.
- 아직 초기 판이라 바뀌는 곳이 있을 수 있어요. 바뀐 내용은 [CHANGELOG.md](CHANGELOG.md)에 적어요.

## 설치

필요한 것: macOS · git · Node.js (26.x에서 시험했어요 — 다른 판은 시험하지 않았어요)

```bash
git clone https://github.com/philosophythatworks/ptw-grid.git
cd ptw-grid
npm install   # 숨은 브라우저로 쓰는 Electron을 내려받아요 (시간이 조금 걸려요)
npm test      # 핵심 · MCP 시험 — 인터넷과 Electron 없이 돌아요
```

- **Electron**은 크롬과 같은 엔진으로 데스크톱 앱을 만드는 틀이에요. PTW grid는 이걸로 화면에 보이지 않는 창을 띄워서 페이지를 읽어요. 44.x로 시험했어요.

시험이 두 가지 더 있어요. 둘 다 Electron을 띄우고, 우리 시험 페이지로만 확인해서 인터넷은 없어도 돼요.

```bash
npm run test:electron   # 읽기 모듈 시험 (숨은 창)
npm run test:mcp        # MCP 서버를 진짜로 띄워서 끝까지 시험 (1분쯤 걸려요)
```

- `npm test`는 마지막에 `fail 0`이 나오면 모두 통과한 거예요.
- `test:electron`과 `test:mcp`는 확인마다 한 줄씩 ✔(통과)나 ✘(실패)를 찍고, 실패가 없으면 코드 0으로 끝나요. `test:electron`에서 시험용 이름을 풀어 봐야 하는 확인 하나는, 인터넷이 없는 때처럼 이름을 풀 수 없으면 –(건너뜀)으로 나와요.
- `npm run test:mcp`를 돌리기 전에는 PTW grid를 쓰는 다른 앱(Claude Desktop이나, PTW grid를 등록한 Claude Code 같은 것)을 꺼 주세요. 다른 PTW grid 읽기 프로세스가 같이 돌고 있으면 마지막 확인이 실패해요.

## 빠르게 해 보기

### 페이지 하나 읽어 보기 (시험 프로그램)

```bash
npx electron cli/grid.mjs read https://example.com
```

`npm run read -- https://example.com`도 똑같아요. 주소를 여러 개 적어도 돼요.

결과는 `runs/<날짜-시각>/<페이지 이름>/` 폴더에 남아요. 날짜-시각은 UTC 기준이고, 페이지 이름은 주소의 호스트와 경로로 지어요(예: `example-com`, `fixture-shop-html`). `runs/<날짜-시각>/summary.json`에는 전체 요약이 들어가요.

| 파일 | 내용 |
|---|---|
| `grid-A.txt` | GRID/1 글 — AI가 받는 것 |
| `capture.json` | 페이지에서 잰 원자료 |
| `shot-1.jpg` … | 화면마다 찍은 사진 |
| `view.html` | 사진 위에 12칸 격자와 번호를 겹쳐 보여 주는 한 장짜리 페이지 — AI가 보는 것을 사람이 눈으로 확인할 때 써요 |

옵션:

- `--out runs/<이름>` — 결과를 저장할 폴더(`runs/<날짜-시각>` 대신 써요). 페이지마다 그 안에 폴더가 하나씩 생겨요.
- `--screens 8` — 내려가면서 확인하고 사진 찍을 화면 수 (기본 8)
- `--arms ABCD` — 비교 실험용 형식 세 가지(`grid-B.txt` · `grid-C.txt` · `grid-D.txt`)도 함께 적어요(명세 8절).

우리 시험 페이지(`cli/fixtures/`)도 읽을 수 있어요.

```bash
npx electron cli/grid.mjs read gridfix://fixture/shop.html
```

저장해 둔 원자료를 Electron 없이 다시 GRID/1 글로 찍을 수도 있어요(`npm run text -- <파일>`도 똑같아요).

```bash
node cli/text.mjs runs/<날짜-시각>/<페이지 이름>/capture.json
```

> 시험 프로그램은 사람이 직접 쓰는 도구라서, 아래 MCP 서버의 속도 제한을 거치지 않아요(주소 사이에 1.5초만 쉬어요). 여러 주소를 한꺼번에 읽을 때는 사이트에 부담이 가지 않게 조심해 주세요. 시험 프로그램의 Electron 자료는 `.userdata/cli`에 남고, `runs/`와 `.userdata/`는 git에 올라가지 않게 해 뒀어요.

### MCP 서버 띄우기

```bash
node src/hosts/mcp/server.mjs
```

- **MCP**(Model Context Protocol)는 AI 앱이 바깥 도구를 부르는 공통 규칙이에요.
- 이 서버는 **stdio**(표준 입출력 — 프로그램끼리 글을 주고받는 통로)로 말해요. 직접 띄우면 준비됐다는 한 줄이 stderr로 나오고 입력을 기다려요(끝낼 때는 Ctrl+C). 보통은 아래처럼 AI 앱에 등록해 두면 앱이 알아서 띄워요.
- 직접 띄워 볼 때는 `npm run mcp`도 똑같아요. 다만 AI 앱에는 `npm run mcp`가 아니라 `node …/server.mjs`를 등록해 주세요. npm이 stdout에 안내 줄을 먼저 찍어서, MCP 말이 아닌 글이 섞이거든요.
- 서버 본체는 Electron 실행 파일을 찾을 때 `electron` 꾸러미를 쓰는 것 말고는 Node 기본 기능만 써요. 페이지를 읽을 일이 생기면 그때 `npm install`이 받아 둔 Electron으로 읽기 프로세스를 띄워요.

## AI 앱에 붙이기 (MCP 등록)

아래의 `/path/to/ptw-grid`는 내 컴퓨터에서 저장소를 내려받은 폴더로 바꿔 주세요. 먼저 그 폴더에서 `npm install`을 해 둬야 해요.

### Claude Code

```bash
claude mcp add --transport stdio --scope user ptw-grid -- node /path/to/ptw-grid/src/hosts/mcp/server.mjs
```

- `--scope user`는 내 모든 프로젝트에서 쓸 수 있게 등록한다는 뜻이에요.
- 권하는 설정: `grid_read`는 **부를 때마다 물어보게** 두세요. 에이전트가 고른 주소로 바깥에 요청이 나가거든요. `grid_screen`은 이미 읽어 둔 것만 다시 보여 주니까 허락해 둬도 괜찮아요.
- `grid_read`는 읽기만 하는 도구로 표시돼 있어요. 이런 도구는 묻지 않고 바로 부르는 클라이언트도 있을 수 있으니, 쓰는 클라이언트의 도구 허락 설정을 확인해 주세요.
- 빼기: `claude mcp remove ptw-grid`

### Claude Desktop

설정 → 개발자 → 설정 편집(Edit Config)으로 `claude_desktop_config.json`을 열어요(macOS에서는 `~/Library/Application Support/Claude/claude_desktop_config.json`). 그리고 이렇게 넣어요.

```json
{
  "mcpServers": {
    "ptw-grid": {
      "command": "/path/to/ptw-grid/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
      "args": ["/path/to/ptw-grid/src/hosts/mcp/server.mjs"],
      "env": { "ELECTRON_RUN_AS_NODE": "1" }
    }
  }
}
```

- 데스크톱 앱은 터미널의 `node`를 못 찾을 때가 있어요. 그래서 `npm install`이 받아 둔 Electron을 Node처럼 돌려서 써요(`ELECTRON_RUN_AS_NODE=1`). 이때 서버는 내 컴퓨터의 Node.js가 아니라 Electron 안에 든 Node.js로 돌아요.
- 저장한 다음 Claude Desktop을 껐다 켜 주세요.

### Cursor

`.cursor/mcp.json`(이 프로젝트에서만) 또는 `~/.cursor/mcp.json`(모든 프로젝트에서):

```json
{
  "mcpServers": {
    "ptw-grid": {
      "command": "node",
      "args": ["/path/to/ptw-grid/src/hosts/mcp/server.mjs"]
    }
  }
}
```

### VS Code

`.vscode/mcp.json`:

```json
{
  "servers": {
    "ptw-grid": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/ptw-grid/src/hosts/mcp/server.mjs"]
    }
  }
}
```

`node`를 못 찾는다는 오류가 나면, `command`에 node의 전체 경로를 적어 주세요(터미널에서 `which node`로 볼 수 있어요). 아니면 Claude Desktop처럼 Electron을 써도 돼요.

## 도구

| 도구 | 하는 일 |
|---|---|
| `grid_read(url)` | 공개 http/https 페이지를 읽어서 GRID/1 글로 돌려줘요. **페이지 손잡이**(`p1a2b3c4d5e6f` 같은 이름)도 함께 줘요. 약 8천 토큰 안에 맞추고, 긴 페이지는 앞 화면을 온전히, 뒤 화면은 제목만 적어요. 같은 연결에서 2분 안에 같은 주소를 다시 부르면 방금 읽은 것을 다시 줘요. |
| `grid_screen(page, screen)` | 읽어 둔 페이지(`page` = 손잡이)의 화면 하나(`screen`, 1부터)를 온전히 돌려줘요(그 한 화면만으로 분량을 넘을 때만 잘라요). 새로 접속하지 않아요. |

- 한 화면은 20줄, 곧 1280×800 창 하나예요.
- 서버는 연결할 때 에이전트에게 읽는 법 한 문단을 건네고, `grid_read` 결과 맨 위에도 다시 붙여요. 맨 아래에는 손잡이와, 더 읽을 화면이 있으면 `grid_screen …`으로 이어 읽는 안내가 붙어요.
- PTW grid가 스스로 붙이는 줄은 `[grid …]`로 시작해요("grid"는 PTW grid의 짧은 이름이에요). 오류도 `[grid] …` 한 줄로 알려 줘요.
- 읽은 페이지는 연결마다 30분 동안, 8개까지 기억해요. 번호 `[n]`은 그 손잡이의 페이지 안에서만 뜻이 있어요.
- 처음 읽을 때는 숨은 브라우저를 띄우느라 조금 더 걸려요. 5분 동안 안 쓰거나 연결이 끝나면 알아서 꺼져요.
- MCP 규칙의 옛 판(2024-11-05 ~ 2025-11-25)과 새 판(2026-07-28)을 모두 알아들어요.

## 안전

### 숨은 브라우저 (읽기 방)

- **공개 http/https 페이지만** 열어요. `file:`이나 `chrome:` 같은 주소는 열지 않아요.
- **이 컴퓨터나 집 · 회사 안쪽 네트워크 주소는 막아요**(`localhost` · `.local`이나 `.localhost`로 끝나는 이름 · `127.0.0.1` · `192.168.x.x` · `10.x.x.x` 같은 것, 그리고 이런 주소의 여러 가지 IPv6 꼴).
- `localhost.`처럼 끝에 점을 붙여 적어도 똑같이 막아요. 안쪽 이름은 끝 점을 떼고 검사하거든요. `example.com.`처럼 공개된 이름에 점이 붙은 건 그대로 읽어요.
- 이름을 실제 주소로 풀어 봤을 때(DNS) 안쪽을 가리키거나, 아예 풀리지 않으면 막아요. 다만 이렇게 확인한 뒤 실제로 접속하기 전에 DNS 답이 바뀌는 경우(DNS 리바인딩)까지 완전히 막을 수는 없어요. 자세한 건 [SECURITY.md](SECURITY.md)에 있어요.
- 페이지가 다른 주소로 넘어갈 때와 페이지 안에서 나가는 모든 요청에도 같은 규칙을 써요.
- **아이디나 비밀번호가 든 주소**(`https://이름:비밀번호@…`)는 거절해요.
- 브라우저 세션은 PTW grid만 쓰고 **메모리에만** 있어서, 끄면 다 사라져요. MCP로 읽을 때는 **읽을 때마다 열린 연결을 끊고 쿠키 · 저장소 · 캐시 · HTTP 인증 기억을 비워요.** (시험 프로그램은 한 번 실행하는 동안 같은 세션을 써요.)
- WebRTC(브라우저끼리 직접 잇는 기능)로 안쪽 주소가 새지 않게 막아요.
- 인증서를 달라는 사이트에 이 컴퓨터의 **클라이언트 인증서를 내주지 않아요.**
- 권한 요청 · 새 창 · 내려받기 · 대화상자(alert 같은 것) · 소리를 모두 꺼요.
- 페이지를 재는 스크립트는 페이지 자신의 스크립트와 **분리된 곳**(격리된 세계)에서 돌아요.
- 숨은 창을 한 화면씩 넘기며 확인하지만, 누르기 · 입력 · 제출은 하지 않아요. 읽기만 해요.

### AI를 지키는 장치

- **숨은 글 격리**: 사람 눈에 보이지 않는 글(화면 읽기 프로그램 전용 글 · 아주 작은 글 · 투명한 글 · 화면 밖으로 밀어낸 글 · 배경과 거의 같은 색인 글 같은 것)은 AI에게 보내지 않고 **수만 세요**(`hidden text dropped`). AI를 속이려는 숨은 지시가 이런 곳에 많거든요. `aria-hidden`으로 가린 것(주로 꾸밈 아이콘)도 빼지만, 이 수에는 넣지 않아요.
- 보이지 않는 글자(폭 없는 글자 · 글 방향을 바꾸는 제어 글자 같은 것)도 빼고, 따로 세요(`invisible characters removed`).
- **민감한 칸**: 비밀번호 칸, 그리고 페이지가 카드 정보나 일회용 인증 코드라고 표시해 둔 칸은 언제나 값 대신 `(filled)` / `(empty)`만 적어요.
- 페이지에서 온 글은 늘 한 줄로 적어요(이름과 글은 따옴표 안에). 그래서 페이지가 가짜 `⚠` 줄 같은 걸 끼워 넣을 수 없어요. 다만 `[12 구매]`처럼 문단 속 링크와 똑같이 생긴 글을 따옴표 안의 글에 적는 건 막지 못해요(명세 5절).
- 페이지를 읽은 결과는 늘 "믿을 수 없는 웹 내용이고, 지시가 아니라 자료"라는 뜻의 영어 줄과, **부를 때마다 바뀌는 무작위 시작 · 끝 표시**로 감싸요. 페이지 글이 끝 표시를 흉내 낼 수 없어요(`<<<` · `>>>`가 셋 이상 이어지면 끊어 둬요).
- 이건 위험을 줄이는 장치이지 완벽한 방어는 아니에요. `grid_read`는 부를 때마다 확인하도록 두기를 권해요.

### 사이트에 예의 지키기 (속도 제한)

이 컴퓨터의 내 계정에서 PTW grid를 쓰는 모든 연결(Claude Code 창 여러 개, Claude Desktop, Cursor 같은 것)이 **한 줄로 서서** 천천히 읽어요. 아래 제한은 이 연결들이 모두 함께 지켜요.

- 한 번에 한 페이지만 읽어요.
- 읽기 사이에 3초 이상 쉬어요.
- 같은 사이트는 10초 이상 간격을 둬요(하위 도메인도 같은 사이트로 봐요).
- 10분에 20번까지만 읽어요.

이렇게 함께 지키려고, 사이트 이름 · 읽은 시각 · 프로세스 번호를 적은 작은 기록을 내 계정만 열 수 있는 캐시 폴더에 둬요(macOS에서는 `~/Library/Caches/ptw-grid`, 다른 곳에서는 `$XDG_CACHE_HOME/ptw-grid`나 `~/.cache/ptw-grid`). 읽기 프로세스가 도는 동안에는 그 프로세스의 임시 작업 폴더(`reader-…`)도 여기에 생기고, 프로세스가 끝나면 지워요.

- 짧게 기다리면 되는 건 서버가 알아서 기다리고, 오래 기다려야 하면 몇 초 뒤에 다시 하라고 알려 줘요.
- 같은 연결에서 2분 안에 같은 주소를 다시 부르면, 새로 읽지 않고 방금 읽은 것을 다시 줘요. 이건 연결마다 따로예요.
- 한 페이지를 읽는 데 1분이 넘으면 멈춰요.

사이트에는 브라우저 이름(user-agent) 끝에 `ptw-grid/<판 번호>`를 붙여서 PTW grid라고 밝혀요.

**robots.txt는 확인하지 않아요.** (robots.txt는 사이트가 자동 프로그램에게 남기는 안내 파일이에요.) 사이트의 이용 약관과 규칙을 지키는 건 쓰는 분의 몫이에요.

### 보이는 창을 읽을 때 (개발자용)

직접 만든 Electron 앱에서 사람이 보고 있는 창을 읽을 때는 `src/hosts/electron/reader.mjs`의 `captureFrom(webContents, { scroll: false, maskValues: true, dropQuery: true })`를 쓸 수 있어요.

- `scroll: false` — 사람이 보던 화면을 넘기지 않아요.
- `maskValues` — 사람이 입력 칸에 적은 값을 `(filled)` / `(empty)`로만 보여 줘요.
- `dropQuery` — 주소의 `?` 뒤(검색어 같은 것)와 `#` 뒤를 빼요.

두 가리기는 페이지 안에서 이뤄져서 값이 밖으로 나오지 않아요. 다만 페이지가 적은 글을 다른 곳에 다시 그린 것(미리보기 · 편집기가 따로 그리는 줄 · 검색 결과 제목 · 문서 제목 같은 것)은 페이지의 글이라서 가리지 못해요(명세 5절).

## 한계

- 같은 출처의 iframe(페이지 안에 들어간 다른 페이지)과 shadow DOM(부품 안에 감춰진 구조)은 읽지만, **다른 출처의 iframe은 읽지 않아요.**
- 그림 · 캔버스 · 영상 **안의 글자는 읽지 않아요.** 설명 글이 없는 큰 그림에는 `⚠ no text — info may be only in the image` 경고가 붙어요.
- 창 크기는 **1280×800으로 고정**이에요.
- 무엇이 무엇을 덮고 있는지는 앞 8화면까지만 확인해요.
- MCP 결과는 한 번에 약 8천 토큰까지라서, 아주 긴 페이지는 뒤쪽이 제목만 나와요. `grid_screen`으로 더 읽어 주세요. (시험 프로그램이 만드는 `grid-A.txt`에는 토큰 한도가 없어요.)
- MCP로 읽을 때는 로그인하지 않고 쿠키도 매번 비우니까, 로그인해야 보이는 페이지는 읽을 수 없어요.
- 페이지는 이 컴퓨터의 언어로 먼저, 그다음 영어로 달라고 해요.
- macOS에서만 시험했어요. 다른 운영체제는 시험하지 않았어요.
- 누르기와 입력은 아직 없어요.

## 문법 명세 — GRID/1

- 명세: [spec/GRID-1.md](spec/GRID-1.md) (한국어: [spec/GRID-1.ko.md](spec/GRID-1.ko.md)). 두 판이 다르면 영어판(호환 조건 포함)을 따라요.
- 모든 결과는 `GRID/1 · <주소> · "<제목>"` 줄로 시작해요.
- 다른 프로그램도 이 문법을 만들거나 읽을 수 있게 명세를 열어 뒀어요. `test/captures/`의 원자료(모양은 `src/core/capture.d.ts`)로 `test/snapshots/`의 정답 글과 똑같은 글이 나오는지 비교하면 맞게 만들었는지 확인할 수 있어요. 이 자료는 모두 CC0-1.0이에요.

에이전트에게 건네는 읽는 법이에요. MCP 서버는 연결할 때 한 번, 그리고 `grid_read` 결과마다 이걸 알아서 붙여요. 이 문단도 CC0-1.0이라서 내 프롬프트나 다른 구현에 그대로 붙여 써도 돼요.

```
The page is one tall sheet. Columns A–L split the window width into 12 equal parts. Rows are 40-px bands counted from the top of the page and keep counting down; one screen is 20 rows (screen 2 = rows 21–40). "@E6-F7" is the box an item covers (top-left cell to bottom-right cell). Items under "pinned" stay in the window while scrolling; their @v cells count rows from the window top. [n] is an element you can act on; the number never changes while the page is open. Act by number; never compute positions. "covered by O1" means another layer sits on top of it; the ⚠ line for O1 says what it is and how to get past it.
```

창 높이가 800px이 아니면 "one screen is N rows"가 그 창에 맞게 바뀌어요.

## 폴더 짜임

| 자리 | 하는 일 |
|---|---|
| `src/page/walker.js` | 페이지 안에서 돌면서 요소 · 자리 · 가려짐을 재는 스크립트 |
| `src/core/` | 순수 계산 — 원자료를 GRID/1 글로(`toText`) · 읽는 법 · 분량 맞추기 · 주소 규칙 · 원자료 모양(`capture.d.ts`) |
| `src/hosts/electron/reader.mjs` | 숨은 창으로 읽는 모듈(`createReader().read(url)`) · 이미 열린 창 읽기(`captureFrom`) |
| `src/hosts/mcp/` | MCP 서버 — 본체 · 말 규칙 · 속도 제한 · 읽기 프로세스 |
| `cli/` | 시험 프로그램 · 시험 페이지(`cli/fixtures/`) |
| `spec/` | GRID/1 명세 |
| `test/` | 시험 · 저장해 둔 원자료 · 정답 글 |

## 라이선스

한 저장소 안에서도 부분마다 라이선스가 달라요. 코드 파일 맨 위의 **SPDX 줄**(그 파일의 라이선스를 기계가 읽을 수 있게 적은 한 줄)과 [`REUSE.toml`](REUSE.toml)에 어느 파일이 어떤 라이선스인지 적혀 있어요. 라이선스 전문은 [`LICENSES/`](LICENSES/) 폴더에 있고, 맨 위의 [`LICENSE`](LICENSE) 파일은 AGPL-3.0-only 전문을 그대로 옮긴 거예요. 한눈에 보는 요약과 다른 소프트웨어에 대한 안내는 [`NOTICE`](NOTICE)에 있어요.

| 무엇 | 라이선스 | 쉽게 말하면 |
|---|---|---|
| 엔진(프로그램 코드) | AGPL-3.0-only | 자유롭게 쓰고 고칠 수 있어요. 다만 남에게 나눠 줄 때(고치지 않았어도)는 받는 사람에게, 고친 것을 네트워크 서비스로 내놓을 때는 그 이용자에게 소스 코드를 같은 AGPL로 제공해야 해요. |
| 문법 명세 글 ([spec/GRID-1.md](spec/GRID-1.md) · [spec/GRID-1.ko.md](spec/GRID-1.ko.md)) | CC-BY-4.0 | 출처와 라이선스를 밝히고, 고쳤다면 고쳤다고 적으면 자유롭게 쓰고, 고치고, 나눌 수 있어요. 글 속의 예시 출력(3–7절의 코드 블록과 인용한 출력 줄)과 1절의 읽는 법 문단은 CC0-1.0이에요. 명세 맨 위의 라이선스 줄에 그렇게 적어 뒀어요. |
| 설명 문서(README.md · README.ko.md · CHANGELOG.md · CONTRIBUTING.md · SECURITY.md · COMMERCIAL.md · TRADEMARKS.md · NOTICE) | CC-BY-4.0 | 명세 글과 같은 조건이에요. |
| 명세 속 예시 출력 · 읽는 법 문단 · 시험 자료(시험 페이지 `cli/fixtures` · 원자료 `test/captures` · 정답 글 `test/snapshots` · 원자료 모양 `src/core/capture.d.ts`) | CC0-1.0 | 아무 조건 없이 써도 돼요. 다른 구현이 GRID/1에 맞는지 확인하는 자료예요. 읽는 법 문단은 `src/core/format.js` 안에도 `LEGEND.A`로 들어 있고, 그 부분만 CC0-1.0이라고 표시해 뒀어요. |
| 작은 프로젝트 파일(`.gitignore` · `package-lock.json` · `REUSE.toml`) | CC0-1.0 | 아무 조건 없이 써도 돼요. |
| 프로그램이 만든 출력(GRID/1 글) | — | 자유롭게 써도 돼요. 우리는 이 글에 권리를 주장하지 않고, 그 안에서 PTW grid가 늘 똑같이 붙이는 말은 CC0-1.0이에요. (그 안에 담긴 웹 페이지 내용의 권리는 원래 주인에게 있어요.) |

위 설명은 쉽게 풀어 쓴 것이라 법률 조언은 아니에요. 정확한 조건은 라이선스 전문을 따라요.

**상업 라이선스**: AGPL 조건이 맞지 않는 곳(예를 들어 소스를 공개하지 않는 제품에 넣고 싶을 때)이라면, 저작권자에게서 따로 상업 라이선스를 받을 수 있어요(이중 라이선스). 자세한 건 [COMMERCIAL.md](COMMERCIAL.md)를 봐 주시고, [philosophythatworks.com](https://philosophythatworks.com/)을 통해 연락해 주세요.

**이름**: 위 라이선스는 코드와 글에 대한 것이고, "PTW grid" · "Philosophy That Works"(줄여서 "PTW")라는 이름은 들어 있지 않아요. [TRADEMARKS.md](TRADEMARKS.md)를 봐 주세요.

`npm install`이 받아 오는 Electron은 MIT 라이선스로 나오는 다른 프로젝트이고, 이 저장소에는 들어 있지 않아요([NOTICE](NOTICE) 참고).

## 참여하기

- **이슈와 아이디어는 언제든 반가워요.** 잘 안 읽히는 페이지, 헷갈리는 문법, 바라는 기능을 [이슈](https://github.com/philosophythatworks/ptw-grid/issues)로 알려 주세요. 한국어나 영어로 적어 주시면 돼요. 잘 안 읽히는 페이지라면 주소와 함께 무엇을 기대했는지 적어 주시면 큰 도움이 돼요.
- **코드 풀 리퀘스트는 아직 받지 않아요.** 지금까지의 코드는 모두 저작권자가 AI 코딩 도우미와 함께 만들었고(많은 부분은 도우미가 초안을 썼어요), 다른 분이 보탠 코드는 없어요. 코드의 출처가 한 사람뿐이어야 이중 라이선스를 단순하게 지킬 수 있어서예요. 나중에 기여자 라이선스 동의(CLA — 기여한 코드를 어떤 조건으로 쓸지 미리 정해 두는 약속)를 두게 될 수도 있어요. 그때까지는 바꾸고 싶은 점을 이슈에 말로 적어 주세요.
- 자세한 건 [CONTRIBUTING.md](CONTRIBUTING.md)를 봐 주세요.

## 보안 문제 알리기

보안 문제(예를 들어 안쪽 주소 막기를 빠져나가는 방법이나, 숨긴 글이 AI에게 새는 경우)를 찾으셨다면, 공개 이슈에 적지 말고 비공개로 알려 주세요.

- 가장 좋은 방법은 GitHub 비공개 취약점 신고예요. 이 저장소의 **Security** 탭에서 **Report a vulnerability**를 눌러 주세요.
- GitHub을 쓸 수 없다면 [philosophythatworks.com](https://philosophythatworks.com/)을 통해 연락해서, 자세한 내용을 비공개로 보낼 방법을 물어봐 주세요. 첫 연락에는 자세한 내용을 적지 말아 주세요.

무엇을 적으면 좋은지, 어디까지가 보안 문제인지는 [SECURITY.md](SECURITY.md)에 있어요.

## AI와 함께 만들었어요

PTW grid는 한 사람(저작권자)이 방향을 정하고, 판단하고, 결과를 확인하면서 AI 코딩 도우미(Anthropic의 Claude)와 함께 만들었어요. 코드 · 시험 · 문서의 많은 부분은 도우미가 초안을 썼어요. 다른 사람이 보탠 코드는 없어요. 시험을 꼼꼼히 두었지만 빈틈이 있을 수 있어요. 찾으시면 알려 주세요.

## 저작권

© 2026 Hwang Dae Jin (Philosophy That Works)

Philosophy That Works는 아직 법인이 아니어서, 저작권은 Hwang Dae Jin 개인이 가지고 있어요.
