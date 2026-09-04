export type BrowserAdapterId =
  | "css-preview"
  | "html-preview"
  | "javascript-worker"
  | "react-preview"
  | "typescript-worker"
  | "web-preview"
  | "web-ts-preview";

export type RemoteAdapterId = "dartpad" | "kotlin-playground" | "swiftfiddle" | "wandbox";

export interface SupportedLanguage {
  browserAdapter?: BrowserAdapterId;
  fence: `run-${string}`;
  id: string;
  label: string;
  remoteAdapter?: RemoteAdapterId;
  runtime: string;
  wandboxLanguage?: string;
}

export const SUPPORTED_LANGUAGES = [
  language({ id: "javascript", label: "JavaScript", runtime: "Wandbox → Web Worker", browserAdapter: "javascript-worker", remoteAdapter: "wandbox", wandboxLanguage: "JavaScript" }),
  language({ id: "typescript", label: "TypeScript", runtime: "Wandbox → browser transpile", browserAdapter: "typescript-worker", remoteAdapter: "wandbox", wandboxLanguage: "TypeScript" }),
  language({ id: "python", label: "Python", runtime: "Wandbox", remoteAdapter: "wandbox", wandboxLanguage: "Python" }),
  language({ id: "sql", label: "SQL (SQLite)", runtime: "Wandbox", remoteAdapter: "wandbox", wandboxLanguage: "SQL" }),
  language({ id: "html", label: "HTML", runtime: "Sandboxed preview iframe", browserAdapter: "html-preview" }),
  language({ id: "css", label: "CSS", runtime: "Sandboxed preview iframe", browserAdapter: "css-preview" }),
  language({ id: "web", label: "Web (HTML/CSS/JS)", runtime: "Interactive isolated iframe", browserAdapter: "web-preview" }),
  language({ id: "web-ts", label: "Web (HTML/CSS/TypeScript)", runtime: "Sucrase → interactive isolated iframe", browserAdapter: "web-ts-preview" }),
  language({ id: "react", label: "React (JSX/TSX)", runtime: "React + Sucrase → interactive isolated iframe", browserAdapter: "react-preview" }),
  language({ id: "kotlin", label: "Kotlin", runtime: "Kotlin Playground", remoteAdapter: "kotlin-playground" }),
  language({ id: "java", label: "Java", runtime: "Wandbox", remoteAdapter: "wandbox", wandboxLanguage: "Java" }),
  language({ id: "c", label: "C", runtime: "Wandbox", remoteAdapter: "wandbox", wandboxLanguage: "C" }),
  language({ id: "cpp", label: "C++", runtime: "Wandbox", remoteAdapter: "wandbox", wandboxLanguage: "C++" }),
  language({ id: "go", label: "Go", runtime: "Wandbox", remoteAdapter: "wandbox", wandboxLanguage: "Go" }),
  language({ id: "rust", label: "Rust", runtime: "Wandbox", remoteAdapter: "wandbox", wandboxLanguage: "Rust" }),
  language({ id: "csharp", label: "C#", runtime: "Wandbox", remoteAdapter: "wandbox", wandboxLanguage: "C#" }),
  language({ id: "swift", label: "Swift", runtime: "SwiftFiddle", remoteAdapter: "swiftfiddle" }),
  language({ id: "ruby", label: "Ruby", runtime: "Wandbox", remoteAdapter: "wandbox", wandboxLanguage: "Ruby" }),
  language({ id: "php", label: "PHP", runtime: "Wandbox", remoteAdapter: "wandbox", wandboxLanguage: "PHP" }),
  language({ id: "r", label: "R", runtime: "Wandbox", remoteAdapter: "wandbox", wandboxLanguage: "R" }),
  language({ id: "scala", label: "Scala", runtime: "Wandbox", remoteAdapter: "wandbox", wandboxLanguage: "Scala" }),
  language({ id: "dart", label: "Dart", runtime: "DartPad compile → isolated frame", remoteAdapter: "dartpad" }),
  language({ id: "lua", label: "Lua", runtime: "Wandbox", remoteAdapter: "wandbox", wandboxLanguage: "Lua" }),
  language({ id: "shell", label: "Shell", runtime: "Wandbox", remoteAdapter: "wandbox", wandboxLanguage: "Bash script" })
] as const satisfies readonly SupportedLanguage[];

function language<const Definition extends Omit<SupportedLanguage, "fence">>(
  definition: Definition
): Definition &
  Pick<SupportedLanguage, "browserAdapter" | "remoteAdapter" | "wandboxLanguage"> &
  { fence: `run-${Definition["id"]}` } {
  return { ...definition, fence: `run-${definition.id}` };
}

export function supportedLanguagesDescription(): string {
  return SUPPORTED_LANGUAGES.map(
    ({ label, runtime }) => `${label} — Obsidian/Web: ${runtime}`
  ).join(" · ");
}

export function supportedLanguage(id: string): SupportedLanguage | null {
  return SUPPORTED_LANGUAGES.find((language) => language.id === id) ?? null;
}
