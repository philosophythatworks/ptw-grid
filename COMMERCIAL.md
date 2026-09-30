# Commercial licence

PTW grid is **dual-licensed**. You can choose between:

1. **AGPL-3.0-only**: free, for everyone.
2. **A commercial licence** from the copyright holder, for people and organisations that cannot meet the AGPL's obligations.

The copyright holder is Hwang Dae Jin, who publishes PTW grid under the name Philosophy That Works (not yet an incorporated company).

## AGPL-3.0-only, for everyone

The PTW grid engine (the code in this repository, except the files that [NOTICE](NOTICE) and [REUSE.toml](REUSE.toml) list under other licences) is licensed under the GNU Affero General Public License, version 3 only ([LICENSES/AGPL-3.0-only.txt](LICENSES/AGPL-3.0-only.txt); [LICENSE](LICENSE) is the same text). You may use it for any purpose, including personal, research and commercial use. You may also study it, change it and share it, at no cost.

In return, the AGPL asks for a few things. In short:

- **If you distribute it**, on its own, changed, or as part of a larger program based on it, you must pass the same freedoms on. That means making the complete corresponding source code available to the people who receive it, under AGPL-3.0-only.
- **If you change it and let other people use your changed version over a network**, for example as a hosted service or inside an online AI agent, you must offer those users the source code of your changed version (AGPL section 13).
- You must keep the copyright and licence notices. The software comes with no warranty.

This is a plain-language summary and not legal advice. The licence text is what counts.

For many uses the AGPL is all you need. Two examples are running PTW grid on your own computer with your own AI tools, and building an open-source project whose licence is compatible with the AGPL.

## Commercial licence, for when the AGPL does not fit

A commercial licence lets you use the engine without the AGPL's copyleft obligations. Common reasons to want one:

- **Closed products.** You want to embed the engine in a product you distribute without its source code, such as a desktop app, browser extension, agent platform or device.
- **Network services without sharing changes.** You want to offer a modified version as a network service, such as a hosted API, a SaaS product or an online AI agent, without publishing the source of your changes.
- **Company policy.** Your organisation does not allow AGPL-licensed code.

## What a commercial licence can include

Each licence is agreed case by case and may include:

- **The right to use, change and distribute the engine** in your product or service with no AGPL copyleft obligations. You would have no duty to publish your source code or your changes.
- **Support options**, such as help with integration and direct answers from the maintainer.
- **Warranty and liability terms** that suit your use. The AGPL version comes with no warranty.
- **Scope** that fits your case: which products or services, how many users or installations, and for how long.

A commercial licence covers PTW grid's own code. Third-party components, such as Electron, keep their own licences (see [NOTICE](NOTICE)). Prices are not published.

## What does not need a commercial licence

Only the engine code is dual-licensed. Everything below is already open to everyone:

- **The GRID/1 grammar.** The specification ([spec/GRID-1.md](spec/GRID-1.md), with a Korean version in [spec/GRID-1.ko.md](spec/GRID-1.ko.md)) is licensed under CC-BY-4.0. You may write your own GRID/1 implementation, open or closed, without asking us.
- **The specification's example outputs and legend paragraph, and the conformance material** (`test/captures`, `test/snapshots`, `cli/fixtures` and the capture format in `src/core/capture.d.ts`) are CC0-1.0.
- **Documentation.** The README files, the CHANGELOG and the policy files, including this one, are CC-BY-4.0.
- **Program output.** You may use the GRID/1 text that PTW grid produces freely: we claim no rights in it, and PTW grid's own fixed wording in it is CC0-1.0. The page content inside it still belongs to its owners.

[REUSE.toml](REUSE.toml) and [NOTICE](NOTICE) give the licence of every file, and the Licensing section of the [README](README.md#licensing) sums it up.

The names "PTW", "PTW grid" and "Philosophy That Works" are a separate matter, covered in [TRADEMARKS.md](TRADEMARKS.md). A commercial licence covers the code. It does not by itself let you use these names for your product.

## How to ask

Contact us through <https://philosophythatworks.com/>. It helps to tell us:

- who you are and which organisation you represent;
- what you are building and where PTW grid fits in: a product you distribute, a hosted service, or internal use;
- whether you plan to change the engine;
- whether you need support or warranty terms.

## Why dual licensing works here

Dual licensing works because the engine code has a single source: all of it was made by the copyright holder working with an AI coding assistant, which drafted much of it, and none of it has been contributed by other people. For the same reason, code pull requests are not accepted yet (see [CONTRIBUTING.md](CONTRIBUTING.md)).
