import { createRunnerRegistry } from "../src/runner-composition";
import { LANGUAGE_EXAMPLES } from "../src/language-examples";
import { SUPPORTED_LANGUAGES } from "../src/supported-languages";
import { enhanceRunnableCodeBlocks } from "../src/web-adapter";

const languageList = document.querySelector<HTMLElement>("[data-supported-languages]");
const languageCount = document.querySelector<HTMLElement>("[data-supported-language-count]");
if (languageCount !== null) languageCount.textContent = String(SUPPORTED_LANGUAGES.length);
if (languageList !== null) {
  for (const language of SUPPORTED_LANGUAGES) {
    const item = document.createElement("li");
    item.className = "rcb-site__language";

    const identity = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = language.label;
    const fence = document.createElement("code");
    fence.textContent = language.fence;
    identity.append(name, fence);

    const environments = document.createElement("span");
    environments.textContent = `Obsidian · ${language.obsidian} / Web · ${language.browser}`;
    item.append(identity, environments);
    languageList.append(item);
  }
}

const testCases = document.querySelector<HTMLElement>("[data-language-test-cases]");
if (testCases !== null) {
  for (const example of LANGUAGE_EXAMPLES) {
    const language = SUPPORTED_LANGUAGES.find(({ id }) => id === example.language);
    if (language === undefined) continue;
    const section = document.createElement("section");
    section.className = "rcb-site__lesson";
    const title = document.createElement("h2");
    title.textContent = `${language.label} · ${language.browser}`;
    const description = document.createElement("p");
    description.append("Expected · ");
    const expected = document.createElement("code");
    expected.textContent = example.expected;
    description.append(expected);
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.className = `language-${language.fence}`;
    code.textContent = example.code;
    pre.append(code);
    section.append(title, description, pre);
    testCases.append(section);
  }
}

const registry = createRunnerRegistry({ executionOrder: "remote-first", remoteExecutionEnabled: true });

enhanceRunnableCodeBlocks(document, registry);
