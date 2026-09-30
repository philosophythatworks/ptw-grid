# Security policy

PTW grid opens web pages that an AI agent chooses, so its safety limits matter. Thank you for helping to keep them strong. The safety design is described under "Safety and politeness" in the [README](README.md#safety-and-politeness) and in section 5 of the [GRID/1 specification](spec/GRID-1.md).

## Supported versions

| Version | Security fixes |
|---|---|
| Latest 0.1.x release (currently 0.1.4) | Yes |
| Earlier releases | No. Please update. |

Fixes are released as a new 0.1.x version. Before you report a problem, please check that it still happens on the latest release.

## How to report a vulnerability

Please report privately. **Do not open a public issue, discussion or pull request.**

1. **GitHub private vulnerability reporting (preferred).** Open the **Security** tab of <https://github.com/philosophythatworks/ptw-grid> and choose **Report a vulnerability**, or go straight to <https://github.com/philosophythatworks/ptw-grid/security/advisories/new>. Only you and the maintainers can see the report.
2. **Through our website.** If you cannot use GitHub, or the **Report a vulnerability** button is not shown, contact us through <https://philosophythatworks.com/> and ask for a private way to send the details. Please leave the details out of that first message.

Reports may be written in English or Korean. Please include:

- the PTW grid version, your operating system, and your Node.js and Electron versions;
- how you ran it: the test program, the MCP server together with the name of your client, or your own app that embeds the engine;
- steps to reproduce, ideally with a minimal HTML page or a public test page that you control;
- what happened, what should have happened, and the impact you see.

Only test against pages you own or have permission to test. Do not include other people's personal data.

## What happens next

PTW grid is a small project, so responses are best effort. We will:

- confirm that we received your report;
- investigate it and keep you informed;
- fix it in a new release and publish a GitHub security advisory;
- credit you in the advisory, if you want to be credited.

Please keep the details private until a fix is released, or until a date we agree on together. There is no bug bounty.

## Scope

### In scope

**Address blocking.** PTW grid reads only public http and https pages. A report is in scope if PTW grid can be made to request any of the following, whether as the page itself, through a redirect or navigation, or as a subresource or WebSocket:

- a local or private address. This includes loopback, private IPv4 ranges, link-local, shared address space (CGNAT) and `0.0.0.0/8`, as well as IPv6 loopback, unique-local, link-local, site-local and multicast addresses, and IPv4 addresses embedded in IPv6 forms (compatible, mapped, translated, NAT64 and 6to4);
- `localhost`, or a name ending in `.localhost` or `.local`, also when written with a trailing dot (such as `localhost.`);
- a name whose DNS answer is a local or private address;
- a scheme other than `http`, `https`, `ws`, `wss`, `data` and `blob`, such as `file:` or `chrome:`.

It is also in scope if the page PTW grid opens, or a page it is redirected or navigated to, has a URL that contains a username or password. A public name written with a trailing dot (such as `example.com.`) is still a public name, and reading it is expected.

**Untrusted-content handling.** Every page result PTW grid returns to an agent (from `grid_read` and `grid_screen`) starts with a line saying it is untrusted web content, and the page text sits between markers with a random tag that changes on every call. These reports are in scope:

- page content that reaches the agent outside that frame, forges the markers, or adds lines of its own. Error messages are not framed, so page text that shows up in an error message counts too;
- text a person cannot see (screen-reader-only, tiny, transparent, off-screen or low-contrast text), aria-hidden content, or invisible characters that reach the output instead of being left out;
- page content that makes a result ignore its budget of about 8,000 tokens, or that makes the reader hang or run out of memory.

**Session isolation.** PTW grid reads pages in a hidden, memory-only browser session that nothing else uses. Before every read, the MCP server closes open connections and clears cookies, storage, the cache and the HTTP authentication cache. These reports are in scope:

- cookies, storage, cache or HTTP authentication carried over from one MCP read to the next, or shared with another app;
- page data from an MCP read (such as cookies, storage, cache or page content) written to disk. On purpose, the MCP server keeps only the shared read log (site names, read times and process IDs, plus its lock file) on disk, in your user cache folder, and the reader's working folder there is removed when the reader stops. The test program saves its output under `runs/` and `.userdata/` on purpose;
- a page that gets a permission (camera, microphone, location, notifications and so on), opens windows, downloads files, shows dialogs, receives a client certificate, or learns local IP addresses through WebRTC;
- page scripts that reach PTW grid's reading code (which runs in an isolated world), Node.js or Electron;
- the `gridfix://` test-page scheme becoming usable in the MCP server when it was not started for the test suite (with `GRID_TEST_FIXTURES` pointing at PTW grid's own `cli/fixtures`), or a test-page URL reading any file outside `cli/fixtures`.

**Rate limits.** Every PTW grid MCP server running under the same user account shares these limits (gaps are counted from the end of the previous read):

- one read at a time;
- at least 3 seconds between reads;
- at least 10 seconds between reads of the same site, subdomains included;
- at most 20 reads per 10 minutes.

To share them, the servers keep a small log of site names, read times and process IDs in a cache folder only your account can open (`~/Library/Caches/ptw-grid` on macOS, `$XDG_CACHE_HOME/ptw-grid` or `~/.cache/ptw-grid` elsewhere). Each read may take at most 1 minute.

Within one MCP connection, asking for the same URL again within 2 minutes reuses the last read. This reuse is not shared: two connections asking for the same URL each make a real read, within the shared limits. That is expected.

A report is in scope if an agent, using only the MCP tools, can make PTW grid read faster or more often than the shared limits allow. Another user account on the same computer interfering with the shared read log is also in scope.

**Other in-scope issues:**

- the privacy options failing: `maskValues` showing typed values, or `dropQuery` showing query strings or fragments (text that the page itself draws again somewhere else from what was typed, such as a live preview or the document title, is ordinary page text and is not masked, as section 5 of the specification explains);
- password, card or one-time-code fields showing their values instead of only `(filled)` or `(empty)`;
- malformed MCP messages that crash or hang the server;
- page handles that can be guessed.

### Out of scope

- **Instructions in visible page text.** An AI model may follow instructions in a page's visible text even when PTW grid has correctly framed that text as untrusted. PTW grid cannot make a model ignore text. It only makes sure the text is clearly labelled. A way to get content *outside* the frame is in scope.
- **robots.txt.** PTW grid does not check it, by design. Users are responsible for following each site's terms.
- **What sites can see.** Sites see your IP address, the `ptw-grid/<version>` user-agent and your computer's language (Accept-Language, then English). Reads are real visits and identify themselves on purpose.
- **Things PTW grid does not read**: cross-origin iframes, closed shadow roots, and text inside images, canvas and video.
- **Changes by the account owner.** Someone with access to your user account can edit or delete the read log, or change how the server is started, to lift the rate limits. The limits protect websites from over-eager agents, not from you.
- **Upstream bugs.** Please report vulnerabilities in Electron, Chromium or Node.js themselves upstream. Do tell us if PTW grid needs an update or uses them unsafely.
- **Apps that embed the engine** and read their own windows. Those browser sessions are the app's responsibility. The privacy options above are still in scope.

### Known limitation

Before every request to a named host, PTW grid checks the address that the name actually resolves to, and it remembers a public answer for up to 10 seconds. It also denies all permission requests, including local-network access. Even so, a request could still reach a local address if a name's DNS answer changes between that check and the connection (DNS rebinding), so this cannot be ruled out completely. If you can show it working in practice, please report it.

PTW grid has been tested only on macOS, with Node.js 26.x and Electron 44.x. Reports from other platforms and versions are welcome, but those have not been tested.
