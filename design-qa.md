# Design QA · 0.2.0

## Reference and scope

The product keeps the compact IntelliJ New UI-inspired editor and tool-window hierarchy established by the 0.1 series. Version 0.2.0 applies that same component to the complete 21-language catalog and makes the active execution boundary visible.

No raster assets or machine-local reference paths are part of the repository. The stable visual contract is documented in `docs/design-system.md`; the runtime contract is documented in `docs/runtime-providers.md`.

## Automated evidence

- `npm run verify`: 58 tests passed with statements 87.36%, branches 71.95%, functions 83.91%, and lines 91.20%; production builds, release policy, and package dry-run passed.
- Release verifier: 21 fences, 9 adapter modules, approved network origins, direct local process spawning, private temporary workspaces, version alignment, and a reviewed 5 MB bundle ceiling passed.
- Static page DOM: 21 runnable blocks rendered and all 21 reached `Ready` after provider preflight.
- Editor boundary in Chromium:
  - 100 source lines plus two numbered editing lines: `clientHeight = scrollHeight = 2070px`.
  - 101 source lines plus two numbered editing lines: `clientHeight = 2070px`, `scrollHeight = 2090px`.
  - Therefore page height grows without an editor scrollbar through source line 100; internal scrolling starts at source line 101.
- Browser UI runs returned expected output for JavaScript, TypeScript, Python, Kotlin, Java, C, C++, C#, and Swift. HTML and CSS produced sandboxed previews; Dart produced the official embed.
- Local smoke used only existing executables and passed JavaScript, Python, SQL, Kotlin, Java, C, C++, Go, Rust, C#, Swift, Ruby, and Shell. PHP, R, Scala, Dart, and Lua were correctly reported unavailable without installation.

## Provider-dependent evidence

Earlier focused remote smoke runs returned the expected output for every non-preview adapter language. During the later full UI batch, Wandbox also produced transient container-resource rejections and Go/Rust response timeouts. The UI classified pre-execution container rejection separately and blocked fallback for timeout outcomes that might already have executed. This is expected degradation for a third-party service, not evidence of guaranteed provider uptime.

## Visual and interaction checks

- IntelliJ Darcula semantic colors remain keyword `#CF8E6D`, function `#56A8F5`, string `#6AAB73`, number `#2AACB8`, identifier `#BCBEC4`, type `#C77DBB`, and comment `#7A7E85`, with light-theme counterparts.
- Source editors retain line numbers and two real trailing editing lines; those display-only lines are removed before execution and are never persisted to Markdown.
- Empty Output and Reset controls remain hidden until relevant.
- The toolbar switches its environment label to the provider that actually completed a fallback run.
- HTML/CSS and Dart previews stay inside their Output region instead of creating an unrelated page surface.
- The complete language list and test blocks are generated from the same source catalog and examples used by the adapters.

## Result

Pre-release browser, build, contract, and local-runtime QA passed. Obsidian runtime load is verified separately through the receipt-based local-build installation and a post-reload UI check because enabled configuration alone does not prove that the running app loaded the new bundle.
