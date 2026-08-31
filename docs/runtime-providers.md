# Runtime provider boundaries

Runnable Code Blocks keeps Markdown stable and selects a runner through an environment adapter. “All languages” is not a meaningful support claim: every language needs a syntax mode, execution adapter, timeout, output parser, availability check, and security boundary.

## Current support

| Language | Device | Browser-native | Remote |
| --- | --- | --- | --- |
| Kotlin | `kotlinc` + `java` | — | — |
| JavaScript | Web Worker | Web Worker | — |

## Adapter policy

### Device

Runs an allowlisted compiler or interpreter installed on the user's computer. A runner must use a private temporary directory, enforce a timeout, cap output, and clean up after every run. Device execution is suitable for Kotlin, Java, Python, TypeScript, Shell, Go, Rust, C, and C++ only after a dedicated runner for that language is implemented and tested.

### Browser-native

Runs inside the static page without sending source code away. JavaScript already uses this path. TypeScript can transpile before entering the same worker; Python and SQL are possible through large, lazy-loaded WebAssembly runtimes. Each remains a separate implementation and download-size decision.

### Remote

Sends source code to a named third-party provider. It must be disabled by default, identify the provider in the UI, explain the transmission before the first run, and never place an API secret in a public JavaScript bundle.

- [Kotlin Playground](https://kotlinlang.org/docs/run-code-snippets.html) is a viable Kotlin-specific browser provider; its embedded runner uses a compiler server.
- [OneCompiler](https://onecompiler.com/apis) and [JDoodle](https://www.jdoodle.com/docs/compiler-apis/jdoodle-api-quickstart/getting-started) cover many languages but require authenticated, metered APIs. Their secrets require a backend or provider-owned iframe.
- [Piston](https://github.com/engineer-man/piston) is self-hostable, but its public API is not generally available to individual projects and therefore is not a dependable static-site default.

The first remote adapter should be Kotlin Playground, opt-in and clearly marked `Remote · JetBrains`. General multi-language APIs should not be added until the project intentionally accepts a backend or a provider-owned embedded editor.
