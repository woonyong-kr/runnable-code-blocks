# Changelog

## 0.1.2

- Keep roughly two empty editor lines visible after the source without changing Markdown.
- Remove Obsidian's nested preformatted-block chrome from the output tool window.
- Preserve the editor's accessible name without triggering an Obsidian hover tooltip.

## 0.1.1

- Align the cell with the IntelliJ-inspired visual language shared by Link Calendar and Linked Graph.
- Replace the fixed-height IDE frame with a compact notebook-style editor.
- Hide empty output until execution and show Reset only after editing.
- Use host theme tokens, restrained SVG controls, and responsive mobile actions.

## 0.1.0

- Add the environment-independent `run-<language>` Markdown contract.
- Add local Kotlin execution through `kotlinc` and `java` without a daemon or execution server.
- Add isolated JavaScript execution through an ephemeral Web Worker.
- Add a shared IntelliJ-inspired CodeMirror editor, console, reset action, and keyboard shortcut.
- Add a static browser adapter and GitHub Pages build.
