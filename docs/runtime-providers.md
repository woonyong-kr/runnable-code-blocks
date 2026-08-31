# Runtime provider architecture

The stable public contract is the Markdown fence `run-<language>`. Environment and provider selection are implementation details behind `CodeRunner`.

## Composition

```text
Markdown fence
  → supported-languages catalog
  → runner-composition
  → remote / browser / local adapter order
  → availability preflight
  → one execution result
```

- Static web composes remote and browser-native adapters only.
- Obsidian Desktop adds local adapters for installed toolchains.
- `remote-first` is the default; `private-first` and remote-off are user settings.
- A compile error, runtime exception, non-zero exit, or empty stdout is a completed execution result and never triggers fallback.

## Fallback state machine

| Provider outcome | Meaning | Try next adapter? |
| --- | --- | --- |
| Availability false | No source submitted | Yes |
| `ProviderUnavailableError("not-started")` | Rejection is known to precede execution | Yes |
| `ProviderUnavailableError("unknown")` | Request may have executed but its result is unknown | No |
| `RunResult` with any exit code | Execution completed | No |
| Unexpected adapter exception | Adapter contract failure | No |

This conservative boundary prevents a remote timeout, lost connection, or ambiguous HTTP failure from being followed by a second local execution with the same side effects. Only authentication/path/rate-limit rejection and explicitly recognized pre-execution infrastructure rejection are classified `not-started`.

## Provider map

| Adapter | Languages | Boundary |
| --- | --- | --- |
| `wandbox-runner.ts` | JavaScript, TypeScript, Python, SQL, Java, C, C++, Go, Rust, C#, Ruby, PHP, R, Scala, Lua, Shell | Source sent to `wandbox.org` |
| `kotlin-playground-runner.ts` | Kotlin | Source sent to `api.kotlinlang.org` |
| `swiftfiddle-runner.ts` | Swift | Source sent to `runner.swift-playground.com` |
| `dartpad-runner.ts` | Dart | Official `dartpad.dev` embed receives source |
| `javascript-runner.ts` | JavaScript | Fresh local Web Worker |
| `typescript-runner.ts` | TypeScript | Bundled TypeScript transpiler → fresh Web Worker |
| `browser-preview-runner.ts` | HTML, CSS | Sandboxed iframe with restrictive CSP |
| `local-language-runner.ts` | 18 locally executable languages | Existing executable, private temporary workspace |

External providers are public services, not project infrastructure. They may change endpoints, compiler names, CORS, limits, or availability without a release from this project. They provide convenience execution, not an uptime guarantee.

## Local runtime collision policy

The plugin does not download an SDK, package manager, compiler, interpreter, or daemon. It does not mutate `PATH`, shell profiles, system files, or language caches.

1. An exact executable override from plugin settings wins.
2. Otherwise the adapter probes a short language-specific candidate list already visible to the Obsidian process.
3. Every executable receives an argument array through `spawn(..., { shell: false })`; edited code is written to a mode-`0600` file or stdin, never interpolated into a shell command.
4. Compilation and execution occur in a unique `runnable-code-blocks-<language>-*` directory.
5. Output is capped, time is bounded, and the temporary directory is removed in `finally`.

This avoids installation conflicts but is not a security sandbox. Trusted local code can still use the current user's filesystem, network, environment, and child-process permissions.

## Adapter maintenance contract

Provider churn should remain a narrow patch:

1. Change endpoint, compiler selection, request serialization, and response parsing only in the affected `src/runners/*-runner.ts` file.
2. Preserve `CodeRunner`, `RunResult`, and `ProviderUnavailableError` semantics.
3. Add or update the focused mocked contract test in `tests/remote-runners.test.ts`.
4. Run `npm run verify`, followed by the explicit provider smoke command for that language.
5. Change `src/supported-languages.ts` only when the public support claim or adapter mapping changes.

Shared UI, Markdown parsing, and local adapters must not import provider-specific request schemas. `scripts/verify-release.mjs` checks the adapter inventory, 21-fence documentation, network-origin allowlist, local no-shell/temp-workspace boundaries, bundle ceiling, and version alignment.

## Adding a language

A supported language requires all of the following:

- one canonical ID and `run-<id>` fence in `src/supported-languages.ts`;
- syntax highlighting in `src/editor.ts`;
- at least one executable adapter;
- a deterministic sample in `src/language-examples.ts`;
- mocked adapter and composition tests;
- a successful build and, where applicable, live smoke evidence;
- README and release-verifier coverage.

Do not claim “all languages.” The project currently supports the exact 21-language catalog documented in the README.
