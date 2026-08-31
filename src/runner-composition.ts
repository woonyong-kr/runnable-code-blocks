import type { CodeRunner } from "./contracts";
import { RunnerRegistry, UnavailableRunner } from "./runner-registry";
import { BrowserPreviewRunner } from "./runners/browser-preview-runner";
import { DartPadRunner } from "./runners/dartpad-runner";
import { FallbackRunner } from "./runners/fallback-runner";
import { BrowserJavaScriptRunner } from "./runners/javascript-runner";
import { KotlinPlaygroundRunner } from "./runners/kotlin-playground-runner";
import { BrowserTypeScriptRunner } from "./runners/typescript-runner";
import { SwiftFiddleRunner } from "./runners/swiftfiddle-runner";
import { WandboxRunner } from "./runners/wandbox-runner";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "./supported-languages";

export type ExecutionOrder = "private-first" | "remote-first";

export interface RunnerCompositionOptions {
  executionOrder?: ExecutionOrder;
  localRunner?: (language: string) => CodeRunner | null;
  remoteExecutionEnabled?: boolean;
}

export function createRunnerRegistry(options: RunnerCompositionOptions = {}): RunnerRegistry {
  const registry = new RunnerRegistry();
  for (const language of SUPPORTED_LANGUAGES) {
    registry.register(language.id, () => composeLanguageRunner(language, options));
  }
  return registry;
}

export function composeLanguageRunner(
  language: SupportedLanguage,
  options: RunnerCompositionOptions = {}
): CodeRunner {
  const remote = options.remoteExecutionEnabled === false ? null : remoteRunner(language);
  const privateRunners = browserRunners(language);
  const local = options.localRunner?.(language.id) ?? null;
  if (local !== null) privateRunners.push(local);
  const ordered = options.executionOrder === "private-first"
    ? [...privateRunners, ...(remote === null ? [] : [remote])]
    : [...(remote === null ? [] : [remote]), ...privateRunners];
  if (ordered.length === 0) {
    return new UnavailableRunner(
      language.id,
      "browser",
      `${language.label} 실행 provider가 이 환경에 구성되지 않았습니다.`
    );
  }
  const only = ordered[0];
  return ordered.length === 1 && only !== undefined ? only : new FallbackRunner(language.id, ordered);
}

function remoteRunner(language: SupportedLanguage): CodeRunner | null {
  switch (language.remoteAdapter) {
    case "browser-preview":
      return null;
    case "dartpad":
      return new DartPadRunner();
    case "kotlin-playground":
      return new KotlinPlaygroundRunner();
    case "swiftfiddle":
      return new SwiftFiddleRunner();
    case "wandbox":
      return language.wandboxLanguage === undefined
        ? null
        : new WandboxRunner({ language: language.id, remoteLanguage: language.wandboxLanguage });
  }
}

function browserRunners(language: SupportedLanguage): CodeRunner[] {
  switch (language.id) {
    case "javascript":
      return [new BrowserJavaScriptRunner()];
    case "typescript":
      return [new BrowserTypeScriptRunner()];
    case "html":
    case "css":
      return [new BrowserPreviewRunner(language.id)];
    default:
      return [];
  }
}
