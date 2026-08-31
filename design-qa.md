# Design QA · 0.1.4

- Source visual truth:
  - `/var/folders/mx/tpp7b44n74n9n79smgj8g2t40000gn/T/codex-clipboard-586726b2-8166-4a2d-b542-a2487aac2de4.png`
  - `/var/folders/mx/tpp7b44n74n9n79smgj8g2t40000gn/T/codex-clipboard-664cb29f-d609-46c1-b286-988675b57c85.png`
  - `/var/folders/mx/tpp7b44n74n9n79smgj8g2t40000gn/T/codex-clipboard-cb05b208-983b-4066-aeda-bf71d077c4e6.png`
- Implementation screenshot: `/tmp/runnable-code-blocks-0.1.3-browser.png`
- Focused comparison: `/tmp/runnable-code-blocks-0.1.3-comparison.png`
- Supported-language screenshot: `/tmp/runnable-code-blocks-0.1.4-supported-languages.png`
- Browser viewport: 1280 × 720 CSS px, device scale factor 1
- Source comparison pixels: 931 × 657; implementation full-view pixels: 1265 × 1009
- Normalization: implementation content cropped to 922 × 650 and scaled to 931 × 657 before horizontal comparison
- State: dark theme; JavaScript successful run; Kotlin browser runner unavailable by design

## Full-view comparison evidence

The implementation retains the compact IntelliJ tool-window layout while replacing CSS-only editor depth with actual editor document lines. JavaScript has numbered blank lines 4 and 5; Kotlin has numbered blank lines 5 and 6. The static site and Obsidian share the same editor code and syntax theme.

The browser header now lists the complete implemented language set from the same source used to register runners: JavaScript (`run-javascript`) and Kotlin (`run-kotlin`). Each row states its Obsidian and static-web execution boundary. Obsidian settings display the same complete description.

## Focused comparison evidence

The side-by-side comparison shows the reported pseudo-space on the left and actual numbered lines on the right. It also shows the previous saturated magenta/blue default CodeMirror palette on the left versus the IntelliJ Darcula mapping on the right. The source and browser adapter order the languages differently; this is content order, not component drift.

## Required fidelity surfaces

- Fonts and typography: host UI font and monospace stack remain unchanged; syntax tokens use IntelliJ-style semantic roles rather than a generic fallback theme.
- Spacing and layout rhythm: the editor uses real line boxes, not bottom padding. Measured visible lines are JavaScript `1–5` and Kotlin `1–6`.
- Colors and visual tokens: dark palette is keyword `#CF8E6D`, function `#56A8F5`, string `#6AAB73`, number `#2AACB8`, identifier `#BCBEC4`, type `#C77DBB`, and comment `#7A7E85`. IntelliJ-light counterparts are provided for Obsidian light mode.
- Image quality and assets: no raster product assets are present; existing vector controls are unchanged.
- Copy and content: source code and output remain unchanged. The two display-only trailing lines are removed before runner invocation and never written to Markdown.

## Comparison history

1. Earlier findings:
   - P1: two line-heights were simulated with CSS padding, so no line numbers appeared.
   - P1: `defaultHighlightStyle` produced colors that did not match IntelliJ semantics or the supplied target.
2. Fixes:
   - Seed the ephemeral CodeMirror document with two trailing newline characters and reset to that same session value.
   - Remove the display-only newlines immediately before execution.
   - Replace the fallback highlighter with semantic IntelliJ Darcula/Light token mappings and Kotlin function-call detection.
3. Post-fix evidence:
   - Browser DOM reports five JavaScript lines and six Kotlin lines with visible sequential line numbers.
   - Computed dark token colors match the declared IntelliJ palette; Kotlin `main`, `listOf`, `println`, `map`, and `joinToString` receive function highlighting.
   - JavaScript execution returns `2, 4, 6, 8`; browser console has no errors or warnings.
   - The supported-language region contains exactly two rows, JavaScript and Kotlin, and exposes the same text in the accessibility tree.
   - Focused comparison contains no remaining actionable P0/P1/P2 difference for the requested changes.

## Follow-up polish

- P3: none for the requested line-number and syntax-color corrections.

final result: passed
