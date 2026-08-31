# Design QA · 0.2.1

## Reference and scope

The product keeps the compact IntelliJ New UI-inspired editor and tool-window hierarchy established by the 0.1 series. Version 0.2.1 applies that same component to the complete 21-language catalog and makes the active execution boundary visible.

No raster assets or machine-local reference paths are part of the repository. The stable visual contract is documented in `docs/design-system.md`; the runtime contract is documented in `docs/runtime-providers.md`.

## Automated evidence

- `npm run verify`: 68 tests passed with statements 88.01%, branches 74.84%, functions 86.84%, and lines 91.52%; production builds, release policy, and package dry-run passed.
- Release verifier: 21 fences, 9 adapter modules, approved network origins, direct local process spawning, private temporary workspaces, version alignment, and a reviewed 5 MB bundle ceiling passed.
- Static page DOM: 21 runnable blocks rendered and all 21 reached `Ready` after provider preflight.
- Editor boundary in Chromium:
  - 100 source lines plus two numbered editing lines: `clientHeight = scrollHeight = 2070px`.
  - 101 source lines plus two numbered editing lines: `clientHeight = 2070px`, `scrollHeight = 2090px`.
  - Therefore page height grows without an editor scrollbar through source line 100; internal scrolling starts at source line 101.
- The deployed GitHub Pages UI returned the expected result for all 21 catalog examples in one sequential audit: 19 stdout executions plus the HTML and CSS sandbox previews. Every result named the provider that actually ran it, and the browser log remained empty.
- Dart evidence additionally included a delayed asynchronous `main()`, `main(List<String>)`, and a thrown runtime error collected as failed output.
- Local smoke used only existing executables and passed JavaScript, Python, SQL, Kotlin, Java, C, C++, Go, Rust, C#, Swift, Ruby, and Shell. PHP, R, Scala, Dart, and Lua were correctly reported unavailable without installation.

## Provider-dependent evidence

The 21-language public-page audit used Kotlin Playground 2.4.10, DartPad 3.13.2, SwiftFiddle Swift 6.3.3, browser preview frames, and the compiler versions selected live by Wandbox. Earlier focused batches also observed transient Wandbox container-resource rejection and Go/Rust timeouts. The UI classified known pre-execution rejection separately and blocked fallback for timeout outcomes that might already have executed. A successful audit is evidence of current adapter behavior, not a provider uptime guarantee.

## Visual and interaction checks

- IntelliJ Darcula semantic colors remain keyword `#CF8E6D`, function `#56A8F5`, string `#6AAB73`, number `#2AACB8`, identifier `#BCBEC4`, type `#C77DBB`, and comment `#7A7E85`, with light-theme counterparts.
- Source editors retain line numbers and two real trailing editing lines; those display-only lines are removed before execution and are never persisted to Markdown.
- Empty Output and Reset controls remain hidden until relevant.
- The toolbar switches its environment label to the provider that actually completed a fallback run.
- HTML/CSS previews stay inside their Output region instead of creating an unrelated page surface. Dart uses a hidden sandboxed execution frame and returns stdout to the normal Output region.
- The complete language list and test blocks are generated from the same source catalog and examples used by the adapters.

## Result

Pre-release browser, build, contract, and local-runtime QA passed. Obsidian runtime load is verified separately through the receipt-based local-build installation and a post-reload UI check because enabled configuration alone does not prove that the running app loaded the new bundle.
