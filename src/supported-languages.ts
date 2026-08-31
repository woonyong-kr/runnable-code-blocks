export interface SupportedLanguage {
  browser: string;
  fence: `run-${string}`;
  id: string;
  label: string;
  obsidian: string;
}

export const SUPPORTED_LANGUAGES = [
  {
    id: "javascript",
    label: "JavaScript",
    fence: "run-javascript",
    obsidian: "Browser Web Worker",
    browser: "Browser Web Worker"
  },
  {
    id: "kotlin",
    label: "Kotlin",
    fence: "run-kotlin",
    obsidian: "Local kotlinc + java",
    browser: "Edit only"
  }
] as const satisfies readonly SupportedLanguage[];

export function supportedLanguagesDescription(): string {
  return SUPPORTED_LANGUAGES.map(
    ({ label, obsidian, browser }) => `${label} — Obsidian: ${obsidian}; Web: ${browser}`
  ).join(" · ");
}
