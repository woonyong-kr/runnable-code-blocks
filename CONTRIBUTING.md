# Contributing

Run `npm run verify` before proposing a change. New languages must keep the `run-<language>` Markdown contract and implement `CodeRunner` without changing existing documents.

Never auto-run document code. A runner must report availability, enforce a timeout, avoid persistence by default, and document whether it executes locally, in a browser sandbox, or through an external service.

Keep provider-specific URLs, request schemas, compiler selection, and response parsing inside one `src/runners/*-runner.ts` adapter. Remote adapters must identify where source is sent, require no secret in the public bundle, and distinguish known `not-started` rejection from an `unknown` outcome that must not be executed again. Project-owned execution infrastructure is out of scope; named third-party adapters require focused contract tests and intentional live smoke evidence.
