# Runnable Code Blocks

Runnable Code Blocks turns explicit Markdown fences into IntelliJ-inspired, ephemeral editors in Obsidian and static websites. The Markdown stays portable while a small runner adapter selects a browser, named third-party, or locally installed runtime.

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

Version 0.2.0 defines 21 stable fences. “Remote” means the source is sent to the named provider; no execution server is operated by this project.

| Fence | Static web default | Obsidian Desktop fallback |
| --- | --- | --- |
| `run-javascript` | Wandbox → Web Worker | Web Worker → local `node` |
| `run-typescript` | Wandbox → browser transpile/Worker | Browser transpile/Worker |
| `run-python` | Wandbox | local `python3` / `python` |
| `run-sql` | Wandbox SQLite | local `sqlite3` |
| `run-html` | Sandboxed preview iframe | Same browser preview |
| `run-css` | Sandboxed preview iframe | Same browser preview |
| `run-kotlin` | Kotlin Playground | local `kotlinc` + `java` |
| `run-java` | Wandbox | local `javac` + `java` |
| `run-c` | Wandbox | local `clang` / `gcc` |
| `run-cpp` | Wandbox | local `clang++` / `g++` |
| `run-go` | Wandbox | local `go` |
| `run-rust` | Wandbox | local `rustc` |
| `run-csharp` | Wandbox | local `.NET SDK` |
| `run-swift` | SwiftFiddle | local `swift` |
| `run-ruby` | Wandbox | local `ruby` |
| `run-php` | Wandbox | local `php` |
| `run-r` | Wandbox | local `Rscript` |
| `run-scala` | Wandbox | local `scala` |
| `run-dart` | DartPad embed | local `dart` |
| `run-lua` | Wandbox | local `lua` |
| `run-shell` | Wandbox | local `/bin/sh` |

Remote execution is enabled and remote-first by default because the same Markdown must run on a static deployment. Obsidian settings can disable it or choose private-first. A provider fallback occurs only when execution is known not to have started; an unknown remote outcome stops instead of running the code a second time.

Compilation errors and program failures are results, not provider failures, so they never trigger another runner. See [runtime providers](docs/runtime-providers.md) for the adapter and safety contract.

## Security and local runtimes

Code runs only after **Run** or <kbd>⌘/Ctrl</kbd> + <kbd>Enter</kbd>. Treat every runnable block as executable code.

- Browser JavaScript and transpiled TypeScript use a fresh Web Worker with network globals and dynamic imports blocked, a timeout, and termination after every run.
- HTML/CSS use an iframe without same-origin or top-navigation permission and with a restrictive CSP.
- Remote adapters send source to Wandbox, Kotlin Playground, SwiftFiddle, or DartPad. Provider availability and limits are outside this project's control.
- Local adapters are Obsidian Desktop only. They run in a private temporary directory, cap output, enforce timeouts, avoid shell interpolation, and remove the directory afterward. They are process isolation, not an OS sandbox.
- The plugin never installs runtimes and PATH is never modified. Existing language installations remain owner-controlled. Optional executable overrides are exact paths stored in plugin settings.

## Local development

Requirements:

- Node.js 22 or later
- Obsidian Desktop 1.13 or later
- Only the local toolchains you intend to use; remote and browser adapters need none

```bash
npm ci
npm run verify
npm run smoke:local
npm run smoke:remote
```

`npm run verify` performs static checks, isolated tests with coverage, production builds, release-policy checks, and an npm package dry run. `npm run smoke:local` executes fixed examples only for already-installed runtimes and reports the others as unavailable. `npm run smoke:remote` submits the public sample programs to third-party providers, so run it intentionally and expect provider-dependent results.

The build creates:

- `main.js`, `manifest.json`, and `styles.css` for Obsidian
- `dist-site/` for the static browser adapter demonstration

## Static Wiki integration

The browser adapter recognizes standard rendered Markdown:

```html
<pre><code class="language-run-python">print("Hello")</code></pre>
```

It uses the same fence parser, language catalog, runner composition, editor, and output UI as the Obsidian plugin. Static pages can use browser-native and remote adapters but cannot spawn local processes. No API key, database, Vercel function, Supabase project, or project-owned backend is required.

GitHub Pages deployment is prepared in `.github/workflows/pages.yml`. The manual workflow verifies the repository and publishes `dist-site/`.

## Maintaining adapters

Runtime-specific URLs, compiler selection, request bodies, and response parsing live only in `src/runners/*-runner.ts`. Provider order is in `src/runner-composition.ts`; the public support matrix is in `src/supported-languages.ts`; examples are in `src/language-examples.ts`. An outage repair should normally touch one adapter and its focused test, without changing Markdown or UI code.

## Release

`.github/workflows/release.yml` verifies an exact manifest version and creates a draft GitHub release containing `main.js`, `manifest.json`, and `styles.css`. Publishing that draft and submitting to the Obsidian community catalog remain explicit maintainer actions.
