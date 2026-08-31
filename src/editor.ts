import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching,
  defaultHighlightStyle,
  indentOnInput,
  StreamLanguage,
  syntaxHighlighting
} from "@codemirror/language";
import { kotlin } from "@codemirror/legacy-modes/mode/clike";
import { EditorState } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers
} from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";

export interface RunnableEditor {
  destroy(): void;
  focus(): void;
  getValue(): string;
  setValue(value: string): void;
}

let editorLabelSequence = 0;

function languageExtension(language: string) {
  if (language === "javascript") return javascript();
  if (language === "kotlin") return StreamLanguage.define(kotlin);
  return [];
}

export function createRunnableEditor(
  parent: HTMLElement,
  initialCode: string,
  language: string,
  onRun: () => void,
  onChange?: (value: string) => void
): RunnableEditor {
  const accessibleLabel = document.createElement("span");
  accessibleLabel.className = "rcb__sr-only";
  accessibleLabel.id = `rcb-editor-label-${String(++editorLabelSequence)}`;
  accessibleLabel.textContent = `${language} runnable code editor`;
  parent.append(accessibleLabel);

  const state = EditorState.create({
    doc: initialCode,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      highlightActiveLine(),
      keymap.of([
        { key: "Mod-Enter", run: () => (onRun(), true) },
        indentWithTab,
        ...defaultKeymap,
        ...historyKeymap
      ]),
      languageExtension(language),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        "aria-labelledby": accessibleLabel.id,
        spellcheck: "false"
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChange?.(update.state.doc.toString());
      })
    ]
  });
  const view = new EditorView({ parent, state });
  return {
    destroy: () => {
      view.destroy();
      accessibleLabel.remove();
    },
    focus: () => view.focus(),
    getValue: () => view.state.doc.toString(),
    setValue: (value) => {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  };
}
