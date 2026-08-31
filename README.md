# Runnable Code Blocks

Runnable Code Blocks turns explicit Markdown fences into IntelliJ-inspired, ephemeral editors in Obsidian and static websites. The Markdown stays portable while a small runner adapter selects a browser or named third-party runtime without a project-owned execution server.

Its tool-window UI follows the same public plugin-family contract as [Link Calendar Navigator](https://github.com/woonyong-kr/link-calendar) and [Linked Graph Navigator](https://github.com/woonyong-kr/linked-graph). See the [design system](docs/design-system.md).

````markdown
```run-kotlin
fun main() {
    println("Hello, Kotlin!")
}
```

```run-javascript
console.log("Hello, JavaScript!");
```
````

The editor is not persisted: reload restores the Markdown source. It grows through 100 source lines plus two numbered editing lines before its own scrollbar appears.

## Supported languages

Version 0.2.4 defines 21 stable fences. “Remote” means the source is sent to the named provider; no execution server is operated by this project.

| Fence | Static web | Obsidian |
| --- | --- | --- |
| `run-javascript` | Wandbox → Web Worker | Wandbox → Web Worker |
| `run-typescript` | Wandbox → browser transpile/Worker | Wandbox → browser transpile/Worker |
| `run-python` | Wandbox | Wandbox |
| `run-sql` | Wandbox SQLite | Wandbox SQLite |
| `run-html` | Sandboxed preview iframe | Same browser preview |
| `run-css` | Sandboxed preview iframe | Same browser preview |
| `run-kotlin` | Kotlin Playground | Kotlin Playground |
| `run-java` | Wandbox | Wandbox |
| `run-c` | Wandbox | Wandbox |
| `run-cpp` | Wandbox | Wandbox |
| `run-go` | Wandbox | Wandbox |
| `run-rust` | Wandbox | Wandbox |
| `run-csharp` | Wandbox | Wandbox |
| `run-swift` | SwiftFiddle | SwiftFiddle |
| `run-ruby` | Wandbox | Wandbox |
| `run-php` | Wandbox | Wandbox |
| `run-r` | Wandbox | Wandbox |
| `run-scala` | Wandbox | Wandbox |
| `run-dart` | DartPad compile API → isolated frame | DartPad compile API → isolated frame |
| `run-lua` | Wandbox | Wandbox |
| `run-shell` | Wandbox | Wandbox |

Remote execution is enabled and remote-first by default because the same Markdown must run on a static deployment. Obsidian settings can disable it or choose browser-first for languages with an in-browser adapter. A provider fallback occurs only when execution is known not to have started; an unknown remote outcome stops instead of running the code a second time.

Compilation errors and program failures are results, not provider failures, so they never trigger another runner. See [runtime providers](docs/runtime-providers.md) for the adapter and safety contract.

## Security and execution boundaries

Code runs only after **Run** or <kbd>⌘/Ctrl</kbd> + <kbd>Enter</kbd>. Treat every runnable block as executable code.

- Browser JavaScript and transpiled TypeScript use a fresh Web Worker with network globals and dynamic imports blocked, a timeout, and termination after every run.
- HTML/CSS use an iframe without same-origin or top-navigation permission and with a restrictive CSP.
- Remote adapters send source to Wandbox, Kotlin Playground, SwiftFiddle, or DartPad. DartPad compiles but does not execute source on its server; the returned JavaScript runs in a temporary sandboxed frame. Provider availability and limits are outside this project's control.
- The Community Plugin does not access the filesystem, spawn local processes, install runtimes, or modify `PATH`.

## Local development

Requirements:

- Node.js 22 or later
- Obsidian 1.13 or later

```bash
npm ci
npm run verify
npm run smoke:remote
```

`npm run verify` performs static checks, isolated tests with coverage, production builds, release-policy checks, and an npm package dry run. `npm run smoke:remote` submits the public sample programs to third-party providers, so run it intentionally and expect provider-dependent results.

The build creates:

- `main.js`, `manifest.json`, and `styles.css` for Obsidian
- `dist-site/` for the static browser adapter demonstration

## Static Wiki integration

The browser adapter recognizes standard rendered Markdown:

```html
<pre><code class="language-run-python">print("Hello")</code></pre>
```

It uses the same fence parser, language catalog, runner composition, editor, and output UI as the Obsidian plugin. Both surfaces use browser-native and remote adapters only. No API key, database, Vercel function, Supabase project, project-owned backend, or local process runner is required.

GitHub Pages deployment is prepared in `.github/workflows/pages.yml`. The manual workflow verifies the repository and publishes `dist-site/`.

## Maintaining adapters

Runtime-specific URLs, compiler selection, request bodies, and response parsing live only in `src/runners/*-runner.ts`. Provider order is in `src/runner-composition.ts`; the public support matrix is in `src/supported-languages.ts`; examples are in `src/language-examples.ts`. An outage repair should normally touch one adapter and its focused test, without changing Markdown or UI code.

## Release

`.github/workflows/release.yml` verifies an exact manifest version and creates a draft GitHub release containing `main.js`, `manifest.json`, and `styles.css`. Publishing that draft and submitting to the Obsidian community catalog remain explicit maintainer actions.
