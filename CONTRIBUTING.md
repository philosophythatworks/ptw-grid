# Contributing to PTW grid

Thank you for your interest in PTW grid. Right now the most helpful contributions are **issues and ideas**. For an overview of the project, see the [README](README.md).

## Issues and ideas are welcome

Open an issue at <https://github.com/philosophythatworks/ptw-grid/issues> for:

- pages that PTW grid reads wrongly, for example with wrong positions, missing elements, overlays it didn't notice, or hidden text that got through;
- problems installing or running PTW grid, or connecting it to an AI client;
- ideas about the GRID/1 grammar ([spec/GRID-1.md](spec/GRID-1.md)), the tools or the documentation, including mistakes you find in the documentation.

For security problems, please don't open an issue. Follow [SECURITY.md](SECURITY.md) instead.

Issues may be written in English or Korean.

### What a good bug report includes

- **The page URL, if the page is public.** Don't post pages behind a login, or URLs that contain personal data or tokens. For a private page, the ideal is a small HTML file that shows the same problem.
- **Your system**:
  - operating system and version;
  - Node.js version (`node --version`);
  - Electron version (`npx electron --version`);
  - PTW grid version (`version` in `package.json`).
- **How you ran it**: with the test program (`npx electron cli/grid.mjs read <url>`), or with the MCP server and a named AI client.
- **An excerpt of the GRID/1 output.** Include the header lines, from the one starting with `GRID/1 ·` down to the `checks:` line and any `⚠` lines after it, plus the lines that are wrong. If you used the MCP server, also include the first line of the result (`[grid <version>] Untrusted web content …`), which shows the version. The output contains text from the page, so remove anything private first.
- **What you expected instead.** If positions are wrong, a screenshot helps. The test program saves screenshots and a `view.html` file that draws the grid over them.

## Code pull requests are not accepted yet

The PTW grid engine is dual-licensed: AGPL-3.0-only for everyone, plus a commercial licence from the copyright holder (see [COMMERCIAL.md](COMMERCIAL.md)). Offering both works only while the code has a single source. So far, all of the code has been made by the copyright holder working with an AI coding assistant, which drafted much of it, and no one else has contributed code. Accepting outside code would need a contributor licence agreement, and we have not set one up yet. Until then, we keep licensing simple by not merging code pull requests.

- If you open a pull request, we will close it with thanks, and we may turn the idea into an issue.
- Please describe fixes in words rather than sending patches. We will write the code.
- A contributor licence agreement may be introduced later. This file will say so when pull requests are open.
- You are free to fork PTW grid under AGPL-3.0-only. For how to name a fork, see [TRADEMARKS.md](TRADEMARKS.md).

## Running the tests

PTW grid has been tested only on macOS, with Node.js 26.x and Electron 44.x (`npm install` downloads Electron). Other platforms and versions have not been tested, and reports from them are welcome.

```sh
git clone https://github.com/philosophythatworks/ptw-grid.git
cd ptw-grid
npm install
npm test
```

`npm test` runs the core and MCP tests with Node only. It needs no internet connection and opens no browser window.

Two more tests use Electron and the local test pages in `cli/fixtures`:

```sh
npm run test:electron   # the reader, in a hidden window
npm run test:mcp        # the MCP server end to end (takes about a minute)
```

Before you run `test:mcp`, close other AI clients that use PTW grid: its last check fails if another PTW grid server has a reader running.

The test names and check output are in Korean. `npm test` passed if its summary shows `fail 0`. `test:electron` and `test:mcp` print one line per check (`✔` passed, `✘` failed, `–` skipped) and exit with code 0 when no check failed.

If you change the output format on purpose in your own copy, `UPDATE_SNAPSHOTS=1 npm test` rewrites the expected output in `test/snapshots`. Review the diff before you keep it.

## About the code

- Code comments are in Korean. Messages and tool text from PTW grid, including tool descriptions, error messages and the fixed parts of GRID/1 output, are in English, with three exceptions that are currently in Korean: guessed names for unlabeled icons (marked with `~`, for example `"~메뉴"` for a menu icon), the labels on the test program's `view.html` page, and the test names and check output of the test suites. Text taken from a page stays in the page's own language.
- Each JavaScript and TypeScript file has an SPDX header; [REUSE.toml](REUSE.toml) gives the licence of every other file, and [NOTICE](NOTICE) sums it up.
- PTW grid is built by one person, the copyright holder, directing an AI coding assistant (Claude, by Anthropic). See "How it is made" in the [README](README.md#how-it-is-made).
