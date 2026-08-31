# Contributing

Run `npm run verify` before proposing a change. New languages must keep the `run-<language>` Markdown contract and implement `CodeRunner` without changing existing documents.

Never auto-run document code. A runner must report availability, enforce a timeout, avoid persistence by default, and document whether it executes locally, in a browser sandbox, or through an external service. This project currently accepts no execution-server adapter.

