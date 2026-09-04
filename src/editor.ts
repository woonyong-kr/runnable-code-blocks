import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  type StreamParser,
  StreamLanguage,
  syntaxHighlighting
} from "@codemirror/language";
import { c, cpp, csharp, dart, java, kotlin, scala } from "@codemirror/legacy-modes/mode/clike";
import { css } from "@codemirror/legacy-modes/mode/css";
import { go } from "@codemirror/legacy-modes/mode/go";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { python } from "@codemirror/legacy-modes/mode/python";
import { r } from "@codemirror/legacy-modes/mode/r";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { rust } from "@codemirror/legacy-modes/mode/rust";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { sqlite } from "@codemirror/legacy-modes/mode/sql";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { html } from "@codemirror/legacy-modes/mode/xml";
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
import { tags } from "@lezer/highlight";

export const INTELLIJ_DARCULA_COLORS = {
  comment: "#7A7E85",
  error: "#BC3F3C",
  function: "#56A8F5",
  identifier: "#BCBEC4",
  keyword: "#CF8E6D",
  meta: "#BBB529",
  number: "#2AACB8",
  string: "#6AAB73",
  type: "#C77DBB"
} as const;

export const EDITOR_SOURCE_LINE_LIMIT = 100;
export const EDITOR_TRAILING_BLANK_LINE_COUNT = 2;
export const EDITOR_MAX_VISIBLE_LINE_COUNT =
  EDITOR_SOURCE_LINE_LIMIT + EDITOR_TRAILING_BLANK_LINE_COUNT;

function syntaxColor(name: keyof typeof INTELLIJ_DARCULA_COLORS): string {
  return `var(--rcb-syntax-${name}, ${INTELLIJ_DARCULA_COLORS[name]})`;
}

const intellijDarculaHighlightStyle = HighlightStyle.define([
  {
    tag: [
      tags.keyword,
      tags.modifier,
      tags.controlKeyword,
      tags.definitionKeyword,
      tags.moduleKeyword,
      tags.operatorKeyword
    ],
    color: syntaxColor("keyword")
  },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: syntaxColor("function")
  },
  {
    tag: [tags.typeName, tags.className, tags.namespace],
    color: syntaxColor("type")
  },
  {
    tag: [tags.string, tags.docString, tags.character, tags.attributeValue, tags.regexp],
    color: syntaxColor("string")
  },
  {
    tag: [tags.number, tags.integer, tags.float, tags.bool, tags.null, tags.atom],
    color: syntaxColor("number")
  },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment],
    color: syntaxColor("comment"),
    fontStyle: "italic"
  },
  {
    tag: [tags.meta, tags.annotation, tags.macroName],
    color: syntaxColor("meta")
  },
  {
    tag: [
      tags.name,
      tags.variableName,
      tags.propertyName,
      tags.operator,
      tags.punctuation,
      tags.bracket
    ],
    color: syntaxColor("identifier")
  },
  {
    tag: tags.invalid,
    color: syntaxColor("error"),
    textDecoration: "underline"
  }
]);

const intellijKotlin: StreamParser<unknown> = {
  ...kotlin,
  token(stream, state) {
    const style = kotlin.token(stream, state);
    if (style !== "variable" && style !== "def") return style;

    const beforeToken = stream.string.slice(0, stream.start).trimEnd();
    const afterToken = stream.string.slice(stream.pos);
    const isFunctionDefinition = style === "def" && /\bfun$/u.test(beforeToken);
    const isFunctionCall = style === "variable" && /^\s*[({]/u.test(afterToken);
    return isFunctionDefinition || isFunctionCall ? "functionName" : style;
  },
  tokenTable: {
    ...kotlin.tokenTable,
    functionName: tags.function(tags.variableName)
  }
};

export interface RunnableEditor {
  destroy(): void;
  focus(): void;
  getValue(): string;
  setValue(value: string): void;
}

let editorLabelSequence = 0;

function languageExtension(language: string) {
  if (language === "javascript") return javascript();
  if (language === "typescript") return javascript({ typescript: true });
  if (language === "react") return javascript({ jsx: true, typescript: true });
  if (language === "web" || language === "web-ts") return StreamLanguage.define(html);
  if (language === "kotlin") return StreamLanguage.define(intellijKotlin);
  const modes: Record<string, StreamParser<unknown>> = {
    c,
    cpp,
    csharp,
    css,
    dart,
    go,
    html,
    java,
    lua,
    php: html,
    python,
    r,
    ruby,
    rust,
    scala,
    shell,
    sql: sqlite,
    swift
  };
  const mode = modes[language];
  return mode === undefined ? [] : StreamLanguage.define(mode);
}

export function createRunnableEditor(
  parent: HTMLElement,
  initialCode: string,
  language: string,
  onRun: () => void,
  onChange?: (value: string) => void
): RunnableEditor {
  parent.style.setProperty(
    "--rcb-editor-max-height",
    `calc(${String(EDITOR_MAX_VISIBLE_LINE_COUNT)}lh + 16px)`
  );
  const accessibleLabel = parent.createSpan();
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
      syntaxHighlighting(intellijDarculaHighlightStyle, { fallback: true }),
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
