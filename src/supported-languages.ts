export type RemoteAdapterId = "browser-preview" | "dartpad" | "kotlin-playground" | "swiftfiddle" | "wandbox";

export interface SupportedLanguage {
  browser: string;
  fence: `run-${string}`;
  id: string;
  label: string;
  local: string | null;
  obsidian: string;
  remoteAdapter: RemoteAdapterId;
  wandboxLanguage?: string;
}

export const SUPPORTED_LANGUAGES = [
  language("javascript", "JavaScript", "Wandbox → Web Worker", "Wandbox → Web Worker", "wandbox", "JavaScript", "node"),
  language("typescript", "TypeScript", "Wandbox → browser transpile", "Wandbox → browser transpile", "wandbox", "TypeScript"),
  language("python", "Python", "Wandbox", "Wandbox → local Python", "wandbox", "Python", "python3 / python"),
  language("sql", "SQL (SQLite)", "Wandbox", "Wandbox → local SQLite", "wandbox", "SQL", "sqlite3"),
  language("html", "HTML", "Sandboxed preview iframe", "Sandboxed preview iframe", "browser-preview"),
  language("css", "CSS", "Sandboxed preview iframe", "Sandboxed preview iframe", "browser-preview"),
  language("kotlin", "Kotlin", "Kotlin Playground", "Kotlin Playground → local kotlinc", "kotlin-playground", undefined, "kotlinc + java"),
  language("java", "Java", "Wandbox", "Wandbox → local JDK", "wandbox", "Java", "javac + java"),
  language("c", "C", "Wandbox", "Wandbox → local compiler", "wandbox", "C", "clang / gcc"),
  language("cpp", "C++", "Wandbox", "Wandbox → local compiler", "wandbox", "C++", "clang++ / g++"),
  language("go", "Go", "Wandbox", "Wandbox → local Go", "wandbox", "Go", "go"),
  language("rust", "Rust", "Wandbox", "Wandbox → local Rust", "wandbox", "Rust", "rustc"),
  language("csharp", "C#", "Wandbox", "Wandbox → local .NET SDK", "wandbox", "C#", "dotnet"),
  language("swift", "Swift", "SwiftFiddle", "SwiftFiddle → local Swift", "swiftfiddle", undefined, "swift"),
  language("ruby", "Ruby", "Wandbox", "Wandbox → local Ruby", "wandbox", "Ruby", "ruby"),
  language("php", "PHP", "Wandbox", "Wandbox → local PHP", "wandbox", "PHP", "php"),
  language("r", "R", "Wandbox", "Wandbox → local R", "wandbox", "R", "Rscript"),
  language("scala", "Scala", "Wandbox", "Wandbox → local Scala", "wandbox", "Scala", "scala"),
  language("dart", "Dart", "DartPad compile → isolated frame", "DartPad compile/frame → local Dart", "dartpad", undefined, "dart"),
  language("lua", "Lua", "Wandbox", "Wandbox → local Lua", "wandbox", "Lua", "lua"),
  language("shell", "Shell", "Wandbox", "Wandbox → local shell", "wandbox", "Bash script", "/bin/sh")
] as const satisfies readonly SupportedLanguage[];

function language(
  id: string,
  label: string,
  browser: string,
  obsidian: string,
  remoteAdapter: RemoteAdapterId,
  wandboxLanguage?: string,
  local: string | null = null
): SupportedLanguage {
  return { id, label, fence: `run-${id}`, browser, obsidian, remoteAdapter, wandboxLanguage, local };
}

export function supportedLanguagesDescription(): string {
  return SUPPORTED_LANGUAGES.map(
    ({ label, obsidian, browser }) => `${label} — Obsidian: ${obsidian}; Web: ${browser}`
  ).join(" · ");
}

export function supportedLanguage(id: string): SupportedLanguage | null {
  return SUPPORTED_LANGUAGES.find((language) => language.id === id) ?? null;
}
