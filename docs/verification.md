# Verification evidence

This page records checks for the current source tree. Provider smoke results are time-dependent and do not promise third-party uptime.

The full remote sample sweep passed for all 18 CLI-backed language samples on 2026-09-05. The first Rust request timed out with an unknown outcome and correctly stopped without a fallback or duplicate submission; a separate retry passed with Wandbox `rust-1.82.0`.

## Automated verification

`npm run verify` passed for version 0.3.0:

- TypeScript strict checking and ESLint, including `eslint-plugin-obsidianmd` Community rules;
- Knip dead-code and dependency analysis;
- 76 tests in 10 files;
- coverage: 86.38% statements, 71.57% branches, 86.23% functions, and 90.18% lines;
- production Obsidian bundle: 899.5 KB;
- production static adapter bundle: 811.3 KB;
- release-policy check: 23 runnable fences and 8 runtime adapters;
- npm package dry run: 7 files, 281.2 KB compressed.

Additional repository checks passed:

- `npm audit`: 0 known vulnerabilities;
- Knip: 0 unused files, dependencies, exports, or exported types;
- `git diff --check`: no whitespace errors.

## Browser verification

The generated static adapter was served from `dist-site/` and inspected in a real browser:

- the live Kotlin block reached an enabled Run state through Kotlin Playground 2.4.10;
- **Run** exposed `aria-busy=true`, a spinner with `Running…`, and `Waiting for result…` before returning `Hello from Community!` and naming Kotlin Playground 2.4.10 in Output;
- all 18 CLI-capable remote samples passed through current Wandbox, Kotlin Playground, and SwiftFiddle providers;
- HTML rendered a native button and CSS styled the specimen button to `rgb(53, 116, 240)` with both frames retaining an empty sandbox token and `script-src 'none'`;
- `run-web` and `run-web-ts` each changed a real button from `Clicked 0 times` to `Clicked 1 times`; TypeScript named Sucrase 3.35.1 and both forwarded the click log into Output;
- the interactive frames exposed only `sandbox="allow-scripts"`, without `allow-same-origin`, and retained CSP blocks for network, forms, popups, top navigation, and objects;
- an accidental Korean edit was removed by Reset, which restored the Markdown source and hid both Reset and Output;
- desktop and the host-constrained 375 CSS pixel mobile viewport had no horizontal document overflow;
- light and dark media produced the intended host surfaces, reduced motion computed `animation-name: none`, and a 200% page scale retained matching document client and scroll widths;
- Dart returned `dart-ok` through DartPad and its isolated execution frame;
- the mobile editor preserved numbered lines, syntax highlighting, and an accessible Run control;
- the public-safe Ready, edit, Running, provider output, and interactive Web frames were normalized without stretching to 1600 × 900 and assembled into the current GIF;
- the landing page mounts one featured runner at startup and defers the other 23 live examples until their disclosure is opened.

## Reviewed failure paths

- A rejected runner preflight now becomes a stable `Unavailable` state instead of an unhandled promise rejection.
- CodeMirror's nested focus outline is suppressed so keyboard focus does not resemble a selected editor region; focused controls keep their visible focus ring.
- A new run clears the previous provider heading before an error result is rendered.
- HTML/CSS preview frames block scripts with both a sandbox and `script-src 'none'` CSP.
- Interactive Web frames allow inline scripts only inside a fresh opaque-origin iframe; TypeScript transform errors return before a frame opens.
- Remote fallback continues only after a known `not-started` result; an unknown outcome never executes the same code again.
- Runtime source does not import Node filesystem or child-process modules.

## Remaining external limits

Wandbox, Kotlin Playground, SwiftFiddle, and DartPad are independent public services. Their endpoints, compiler inventory, limits, CORS behavior, and availability can change without a plugin release. Browser JavaScript and TypeScript execution blocks common network globals and terminates its Worker after a timeout, but runnable code should still be treated as trusted executable content from the note.
