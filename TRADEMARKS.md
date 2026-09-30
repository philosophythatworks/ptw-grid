# Names and trademarks

The PTW grid code is free software, but its names are not covered by the code licence. This page explains how you may use the names. It follows the approach of common open-source trademark guidelines: be truthful, and don't confuse people.

## The short version

- **The code** you may use, change and share under AGPL-3.0-only, or under a commercial licence (see [COMMERCIAL.md](COMMERCIAL.md)).
- **"PTW grid" and "Philosophy That Works"**, and the PTW grid logo if one is published, identify software released by Philosophy That Works. We also use **"PTW"** as short for Philosophy That Works.
- **The names are used by Hwang Dae Jin**, who publishes PTW grid under the name Philosophy That Works (not yet an incorporated company).
- **Forks are welcome**, but a fork must not call itself PTW grid.
- **Truthful references are fine**, such as "works with PTW grid" or "based on PTW grid".
- **"GRID/1" names the grammar.** Anyone may implement it and call conforming output "GRID/1-compatible". We ask that a modified grammar use a different name.
- **None of these names is a registered trademark** yet.

## Why this matters

Someone who installs "PTW grid", or sees `ptw-grid/<version>` in their server logs, should be able to trust that it is the software published at <https://github.com/philosophythatworks/ptw-grid>. That includes its safety limits: address blocking, polite rate limits and an honest user-agent (see the [README](README.md) and [SECURITY.md](SECURITY.md)). A changed version might behave differently, so it needs its own name.

## Uses that are always fine

You don't need to ask for any of these:

- **Referring to the project truthfully.** For example: "uses PTW grid", "works with PTW grid", "based on PTW grid", "a fork of PTW grid".
- **Writing and talking about it.** Articles, reviews, tutorials, talks, courses, comparisons and benchmarks are all fine.
- **Sharing unmodified copies of official releases under the original name.** Changes needed only to package or build it for a platform are also fine, as long as you make clear who made the package.
- **Keeping the copyright and licence notices in the code.** The AGPL requires them, and they are not a trademark use.
- **Keeping interface names for compatibility**, such as the tool names `grid_read` and `grid_screen` and the short `[grid …]` and `<<<grid-page …>>>` frame lines that agents see, as long as your product itself has a different name.
- **Keeping the repository name on a GitHub fork.** A fork keeps the name `ptw-grid` by default, and that is fine while you work on it. Rename it before you publish or distribute your own version.

## Uses that are not allowed without permission

- Calling a modified version, fork, product or service "PTW grid", or giving it a confusingly similar name (for example "PTWgrid", "PTW grid Pro" or "ptw-grid-plus").
- Using "PTW" for a modified version, fork, product or service in a way that suggests it comes from Philosophy That Works.
- Publishing a modified version (other than the packaging changes described above) under the `ptw-grid` handle: a package name on npm or another registry, the MCP server name or the `ptw-grid/<version>` user-agent token.
- Suggesting that Philosophy That Works made, endorses, certifies or partners with your product when it does not.
- Using "PTW grid" or "Philosophy That Works", or "PTW" in a way that suggests a connection with us, in your own product name, company name, domain name or social media account name.
- Using the logo, if one is published, for anything other than linking to this project.

We use "PTW" as short for Philosophy That Works. We only object to uses of "PTW" that suggest a connection with PTW grid or Philosophy That Works; we make no claim to the letters otherwise.

## Forks

Forks are welcome under AGPL-3.0-only. When you publish your version:

1. **Choose a new name** that is not confusingly similar to PTW grid.
2. **Change the handles**: the package name, the MCP server name, the user-agent token and the cache folder name (all `ptw-grid` in PTW grid), and any messages or log lines that name PTW grid. PTW grid identifies itself to websites as `ptw-grid/<version>`. Website owners should be able to tell your reader apart from ours.
3. **Describe where it comes from** if you like, for example "based on PTW grid by Philosophy That Works".
4. **Keep the copyright and licence notices**, as the AGPL requires.

## GRID/1

"GRID/1" is the name of the text grammar defined in [spec/GRID-1.md](spec/GRID-1.md) (CC-BY-4.0, with a Korean version in [spec/GRID-1.ko.md](spec/GRID-1.ko.md)). Every GRID/1 text starts with a line of the form `GRID/1 · <url> · "<title>"`.

- **Anyone may implement GRID/1**, in any language and under any licence, without asking. Independent implementations are welcome.
- **You may call a program or its output "GRID/1-compatible"**, or say it "outputs GRID/1", if the output conforms to the specification (see its Conformance section). To help you check, the captures in `test/captures`, the capture format in `src/core/capture.d.ts` and the expected output in `test/snapshots` are CC0-1.0.
- **If you change the grammar**, meaning you add, remove or rename parts or change what they mean, we ask that you give it a different name and not start its output with the `GRID/1 ·` line, because agents rely on that line to know how to read the text that follows. You may say your grammar is "derived from GRID/1".
- **Any later versions** (GRID/2 and so on) would be published by Philosophy That Works. Please don't use those names for your own grammars.
- The word "grid" on its own is an ordinary word, and we don't claim it. PTW grid uses it as a short name in its tool names and in its messages to agents; that does not change this.

## Legal status

None of these names is a registered trademark at this time, so we don't use the ® symbol. We may register them in the future, and this policy would then apply in the same way.

This policy is only about names. It does not limit any right that AGPL-3.0-only, or any other licence in this repository, gives you in the code and texts; those licences simply give no rights in the names. CC-BY-4.0 (section 2(b)(2)) and CC0-1.0 (section 4(a)) say so directly, and for the code, [NOTICE](NOTICE) declines trademark rights, as AGPL section 7(e) allows. The licence of every file is listed in [NOTICE](NOTICE) and [REUSE.toml](REUSE.toml).

## Questions

If you are unsure whether a use is fine, ask us through <https://philosophythatworks.com/>.
