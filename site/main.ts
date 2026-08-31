import { createRunnerRegistry } from "../src/runner-composition";
import { LANGUAGE_EXAMPLES } from "../src/language-examples";
import type { FetchLike } from "../src/runners/http-client";
import { SUPPORTED_LANGUAGES } from "../src/supported-languages";
import { enhanceRunnableCodeBlocks } from "../src/web-adapter";

declare global {
  interface Window {
    rcbFetch: FetchLike;
  }
}

const languageList = document.querySelector<HTMLElement>("[data-supported-languages]");
const languageCount = document.querySelector<HTMLElement>("[data-supported-language-count]");
if (languageCount !== null) languageCount.textContent = String(SUPPORTED_LANGUAGES.length);
if (languageList !== null) {
  for (const language of SUPPORTED_LANGUAGES) {
    const item = languageList.createEl("li");
    item.className = "rcb-site__language";

    const identity = item.createDiv();
    const name = identity.createEl("strong");
    name.textContent = language.label;
    const fence = identity.createEl("code");
    fence.textContent = language.fence;

    const environments = item.createSpan();
    environments.textContent = `Obsidian · ${language.obsidian} / Web · ${language.browser}`;
  }
}

const testCases = document.querySelector<HTMLElement>("[data-language-test-cases]");
if (testCases !== null) {
  for (const example of LANGUAGE_EXAMPLES) {
    const language = SUPPORTED_LANGUAGES.find(({ id }) => id === example.language);
    if (language === undefined) continue;
    const section = testCases.createEl("section");
    section.className = "rcb-site__lesson";
    const title = section.createEl("h2");
    title.textContent = `${language.label} · ${language.browser}`;
    const description = section.createEl("p");
    description.append("Expected · ");
    const expected = description.createEl("code");
    expected.textContent = example.expected;
    const pre = section.createEl("pre");
    const code = pre.createEl("code");
    code.className = `language-${language.fence}`;
    code.textContent = example.code;
  }
}

const registry = createRunnerRegistry({
  executionOrder: "remote-first",
  fetch: window.rcbFetch,
  remoteExecutionEnabled: true
});

enhanceRunnableCodeBlocks(document, registry);
