# Changelog

This file records all notable changes to PTW grid.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Version numbers follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). While the major version is 0, any release may change the programming interface.

## Unreleased

Nothing yet.

## 0.1.4 — 2026-10-01 — first public release

This is the first public release of PTW grid, "AI eyes for web reading". It turns any public web page into GRID/1 text that any AI agent can read in the same way. See the [README](README.md) for installation and use.

### Added

- **GRID/1 output.** Every read starts with `GRID/1 · <url> · "<title>"`, followed by:
  - numbered elements `[n]` with role, name and state, for example `[12] button "Buy now" (covered by O1) @H12-I13`;
  - positions on a sheet of 12 columns (A–L) and 40-px rows, counted from the top of the page. Twenty rows make one 1280×800 screen. Pinned items use window rows (`@v…`);
  - regions (header, nav, main, aside, footer, section, form, dialog and others) and screen marks;
  - overlays that cover things (`O1`, `O2` …), with what they cover and how to close them or get past them;
  - a `checks:` line that reports how many tested elements are covered and how much hidden text was dropped;
  - the page's own metadata (JSON-LD, OpenGraph), when present;
  - a warning when a big image has no text, because the information may be only in the image.
- **Hidden-text quarantine.** Text a person cannot see (screen-reader-only, tiny, transparent, off-screen or low-contrast text) is removed from the output and counted (`hidden text dropped N`). aria-hidden content is left out too, but not counted. Invisible characters are removed and counted separately (`invisible characters removed N`).
- **Token budget.** MCP results stay within about 8,000 tokens. Long pages list the first screens in full and later screens as headings only.
- **MCP server** (`src/hosts/mcp/server.mjs`, server name `ptw-grid`), with two read-only tools:
  - `grid_read(url)` reads a public page and returns GRID/1 text plus a page handle;
  - `grid_screen(page, screen)` returns one screen of a page already read, in full (cut only if that one screen alone is over the budget). It uses the kept copy and makes no new network request.

  The server itself runs on plain Node.js. It starts an Electron reader process on the first read and stops it after 5 idle minutes. It speaks MCP protocol versions 2024-11-05 through 2025-11-25, and 2026-07-28, and it supports progress notifications and cancellation. Short waits for a turn happen automatically; for longer waits the tool says when to try again. It keeps up to 8 pages in memory for 30 minutes.
- **Untrusted-content frame.** Every page result is introduced by a line saying it is untrusted web content (`[grid <version>] Untrusted web content from …`). The page text is wrapped in begin and end markers (`<<<grid-page … begin>>>`) with a random tag that changes on every call. Page text is kept on single lines, and runs of `<<<` or `>>>` are broken up, so it cannot fake the markers or add lines of its own.
- **Test program.** `npx electron cli/grid.mjs read <url>` saves the raw capture, the GRID/1 text, screenshots, and an HTML view with the grid drawn over the screenshots.
- **Engine API** for apps that embed PTW grid (see `exports` in `package.json`). It includes the core text functions (`toText`, `legend`), the budget and frame helpers (`budgeted`, `fit`, `frame`, and `forView` for a window a person is looking at), the Electron reader (`createReader`, `captureFrom`), the in-page walker and the capture type definitions (`src/core/capture.d.ts`).
- **GRID/1 specification**: [spec/GRID-1.md](spec/GRID-1.md), with a Korean version in [spec/GRID-1.ko.md](spec/GRID-1.ko.md) (CC-BY-4.0).
- **Tests.** `npm test` runs with Node only, with no internet and no browser window. Electron and end-to-end MCP tests run on local test pages.
- **Licensing and project policies.** Dual licensing: AGPL-3.0-only, or a commercial licence ([COMMERCIAL.md](COMMERCIAL.md)). Licence information for every file follows the REUSE 3.2 layout ([REUSE.toml](REUSE.toml), [NOTICE](NOTICE)). Policies: [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md) and [TRADEMARKS.md](TRADEMARKS.md).

### Security

- PTW grid reads only public http and https pages, in a hidden, memory-only browser session that nothing else uses.
- It blocks local and private addresses. That covers loopback, private ranges, link-local, CGNAT, `0.0.0.0/8`, `localhost` and names ending in `.localhost` or `.local` (including these names written with a trailing dot, like `localhost.`), and the IPv6 forms (IPv4-mapped, NAT64, 6to4, unique-local, link-local, multicast). It also blocks names whose DNS answer points to such an address. The same checks apply to redirects and to every request a page makes. (A DNS answer that changes between the check and the connection, known as DNS rebinding, cannot be ruled out completely; see [SECURITY.md](SECURITY.md).)
- It refuses URLs that contain a username or password, and schemes that are not web schemes, such as `file:` and `chrome:`.
- It denies permissions, pop-ups, downloads and dialogs. It never sends client certificates, stops WebRTC from revealing local addresses, and mutes sound.
- Password, card and one-time-code fields always show only `(filled)` or `(empty)`.
- The MCP server clears cookies, storage, the cache and the HTTP authentication cache before every read.
- The MCP server applies polite rate limits, shared by every PTW grid MCP server running under the same user account:
  - one read at a time;
  - at least 3 seconds between reads;
  - at least 10 seconds between reads of the same site, subdomains included;
  - at most 20 reads per 10 minutes.

  To share these limits, the server keeps a small log of site names, read times and process IDs in a cache folder only your account can open (`~/Library/Caches/ptw-grid` on macOS, `$XDG_CACHE_HOME/ptw-grid` or `~/.cache/ptw-grid` elsewhere). Within one MCP connection, the same URL asked for again within 2 minutes reuses the last read. Each read is limited to 1 minute.
- PTW grid identifies itself to sites with `ptw-grid/<version>` in the user-agent, and asks for pages in your computer's language first, then in English.
- Two privacy options are available for apps that read a window a person is using. `maskValues` shows typed values only as `(filled)` or `(empty)`. `dropQuery` shows addresses without their query string and fragment. Both work inside the page, so the hidden values never leave it. Text that the page itself draws again somewhere else from what was typed (a live preview, lines an editor draws separately, search-result titles, the document title) is ordinary page text and is not masked; see section 5 of the [specification](spec/GRID-1.md).

### Known limitations

- PTW grid is read-only. It cannot click or type.
- It reads same-origin iframes and open shadow DOM, but not cross-origin iframes or closed shadow roots.
- It does not read text inside images, canvas or video.
- The reading window is 1280×800, so pages get their desktop layout.
- It checks at most 8 screens for covered elements. Items further down are listed but not checked.
- It does not check robots.txt. You are responsible for following each site's terms.
- Guessed names for unlabeled icons (marked with `~`) are currently written in Korean, for example `"~메뉴"` for a menu icon. The labels on the test program's `view.html` page, and the test names and check output of the test suites, are also in Korean.
- It has been tested only on macOS, with Node.js 26.x and Electron 44.x. Other platforms and versions have not been tested.
- It is not published on npm yet. Install it from source.

### Before the first public release

Earlier versions, up to 0.1.3, were private builds. The steps on the way to this release were:

- **A test build and experiments to choose the grammar.** The experiments used pages where the written order and the visible layout disagree:
  - With the 12-column positions, four Claude models (Haiku, Sonnet, Opus and Fable) answered 35 layout-trap questions 100% correctly. With the same text and the positions removed, they scored 60.7%.
  - On 12 mixed real and test pages, GRID/1 scored 99.5%, against 87.2% for a plain element list. There, most of the gain came from regions, screen marks, pinned items and cover marks rather than from the positions themselves.
  - The experiment materials are not part of this repository.
- **The first release of the engine**: the in-page walker, GRID/1 text, the Electron reader and the test program.
- **The MCP connection** (`grid_read`, `grid_screen`).
- **Safety hardening and privacy options**: address checks after DNS, full IPv6 handling, time and size limits, `maskValues` and `dropQuery`.
- **Viewed-part mode.** When an app reads a window that a person is looking at, the part in view is given in full.
