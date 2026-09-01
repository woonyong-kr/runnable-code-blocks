# Verification evidence

This page records checks for the current source tree. Provider smoke results are time-dependent and do not promise third-party uptime.

## Automated verification

`npm run verify` passed for version 0.2.7:

- TypeScript strict checking and ESLint, including `eslint-plugin-obsidianmd` Community rules;
- Knip dead-code and dependency analysis;
- 68 tests in 10 files;
- coverage: 88.08% statements, 73.34% branches, 87.87% functions, and 91.86% lines;
- production Obsidian bundle: 893.5 KB;
- production static adapter bundle: 804.5 KB;
- release-policy check: 21 languages and 8 runtime adapters;
- npm package dry run: 7 files, 278.7 KB compressed.

Additional repository checks passed:

- `npm audit`: 0 known vulnerabilities;
- Knip: 0 unused files, dependencies, exports, or exported types;
- `git diff --check`: no whitespace errors.

## Browser verification

The generated static adapter was served from `dist-site/` and inspected in a real browser:

- the live Kotlin block reached `Ready` through Kotlin Playground 2.4.10;
- **Run** returned `Hello from Community!` and named Kotlin Playground 2.4.10 in Output;
- all 18 CLI-capable remote samples passed through current Wandbox, Kotlin Playground, and SwiftFiddle providers;
- HTML and CSS rendered successfully in script-disabled preview frames, while Dart returned `dart-ok` through DartPad and its isolated execution frame;
- desktop and 390 × 844 responsive layouts had no horizontal document overflow;
- the mobile editor preserved numbered lines, syntax highlighting, and an accessible Run control;
- the README GIF was built from this real execution at 1130 × 590, 5.4 seconds, and 648 KB;
- the Community gallery preview was captured at its recommended 3:2 aspect ratio after a successful run;
- the landing page mounts one featured runner at startup and defers the other 21 live examples until their disclosure is opened.

## Reviewed failure paths

- A rejected runner preflight now becomes a stable `Unavailable` state instead of an unhandled promise rejection.
- A new run clears the previous provider heading before an error result is rendered.
- HTML/CSS preview frames block scripts with both a sandbox and `script-src 'none'` CSP.
- Remote fallback continues only after a known `not-started` result; an unknown outcome never executes the same code again.
- Runtime source does not import Node filesystem or child-process modules.

## Remaining external limits

Wandbox, Kotlin Playground, SwiftFiddle, and DartPad are independent public services. Their endpoints, compiler inventory, limits, CORS behavior, and availability can change without a plugin release. Browser JavaScript and TypeScript execution blocks common network globals and terminates its Worker after a timeout, but runnable code should still be treated as trusted executable content from the note.
