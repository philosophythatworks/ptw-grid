[한국어](README.ko.md)

# PTW grid — AI eyes for web reading

**PTW grid** — *AI eyes for web reading*, by [Philosophy That Works](https://philosophythatworks.com/) (PTW).

PTW grid opens a public web page in a hidden browser and writes it out as **GRID/1** text, a compact plain-text description that any AI agent can read in the same way. Every element you could act on gets a number `[n]` with its role, name and state. Every item gets a position on a 12-column sheet: columns A–L across the window, rows 40 px tall, and 20 rows make one 1280×800 screen. The text also shows the page's regions, where each screen begins, overlays that cover things (`O1`, …) and how to close them, and how much hidden text was taken out. MCP results stay within about 8,000 tokens. On long pages the first screens are listed in full and later screens only as headings, and the agent can ask for those one at a time. PTW grid runs on your own computer as an MCP server (for Claude Code, Claude Desktop, Cursor, VS Code and other MCP clients) or as a small test program.

## Example

This is an excerpt of the expected output for the built-in test shop page (`cli/fixtures/shop.html`, saved in `test/snapshots/shop.A.txt`). `…` marks lines left out. The test page is in Korean: 장바구니 = cart, 구매하기 / 바로 구매 = buy (now), 앱 광고 = app ad, 닫기 = close, 쿠폰 받기 = get coupon, 색상 = colour, 수량 = quantity.

```
GRID/1 · gridfix://fixture/shop.html · "무선 이어폰 X2 | 예시마켓"
sheet A–L × 40px rows from page top · screen = 20 rows · page ≈ 4.4 screens (rows 1–89)
view rows 1–20 (screen 1/5)
facts (page metadata): product "무선 이어폰 X2 노이즈캔슬링" · 59000 KRW · InStock · og:type product
checks: covered 8/61 tested · hidden text dropped 5
⚠ O1 = popup aside "앱 광고" — covers 7 items (5 in view); close it with [67] first
▸ pinned (stays on screen while scrolling)
  [63] button "장바구니" @vA19-vF20
  [64] button "구매하기" @vF19-vL20
▸ pinned (stays on screen while scrolling) · aside "앱 광고"
  …
  [67] button "닫기" @vK12
…
▸ main @A3-L84
  img t1 "(no alt)" ⚠ no text — info may be only in the image @A4-F16
  t2 "디지털 › 음향기기 › 이어폰" @F4-G4
  # t3 "무선 이어폰 X2 노이즈캔슬링" @F4-I5
  [21] link "★4.6 리뷰 2,318" @F5-G6
  t5 "~~89,000원~~ 59,000원 34%" @F6-H7
  t6 "쿠폰 적용 시 53,100원" @F8-G9
  [22] button "쿠폰 받기" (covered by an invisible link to ads.example.com ⚠) @H8-H9
  t7 "무료배송 · 10/2(목) 도착 예정" @F9-H9
  [23] select "색상" (required) =선택하세요 · 선택하세요/블랙/화이트/네이비 @F11-L11
  [24] button "수량 빼기" (disabled, covered by O1) @F12-F13
  [25] spinbutton "수량" (covered by O1) =1 @G12-G13
  [26] button "수량 더하기" (covered by O1) @G12-H13
  [27] button "장바구니 담기" (covered by O1) @F13-I14
  [28] button "바로 구매" (covered by O1) @I13-L14
  …
```

What to notice:

- `[27] button "장바구니 담기" (covered by O1) @F13-I14`: the "add to cart" button covers columns F–I, rows 13–14, but an app-ad pop-up (`O1`) sits on top of it. The `⚠ O1` line at the top says what the pop-up is and that `[67]` closes it.
- `[22] … (covered by an invisible link to ads.example.com ⚠)`: something invisible sits on top of the coupon button, so a click there would land on an ad link.
- `@vA19-vF20`: pinned items stay in the window while you scroll. Their `v` rows are counted from the top of the window.
- `checks: covered 8/61 tested`: 61 elements were checked for something lying on top of them, and 8 of them are covered.
- `hidden text dropped 5`: five pieces of text that a person cannot see were taken out before the model sees the page.
- `img … ⚠ no text`: a large image with no text alternative, so some information may be only in the picture.
- Further down, lines like `── screen 2 · rows 21–40 ──` mark where each screen begins.

## Why positions

A plain list of page elements loses the layout: what is next to what, what sits on top of what, and what is on the first screen. On many pages the order in the code is not the order you see on screen. We checked how much this matters in our own experiments:

- Four Claude models (Haiku, Sonnet, Opus and Fable) answered 35 "layout trap" questions about pages whose code order does not match their visual layout. With the 12-column positions they got **100%** right. With the same text and the positions removed they got **60.7%**.
- On 12 mixed pages (real sites and test pages), GRID/1 scored **99.5%**, against **87.2%** for a plain element list. There, most of the gain came from regions, screen marks, pinned items and cover marks rather than from the positions themselves.

These are small in-house experiments, not an independent benchmark, and their materials are not part of this repository. The first experiment is the reason GRID/1 keeps positions.

## Status

- **v0.1.4**, an early version. Changes are listed in [CHANGELOG.md](CHANGELOG.md).
- **Read-only.** PTW grid reads pages. It cannot click, type or submit anything, and this release has no tools for that.
- Tested only on **macOS**, with Node.js 26.x and Electron 44.x. Other operating systems and other versions have not been tested.
- Not published on npm yet, so install from source.
- Code comments are in Korean. Messages and tool descriptions are in English, with three exceptions: when an icon button has no name, PTW grid guesses one from its class or id and marks it with `~`, and these guessed names are currently Korean (for example `"~메뉴"`, "menu"); the labels in the test program's `view.html` (title, colour key) are currently Korean; and the test suites' test names and check output are in Korean.

## Install

You need macOS, git and Node.js (tested with 26.x; other versions are untested).

```bash
git clone https://github.com/philosophythatworks/ptw-grid.git
cd ptw-grid
npm install    # also downloads Electron (tested with 44.x), which is a large download
npm test       # core and MCP unit tests: Node only, no browser, no network
```

There are two more test suites. Both open Electron but read only the built-in test pages, so they need no internet:

```bash
npm run test:electron   # the hidden-window reader
npm run test:mcp        # starts the MCP server for real and reads test pages (takes about a minute)
```

`npm test` ends with `fail 0` when everything passed. `test:electron` and `test:mcp` print one line per check, marked ✔ (passed) or ✘ (failed), and exit with code 0 when nothing failed. `test:electron` marks one check with – (skipped) if it cannot look up a test host name, for example without internet. The check names and summary lines are in Korean (see Status).

Before `npm run test:mcp`, close other apps that use PTW grid (for example Claude Desktop, or a Claude Code session where it is registered). The test's last check fails if another PTW grid reader is running at the same time.

## Quick start

### Test program

```bash
# a built-in test page (no network)
npx electron cli/grid.mjs read gridfix://fixture/shop.html --out runs/shop

# a public page
npx electron cli/grid.mjs read https://example.com --out runs/example
```

For each page, the test program prints a one-line JSON summary and writes one sub-folder inside the run folder, named from the page's host and path (for example `runs/shop/fixture-shop-html/` and `runs/example/example-com/`):

| file | what it is |
|---|---|
| `grid-A.txt` | the GRID/1 text |
| `capture.json` | the raw capture the text is made from |
| `shot-1.jpg`, `shot-2.jpg`, … | a screenshot of each screen |
| `view.html` | the screenshots with the 12-column grid and the numbers drawn on top |

It also writes a `summary.json` for the whole run into the run folder. `--out` sets the run folder, relative to the repository (by default `runs/<UTC date-time>`), and `--screens N` sets how many screens it scrolls through and checks (default 8). `--arms ABCD` also writes three experimental comparison formats (`grid-B.txt`, `grid-C.txt`, `grid-D.txt`; see section 8 of the specification). If you give several URLs in one command, they are read one after another. `npm run read -- <url>` does the same thing as `npx electron cli/grid.mjs read <url>`.

To print a saved capture again without Electron (`npm run text -- <file>` does the same):

```bash
node cli/text.mjs runs/example/example-com/capture.json
```

The test program is for trying a few pages by hand. It waits 1.5 seconds between pages, but it does **not** use the MCP server's shared rate limits (see below), so please keep your use light. It keeps its Electron profile in `.userdata/cli`. Both `runs/` and `.userdata/` are ignored by git.

### MCP server

```bash
node src/hosts/mcp/server.mjs
```

The server speaks MCP over stdio, so your MCP client normally starts it for you (see the next section). Started by hand, it prints a ready line on stderr and then waits for input (Ctrl+C to stop). `npm run mcp` does the same when you try it by hand, but register `node …/server.mjs` with your client, not `npm run mcp`, because npm prints a banner line on stdout. Apart from finding the Electron binary through the `electron` package, the server itself uses only Node.js built-in modules. On the first read it starts a hidden Electron reader process, using the Electron that `npm install` downloaded. That process stops after 5 minutes without use, or when the client disconnects. Log messages go to stderr, and stdout carries only MCP messages. The server supports MCP protocol versions 2024-11-05 through 2025-11-25, and 2026-07-28.

## Register with your MCP client

In the examples below, replace `/path/to/ptw-grid` with the folder where you cloned the repository. Run `npm install` in that folder first.

**Claude Code**

```bash
claude mcp add --transport stdio --scope user ptw-grid -- node /path/to/ptw-grid/src/hosts/mcp/server.mjs
```

To remove it: `claude mcp remove ptw-grid`.

**Claude Desktop**

Open Settings → Developer → Edit Config. On macOS the file is `~/Library/Application Support/Claude/claude_desktop_config.json`. Add the server, then restart Claude Desktop:

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

This setup runs the server with Electron's own binary in Node mode (`ELECTRON_RUN_AS_NODE=1`), so Claude Desktop does not need to find `node` on its PATH. The server then runs on the Node.js version built into Electron, not on your own Node.js.

**Cursor**

Add this to `.cursor/mcp.json` in a project, or to `~/.cursor/mcp.json` to use it in every project:

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

**VS Code**

Add this to `.vscode/mcp.json`:

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

If a desktop app cannot find `node`, put the full path to `node` in `"command"` (run `which node` to find it), or use the Electron setup shown for Claude Desktop.

We suggest setting your client to ask before each `grid_read` call, because that call sends a request to an address the agent chose. `grid_screen` makes no network request, so it is safe to allow without asking. `grid_read` is marked as a read-only tool, and some clients may run read-only tools without asking by default, so check your client's tool-approval setting for `grid_read`.

## The two tools

| tool | what it does |
|---|---|
| `grid_read(url)` | Reads a public http/https page and returns GRID/1 text plus a page handle (like `p1a2b3c4d5e6f`). Long pages list the first screens in full and later screens only as headings, up to about 8,000 tokens. If the same URL was read over the same connection in the last 2 minutes, that read is reused. |
| `grid_screen(page, screen)` | Returns one screen of a page read earlier, in full (20 rows, one 1280×800 window; cut only if that one screen alone is over the budget). It uses the kept copy and makes no new network request. Each connection keeps its pages for 30 minutes, up to 8 at a time. |

Every page result comes inside an untrusted-content frame. The first line tells the agent that what follows is data from a web page and never instructions. The page text sits between begin and end markers that carry a random tag, new on every call, so text on the page cannot fake the end of the frame. The server gives the agent the GRID/1 legend (below) when it connects, and again at the top of every `grid_read` result. The frame's own lines are the `[grid …]` first line, a `How to read it:` line (`grid_read` only), the `<<<grid-page … begin>>>` and `end>>>` markers, and the `[grid] …` footer lines ("grid" is the short name of PTW grid). Errors come back as a short `[grid] …` text.

## Safety and politeness

**What it will read**

- Only public `http` and `https` pages. It refuses local and private addresses:
  - `localhost`, and names ending in `.localhost` or `.local`
  - loopback, private, link-local and shared (CGNAT) IPv4 ranges, and `0.0.0.0/8`
  - the IPv6 forms of all of these (IPv4-mapped, NAT64, 6to4, unique-local, link-local and others), and IPv6 multicast
- A trailing dot does not get around this. Local names are checked with trailing dots removed, so `localhost.` is refused too. Public names written with a trailing dot (like `example.com.`) are read normally.
- Host names are looked up first, and refused if they resolve to a local or private address, or cannot be resolved. (A DNS answer that changes between this check and the connection, known as DNS rebinding, cannot be ruled out completely; see [SECURITY.md](SECURITY.md).)
- The same rules apply to redirects, to navigation inside the page, and to every request the page makes, WebSockets included.
- It refuses URLs that contain a username or password, and schemes such as `file:` and `chrome:`.

**How it reads**

- Pages open in a hidden 1280×800 browser window with a memory-only session that only PTW grid uses. Before every read, the MCP server closes open connections and clears cookies, storage, the cache and the HTTP authentication cache.
- Permission requests, pop-up windows, downloads and dialogs are refused, and sound is muted. WebRTC is set so it cannot leak local network addresses. Client certificates are never sent.
- The script that reads the page runs in an isolated world, apart from the page's own scripts. It scrolls the hidden window to check each screen, but it never clicks, types or submits.

**What the agent gets**

- **Hidden-text quarantine.** Text a person cannot see is taken out and only counted (`hidden text dropped N`): visually hidden (screen-reader-only) text, tiny or transparent text, off-screen text, and text almost the same colour as its background. aria-hidden content (mostly decorative icons) is left out too, but not counted. Invisible characters, such as zero-width and text-direction characters, are removed and counted separately (`invisible characters removed N`).
- **Sensitive fields.** Password fields, and fields that the page marks as card details or one-time codes, always show only `(filled)` or `(empty)`, never their value.
- Text from the page is always put on a single line, with names and texts inside double quotes, so it cannot fake new GRID/1 lines. Runs of `<<<` or `>>>` are broken up. A page can still write text that looks like an inline link, such as `[12 Buy]`, inside a quoted text (see section 5 of the specification).
- Every page result comes inside the untrusted-content frame with random markers described above.

These measures reduce the risk of prompt injection. They are not a complete defence, so we suggest keeping `grid_read` on ask-every-time.

**Politeness (MCP server)**

Every PTW grid MCP server running under your user account on the same computer shares these limits. Several Claude Code windows, Claude Desktop and Cursor all wait in the same queue.

- One read at a time.
- At least 3 seconds between reads.
- At least 10 seconds between reads of the same site. Subdomains count as the same site.
- At most 20 reads in 10 minutes.

To share these limits, the servers keep a small log of site names, read times and process IDs in a cache folder that only your account can open (`~/Library/Caches/ptw-grid` on macOS, and `$XDG_CACHE_HOME/ptw-grid` or `~/.cache/ptw-grid` elsewhere). While a reader is running, its temporary working folder (`reader-…`) is kept there too; it is removed when the reader stops.

Within one MCP connection, asking for the same URL again within 2 minutes reuses the last read instead of loading the page again. Each page gets at most 1 minute to load and be read. Short waits happen automatically. For longer waits, the tool says when to try again.

- PTW grid identifies itself: the user-agent is a normal Chromium one with `ptw-grid/<version>` added.
- It does **not** check `robots.txt`. You are responsible for following the terms of the sites you read.

**Apps that read a window a person can see**

The reader library (`src/hosts/electron/reader.mjs`) can also read a window that a person is looking at: `captureFrom(webContents, { scroll: false, maskValues: true, dropQuery: true })`. It reads without scrolling the person's view. `maskValues` shows typed values only as `(filled)` or `(empty)`, and `dropQuery` drops the `?query` and `#part` of the address. Both happen inside the page, so the values never leave it. Text that the page itself draws again somewhere else from what was typed (a live preview, lines an editor draws separately, search-result titles, the document title) is ordinary page text and is not masked; see section 5 of the specification.

## Limits

- Same-origin iframes and open shadow DOM are read. The inside of a cross-origin iframe is not.
- Text inside images, canvas and video is not read. A large image with no text alternative gets a warning (`⚠ no text — info may be only in the image`).
- The window is fixed at 1280×800, so pages look the way a desktop browser shows them.
- The reader scrolls through at most 8 screens to check what is covered. Items further down are listed but not checked.
- Every MCP read starts with no cookies, so pages behind a login show only what a logged-out visitor sees. (The test program keeps one session for all the URLs in a single run.)
- Pages are requested in your computer's language first, then English.
- Over MCP, results for very long pages are cut down to about 8,000 tokens. Use `grid_screen` to read the rest. (The test program's `grid-A.txt` has no token budget.)

## How GRID/1 is specified

The grammar is described in one document, [spec/GRID-1.md](spec/GRID-1.md), with a Korean version in [spec/GRID-1.ko.md](spec/GRID-1.ko.md). The English version is authoritative: if the two differ, the English version prevails. Every output starts with `GRID/1 · <url> · "<title>"`.

The formatter (`src/core/format.js`) is plain JavaScript with no dependencies. The repository also contains conformance material that another implementation can check itself against:

- `test/captures`: saved raw captures of the test pages in `cli/fixtures`
- `test/snapshots`: the exact GRID/1 text expected from those captures
- `src/core/capture.d.ts`: the shape of a raw capture

All of this material is CC0-1.0 (see [Licensing](#licensing)).

This is the legend the server gives the agent. It is CC0-1.0 too, so you may paste it into your own prompts or tools:

```
The page is one tall sheet. Columns A–L split the window width into 12 equal parts. Rows are 40-px bands counted from the top of the page and keep counting down; one screen is 20 rows (screen 2 = rows 21–40). "@E6-F7" is the box an item covers (top-left cell to bottom-right cell). Items under "pinned" stay in the window while scrolling; their @v cells count rows from the window top. [n] is an element you can act on; the number never changes while the page is open. Act by number; never compute positions. "covered by O1" means another layer sits on top of it; the ⚠ line for O1 says what it is and how to get past it.
```

If the window is not 800 px tall, "one screen is N rows" changes to match it.

## How it works

1. `src/hosts/electron/reader.mjs` opens the page in a hidden 1280×800 Electron window with a memory-only session.
2. `src/page/walker.js` runs inside the page, in an isolated world. It records each element's role, name, state and box.
3. The reader scrolls one screen at a time. At a few points inside each element, it checks whether something else is on top.
4. `src/core/` turns this raw capture into GRID/1 text that fits the token budget. It is plain JavaScript and runs anywhere.
5. `src/hosts/mcp/` is the MCP server. `cli/` holds the test program and the test pages.

## Licensing

PTW grid is dual-licensed. Every JavaScript and TypeScript source file carries an SPDX header, and [REUSE.toml](REUSE.toml) gives the copyright and licence of every file in the repository. The full licence texts are in [LICENSES/](LICENSES/). The root [LICENSE](LICENSE) file is the same AGPL-3.0-only text. [NOTICE](NOTICE) sums all of this up, together with the third-party notices.

- **Engine (the program's code): [AGPL-3.0-only](LICENSES/AGPL-3.0-only.txt).** You may use, study, change and share it. If you give copies to others, changed or not, you must also give them the source code under the same licence. If you change it and let others use your changed version over a network, you must offer those users its source code. This is a plain-language summary, not legal advice. The licence text is what counts.
- **Commercial licence.** If the AGPL does not fit your use, for example inside a closed-source product or service, a commercial licence is available from the copyright holder. See [COMMERCIAL.md](COMMERCIAL.md), or contact us through [philosophythatworks.com](https://philosophythatworks.com/).
- **The GRID/1 specification** ([spec/GRID-1.md](spec/GRID-1.md) and [spec/GRID-1.ko.md](spec/GRID-1.ko.md)): [CC-BY-4.0](LICENSES/CC-BY-4.0.txt). The example outputs in it (the code blocks and quoted output lines in sections 3–7) and the legend paragraph in section 1 are CC0-1.0, as the Licence line at the top of the specification says.
- **Documentation and policy files** (README.md, README.ko.md, CHANGELOG.md, CONTRIBUTING.md, SECURITY.md, COMMERCIAL.md, TRADEMARKS.md and NOTICE): [CC-BY-4.0](LICENSES/CC-BY-4.0.txt).
- **Conformance material: [CC0-1.0](LICENSES/CC0-1.0.txt).** This covers the example outputs in the specification and the legend paragraph (the legend is also in `src/core/format.js` as `LEGEND.A`, marked with SPDX snippet tags), the test pages (`cli/fixtures`), the saved captures (`test/captures`), the expected-output snapshots (`test/snapshots`) and the capture type definitions (`src/core/capture.d.ts`). Anyone may use it to build a compatible reader or writer under any licence.
- **Small project files** (`.gitignore`, `package-lock.json`, `REUSE.toml`): [CC0-1.0](LICENSES/CC0-1.0.txt).
- **Output.** The GRID/1 text the program produces may be used freely: we claim no rights in it, and PTW grid's own fixed wording in it is CC0-1.0. The page content inside it still belongs to its owners.
- **Names.** The licences above cover code and text, not the names "PTW grid" and "Philosophy That Works" (or "PTW", short for Philosophy That Works). See [TRADEMARKS.md](TRADEMARKS.md).

Electron, which `npm install` downloads, is a separate project under the MIT licence. It is not part of this repository (see [NOTICE](NOTICE)).

## Contributing

Issues, bug reports and ideas are welcome on [GitHub](https://github.com/philosophythatworks/ptw-grid/issues), in English or Korean. For a bug, please include the page URL (if it is public), your OS, your Node.js and Electron versions, and the GRID/1 output.

Code pull requests are **not accepted yet**. So far all of the code has been made by the copyright holder working with an AI coding assistant, which drafted much of it, and no one else has contributed code. Keeping the code from a single source keeps the dual licence simple. A contributor licence agreement may come later. Until then, please describe your change in an issue instead. Details are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Please do not report security problems in public issues. The preferred way is GitHub private vulnerability reporting: open the **Security** tab of this repository and choose **Report a vulnerability**. If you cannot use GitHub, contact us through [philosophythatworks.com](https://philosophythatworks.com/) and ask for a private way to send the details. [SECURITY.md](SECURITY.md) explains what to include and what is in scope.

## How it is made

PTW grid is made by one person, the copyright holder, working with an AI coding assistant (Claude, by Anthropic). The person sets the direction, makes the decisions and checks the results. The assistant drafts much of the code, tests and documentation. No one else has contributed code.

---

© 2026 Hwang Dae Jin (Philosophy That Works). Philosophy That Works is not yet an incorporated company, and the copyright is held by Hwang Dae Jin personally.
