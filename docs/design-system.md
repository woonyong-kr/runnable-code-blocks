# Woon Obsidian plugin UI contract

Runnable Code Blocks, Link Calendar Navigator, and Linked Graph Navigator use one IntelliJ New UI-inspired interaction language while remaining independent Obsidian plugins.

## Visual language

- Flat tool-window surfaces rather than floating cards.
- A dark reference palette of `#1E1F22` canvas, `#2B2D30` toolbar, `#393B40` divider, `#3574F0` accent, and `#DFE1E5` text.
- Obsidian semantic variables provide the corresponding light, dark, high-contrast, and host-theme values.
- One-pixel dividers, six-pixel control radii, no decorative card shadows, and compact 34–40 pixel toolbars.
- Sixteen-pixel outline SVG icons with consistent optical weight.
- Blue selection or underline for the active mode; muted dots and labels for status.
- Interface text follows Obsidian's UI font. Code alone uses the configured monospace font.

## Surface roles

- Runnable Code Blocks maps editor, active line, execution state, and output to an IntelliJ editor plus tool window.
- Link Calendar maps navigation, month grid selection, and daily agenda to toolbar, editor grid, and side tool window.
- Linked Graph maps mode selection, graph canvas, and zoom controls to toolbar, editor canvas, and status controls.

The contract is intentionally a design and interaction contract, not a runtime dependency. Every Community Plugin release bundles its own CSS and continues to work when either of the other plugins is absent.

## Density rules

- Content determines panel height until a documented maximum is reached.
- Empty output, detail, and search regions do not reserve space.
- Secondary actions stay quiet and appear only when relevant.
- Primary content must remain usable at 390 CSS pixels without horizontal page overflow.
