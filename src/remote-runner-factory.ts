import type { CodeRunner } from "./contracts";
import { DartPadRunner } from "./runners/dartpad-runner";
import type { FetchLike } from "./runners/http-client";
import { KotlinPlaygroundRunner } from "./runners/kotlin-playground-runner";
import { SwiftFiddleRunner } from "./runners/swiftfiddle-runner";
import { WandboxRunner } from "./runners/wandbox-runner";
import type { RemoteAdapterId, SupportedLanguage } from "./supported-languages";

type RemoteFactory = (language: SupportedLanguage, fetch?: FetchLike) => CodeRunner | null;

const REMOTE_FACTORIES: Record<RemoteAdapterId, RemoteFactory> = {
  dartpad: (_language, fetch) => new DartPadRunner({ fetch }),
  "kotlin-playground": (_language, fetch) => new KotlinPlaygroundRunner({ fetch }),
  swiftfiddle: (_language, fetch) => new SwiftFiddleRunner({ fetch }),
  wandbox: (language, fetch) => language.wandboxLanguage === undefined
    ? null
    : new WandboxRunner({ fetch, language: language.id, remoteLanguage: language.wandboxLanguage })
};

export function createRemoteRunner(
  language: SupportedLanguage,
  fetch?: FetchLike
): CodeRunner | null {
  return language.remoteAdapter === undefined
    ? null
    : REMOTE_FACTORIES[language.remoteAdapter](language, fetch);
}
