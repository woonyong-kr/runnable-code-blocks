# Changelog

## 0.2.8

- Remove CodeMirror's nested focus outline so the editor no longer looks like a selected region while typing.
- Replace the low-resolution Community walkthrough with a public-safe 1600×900 Obsidian PNG; a new execution GIF is intentionally deferred.
- Lead the Community page with the real disposable editor while keeping the learning loop and provider boundary concise.
- Require sharp 16:9 README media in the release gate and make the disposable-editing and provider boundary easier to understand.

## 0.2.7

- Make Knip unused-code analysis part of the standard release gate and remove the unused public `RemoteAdapterId` type export it exposed.
- Move stored-setting normalization out of the plugin lifecycle, preserving the old `private-first` value through an explicit migration regression test.
- Expand the Community overview with the exact Run lifecycle, adapter maintenance boundaries, compatibility, and support guidance.
- Replace the public walkthrough with a real Ready → edit → Kotlin Playground output sequence captured from the deployed static adapter.

## 0.2.6

- Replace extended system-font fallbacks in the static landing page with the shared interface-font token, removing the Obsidian 1.11.4 compatibility warning.
- Add a release-policy check that prevents the unsupported font fallback from returning.

## 0.2.5

- Redesign the README and static demo around a one-minute quick start, live Kotlin editor, clearer value proposition, and an actual execution GIF.
- Turn runner preflight exceptions into a stable unavailable UI state and clear stale provider labels before each execution.
- Disable scripts inside HTML/CSS previews in addition to their existing network-blocking CSP and sandbox.
- Remove unused exports and fallback state, replace stale QA claims with current verification evidence, and add automatic pull-request and main-branch verification.

## 0.2.4

- Replace global DOM, timer, and HTTP usage with Obsidian-native and explicit browser adapters.
- Adopt searchable declarative settings and a void-safe asynchronous Run handler.
- Remove filesystem and child-process execution from the Community Plugin; all 21 languages now use browser-native or named remote providers without a project-owned server.
- Add the official Obsidian ESLint rules to local verification so Community review warnings fail before release.

## 0.2.3

- Move the hidden Dart execution frame's static layout from an inline style assignment to the shared stylesheet for Obsidian source-policy compliance.

## 0.2.2

- Replace the bundled TypeScript compiler with Sucrase's focused browser transform, preserving isolated execution while removing obfuscation-like compiler diagnostic identifiers from release assets.
- Remove the Community Directory CSS compatibility warnings for `!important` and `clip-path`.
- Generate GitHub build-provenance attestations for all three Obsidian release assets.

## 0.2.1

- Replace the retired arbitrary-code DartPad embed route with the supported DartPad compile API and a temporary sandboxed execution frame.
- Wait for synchronous and asynchronous Dart `main()` completion before reporting output, including the conventional `List<String>` argument form.

## 0.2.0

- Expand the stable Markdown contract to 21 exact languages with IntelliJ-style syntax modes and generated examples.
- Add Wandbox, Kotlin Playground, SwiftFiddle, and DartPad remote adapters for a static-site deployment without a project-owned execution server.
- Add browser-native JavaScript, TypeScript, HTML, and CSS adapters plus 18 local toolchain adapters for Obsidian Desktop.
- Compose configurable remote-first or private-first execution and stop fallback when a remote outcome may already have executed.
- Show the environment and named provider that actually completed each fallback run.
- Detect existing local runtimes without installing them or mutating PATH; use private temporary workspaces, direct process spawning, timeouts, output caps, and cleanup.
- Isolate provider-specific implementation and tests so service changes normally require only an adapter patch.
- Let editors grow through 100 source lines plus two numbered editing lines before showing an internal scrollbar.

## 0.1.4

- Display the complete supported-language list and each environment boundary in the browser demo and Obsidian settings.

## 0.1.3

- Add two real, numbered blank lines to the ephemeral editor document instead of CSS-only space.
- Match syntax highlighting to the IntelliJ Darcula palette for keywords, functions, strings, numbers, types, comments, and identifiers.

## 0.1.2

- Keep roughly two empty editor lines visible after the source without changing Markdown.
- Remove Obsidian's nested preformatted-block chrome from the output tool window.
- Preserve the editor's accessible name without triggering an Obsidian hover tooltip.

## 0.1.1

- Align the cell with the IntelliJ-inspired visual language shared by Link Calendar and Linked Graph.
- Replace the fixed-height IDE frame with a compact notebook-style editor.
- Hide empty output until execution and show Reset only after editing.
- Use host theme tokens, restrained SVG controls, and responsive mobile actions.

## 0.1.0

- Add the environment-independent `run-<language>` Markdown contract.
- Add local Kotlin execution through `kotlinc` and `java` without a daemon or execution server.
- Add isolated JavaScript execution through an ephemeral Web Worker.
- Add a shared IntelliJ-inspired CodeMirror editor, console, reset action, and keyboard shortcut.
- Add a static browser adapter and GitHub Pages build.
