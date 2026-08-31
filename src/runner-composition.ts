import type { CodeRunner } from "./contracts";
import { RunnerRegistry, UnavailableRunner } from "./runner-registry";
import { BrowserPreviewRunner } from "./runners/browser-preview-runner";
import { DartPadRunner } from "./runners/dartpad-runner";
import { FallbackRunner } from "./runners/fallback-runner";
import type { FetchLike } from "./runners/http-client";
import { BrowserJavaScriptRunner } from "./runners/javascript-runner";
import { KotlinPlaygroundRunner } from "./runners/kotlin-playground-runner";
import { BrowserTypeScriptRunner } from "./runners/typescript-runner";
import { SwiftFiddleRunner } from "./runners/swiftfiddle-runner";
import { WandboxRunner } from "./runners/wandbox-runner";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "./supported-languages";

export type ExecutionOrder = "browser-first" | "remote-first";

export interface RunnerCompositionOptions {
  executionOrder?: ExecutionOrder;
  fetch?: FetchLike;
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
  const remote = options.remoteExecutionEnabled === false ? null : remoteRunner(language, options.fetch);
  const browser = browserRunners(language);
  const ordered = options.executionOrder === "browser-first"
    ? [...browser, ...(remote === null ? [] : [remote])]
    : [...(remote === null ? [] : [remote]), ...browser];
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

function remoteRunner(language: SupportedLanguage, fetch_?: FetchLike): CodeRunner | null {
  switch (language.remoteAdapter) {
    case "browser-preview":
      return null;
    case "dartpad":
      return new DartPadRunner({ fetch: fetch_ });
    case "kotlin-playground":
      return new KotlinPlaygroundRunner({ fetch: fetch_ });
    case "swiftfiddle":
      return new SwiftFiddleRunner({ fetch: fetch_ });
    case "wandbox":
      return language.wandboxLanguage === undefined
        ? null
        : new WandboxRunner({ fetch: fetch_, language: language.id, remoteLanguage: language.wandboxLanguage });
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
