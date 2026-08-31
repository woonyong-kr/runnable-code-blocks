# Runnable Code Blocks

Runnable Code Blocks turns explicit Markdown fences into IntelliJ-inspired editors in Obsidian and static websites. The Markdown contract stays the same while each environment selects its own runner.

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

## Runtime boundary

| Fence | Obsidian Desktop | Static browser build |
| --- | --- | --- |
| `run-kotlin` | Local `kotlinc` and `java` processes | Editable, explicitly unavailable |
| `run-javascript` | Isolated Web Worker | Isolated Web Worker |

No execution server, API, database, or persisted editor state is used. JavaScript workers are terminated after each run and after the timeout. Kotlin is compiled in a private temporary directory and the directory is removed after the run.

Code runs only after the user presses **Run** or <kbd>⌘/Ctrl</kbd> + <kbd>Enter</kbd>. A runnable block can execute arbitrary code with the capabilities of its runner. Only run code you trust.

## Local development

Requirements:

- Node.js 22 or later
- Obsidian Desktop 1.13 or later
- Java and `kotlinc` for `run-kotlin`

```bash
npm ci
npm run verify
```

The build creates:

- `main.js`, `manifest.json`, and `styles.css` for Obsidian
- `dist-site/` for the static browser adapter demonstration

The Kotlin compiler is auto-detected from the plugin-scoped local runtime, Homebrew, `/usr/local`, or `PATH`. Kotlin and Java executable paths can be overridden in **Settings → Runnable Code Blocks**. The plugin does not start a daemon or listen on a port.

## Static Wiki integration

The browser adapter looks for standard rendered Markdown markup such as:

```html
<pre><code class="language-run-javascript">console.log("Hello")</code></pre>
```

It reads `run-javascript` with the same parser used by the Obsidian plugin, replaces the rendered block with the shared editor UI, and resolves the browser runner from a `RunnerRegistry`. Unsupported browser languages remain editable and explain which environment can execute them.

GitHub Pages deployment is prepared in `.github/workflows/pages.yml`. Its manual workflow builds and verifies the repository before uploading `dist-site/`; pushing source does not publish the site automatically.

## Release

`.github/workflows/release.yml` verifies the exact manifest version and creates a draft GitHub release containing the three Obsidian runtime assets. Publishing the draft remains an explicit maintainer action.
