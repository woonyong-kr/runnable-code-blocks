import { LANGUAGE_EXAMPLES } from "../src/language-examples";
import type { FetchLike } from "../src/runners/http-client";
import { KotlinPlaygroundRunner } from "../src/runners/kotlin-playground-runner";
import { ProviderUnavailableError } from "../src/runners/provider-errors";
import { SwiftFiddleRunner } from "../src/runners/swiftfiddle-runner";
import { WandboxRunner } from "../src/runners/wandbox-runner";
import { SUPPORTED_LANGUAGES } from "../src/supported-languages";

const nativeFetch = Reflect.get(global, "fetch") as FetchLike;
Reflect.set(global, "window", global);

const selected = new Set(process.argv.slice(2));
const remoteExamples = LANGUAGE_EXAMPLES.filter(({ language }) => {
  const definition = SUPPORTED_LANGUAGES.find(({ id }) => id === language);
  return definition?.remoteAdapter !== "browser-preview"
    && language !== "dart"
    && (selected.size === 0 || selected.has(language));
});
for (const example of remoteExamples) {
  const language = SUPPORTED_LANGUAGES.find(({ id }) => id === example.language);
  if (language === undefined) throw new Error(`Missing language ${example.language}`);
  const runner = language.remoteAdapter === "kotlin-playground"
    ? new KotlinPlaygroundRunner({ fetch: nativeFetch })
    : language.remoteAdapter === "swiftfiddle"
      ? new SwiftFiddleRunner({ fetch: nativeFetch })
      : new WandboxRunner({ fetch: nativeFetch, language: language.id, remoteLanguage: language.wandboxLanguage ?? "" });
  const availability = await runner.availability();
  if (!availability.available) throw new Error(`${language.label}: ${availability.detail}`);
  let result;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      result = await runner.run(example.code);
      break;
    } catch (error) {
      if (!(error instanceof ProviderUnavailableError) || error.executionState !== "not-started" || attempt === 3) {
        throw error;
      }
    }
  }
  if (result === undefined) throw new Error(`${language.label}: no result`);
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.exitCode !== 0 || !output.includes(example.expected)) {
    throw new Error(`${language.label}: ${JSON.stringify(result)}`);
  }
  console.log(JSON.stringify({ language: language.id, provider: result.provider, status: "ok" }));
}
