# Design QA · 0.1.2

- Source visual truth: `/var/folders/mx/tpp7b44n74n9n79smgj8g2t40000gn/T/codex-clipboard-b35f6c25-6969-4a91-8300-f5e43aabc578.png`
- Implementation screenshot: `/tmp/runnable-code-blocks-0.1.2-browser.png`
- Focused comparison: `/tmp/runnable-code-blocks-0.1.2-comparison.png`
- Browser viewport: 1280 × 720 CSS px, device scale factor 1
- Source pixels: 831 × 225; implementation full-view pixels: 1265 × 977
- Normalization: implementation cell cropped to 922 × 220, scaled to 831 px wide, and padded to 831 × 225 before horizontal comparison
- State: dark theme, successful run with visible output

## Full-view comparison evidence

The implementation retains the IntelliJ-style compact toolbar, editor, active line, and bottom tool-window structure. The code editor now reserves roughly two line-heights below the source. The output is a single flat region rather than a second rounded code block.

## Focused comparison evidence

The focused side-by-side image was used because the reported defects are confined to the code cell. It confirms that the nested `pre` border, inner radius, margin, and centered Obsidian tooltip from the source screenshot are absent in the implementation. Language and execution duration differ because the browser evidence uses JavaScript while the source screenshot uses the device Kotlin runner; this is an expected runtime constraint rather than design drift.

## Required fidelity surfaces

- Fonts and typography: host UI font and configured monospace stack remain unchanged; `Output` is sentence case at 10.5px and no longer looks like a floating uppercase badge.
- Spacing and layout rhythm: three source lines render in a 116.7px editor and four source lines in a 136.9px editor, providing approximately two empty line-heights after the code.
- Colors and visual tokens: IntelliJ-inspired host tokens and the blue active-line/accent treatment are preserved.
- Image quality and assets: no raster product assets are present; existing vector control icons are unchanged.
- Copy and content: output value remains `2, 4, 6, 8`; the editor keeps an accessible name through `aria-labelledby` without an Obsidian hover label.

## Comparison history

1. Earlier findings:
   - P1: Obsidian's global `pre` styling created a nested rounded output panel.
   - P1: `aria-label` surfaced as a large centered hover tooltip over the output.
   - P2: the editor ended immediately after the final source line and looked cramped.
2. Fixes:
   - Reset output border, radius, shadow, and margin with host-aware selector specificity.
   - Replaced the direct editor `aria-label` with a visually hidden `aria-labelledby` label.
   - Added two visual line-heights of bottom padding without modifying Markdown source.
3. Post-fix evidence:
   - Computed output style: border `0px none`, radius `0px`, margin `0px`.
   - Browser console: no errors or warnings.
   - Side-by-side focused comparison contains no remaining actionable P0/P1/P2 difference.

## Follow-up polish

- P3: Recheck typography at the user's exact Obsidian window scale after installing the local build.

final result: passed
