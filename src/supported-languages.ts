type RemoteAdapterId = "browser-preview" | "dartpad" | "kotlin-playground" | "swiftfiddle" | "wandbox";

export interface SupportedLanguage {
  browser: string;
  fence: `run-${string}`;
  id: string;
  label: string;
  obsidian: string;
  remoteAdapter: RemoteAdapterId;
  wandboxLanguage?: string;
}

export const SUPPORTED_LANGUAGES = [
  language("javascript", "JavaScript", "Wandbox → Web Worker", "Wandbox → Web Worker", "wandbox", "JavaScript"),
  language("typescript", "TypeScript", "Wandbox → browser transpile", "Wandbox → browser transpile", "wandbox", "TypeScript"),
  language("python", "Python", "Wandbox", "Wandbox", "wandbox", "Python"),
  language("sql", "SQL (SQLite)", "Wandbox", "Wandbox", "wandbox", "SQL"),
  language("html", "HTML", "Sandboxed preview iframe", "Sandboxed preview iframe", "browser-preview"),
  language("css", "CSS", "Sandboxed preview iframe", "Sandboxed preview iframe", "browser-preview"),
  language("web", "Web (HTML/CSS/JS)", "Interactive isolated iframe", "Interactive isolated iframe", "browser-preview"),
  language("web-ts", "Web (HTML/CSS/TypeScript)", "Sucrase → interactive isolated iframe", "Sucrase → interactive isolated iframe", "browser-preview"),
  language("kotlin", "Kotlin", "Kotlin Playground", "Kotlin Playground", "kotlin-playground"),
  language("java", "Java", "Wandbox", "Wandbox", "wandbox", "Java"),
  language("c", "C", "Wandbox", "Wandbox", "wandbox", "C"),
  language("cpp", "C++", "Wandbox", "Wandbox", "wandbox", "C++"),
  language("go", "Go", "Wandbox", "Wandbox", "wandbox", "Go"),
  language("rust", "Rust", "Wandbox", "Wandbox", "wandbox", "Rust"),
  language("csharp", "C#", "Wandbox", "Wandbox", "wandbox", "C#"),
  language("swift", "Swift", "SwiftFiddle", "SwiftFiddle", "swiftfiddle"),
  language("ruby", "Ruby", "Wandbox", "Wandbox", "wandbox", "Ruby"),
  language("php", "PHP", "Wandbox", "Wandbox", "wandbox", "PHP"),
  language("r", "R", "Wandbox", "Wandbox", "wandbox", "R"),
  language("scala", "Scala", "Wandbox", "Wandbox", "wandbox", "Scala"),
  language("dart", "Dart", "DartPad compile → isolated frame", "DartPad compile → isolated frame", "dartpad"),
  language("lua", "Lua", "Wandbox", "Wandbox", "wandbox", "Lua"),
  language("shell", "Shell", "Wandbox", "Wandbox", "wandbox", "Bash script")
] as const satisfies readonly SupportedLanguage[];

function language(
  id: string,
  label: string,
  browser: string,
  obsidian: string,
  remoteAdapter: RemoteAdapterId,
  wandboxLanguage?: string
): SupportedLanguage {
  return { id, label, fence: `run-${id}`, browser, obsidian, remoteAdapter, wandboxLanguage };
}

export function supportedLanguagesDescription(): string {
  return SUPPORTED_LANGUAGES.map(
    ({ label, obsidian, browser }) => `${label} — Obsidian: ${obsidian}; Web: ${browser}`
  ).join(" · ");
}

export function supportedLanguage(id: string): SupportedLanguage | null {
  return SUPPORTED_LANGUAGES.find((language) => language.id === id) ?? null;
}
