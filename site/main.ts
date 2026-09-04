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
    environments.textContent = language.browser;
  }
}

const featuredTestCase = document.querySelector<HTMLElement>("[data-featured-test-case]");
const featuredExample = LANGUAGE_EXAMPLES.find(({ language }) => language === "react");
if (featuredTestCase !== null && featuredExample !== undefined) {
  appendExample(featuredTestCase, {
    ...featuredExample,
    code: `import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState<number>(0);
  return (
    <button
      onClick={() => setCount((value) => value + 1)}
      style={{
        padding: "10px 16px",
        border: 0,
        borderRadius: 8,
        background: "#3574f0",
        color: "white",
        font: "inherit",
        fontWeight: 700,
        cursor: "pointer"
      }}
    >
      Clicked {count} times
    </button>
  );
}`,
    expected: "A working React counter"
  }, true);
}

const testCases = document.querySelector<HTMLElement>("[data-language-test-cases]");
if (testCases !== null) {
  for (const example of LANGUAGE_EXAMPLES) {
    appendExample(testCases, example, false);
  }
}

const registry = createRunnerRegistry({
  executionOrder: "remote-first",
  fetch: window.rcbFetch,
  remoteExecutionEnabled: true
});

if (featuredTestCase !== null) enhanceRunnableCodeBlocks(featuredTestCase, registry);

const allExamples = document.querySelector<HTMLDetailsElement>(".rcb-site__all-examples");
let mountedAllExamples = false;
allExamples?.addEventListener("toggle", () => {
  if (!allExamples.open || mountedAllExamples || testCases === null) return;
  mountedAllExamples = true;
  enhanceRunnableCodeBlocks(testCases, registry);
});

function appendExample(
  parent: HTMLElement,
  example: (typeof LANGUAGE_EXAMPLES)[number],
  featured: boolean
): void {
  const language = SUPPORTED_LANGUAGES.find(({ id }) => id === example.language);
  if (language === undefined) return;
  const section = parent.createEl("section");
  section.className = featured ? "rcb-site__lesson rcb-site__lesson--featured" : "rcb-site__lesson";
  if (!featured) {
    const title = section.createEl("h2");
    title.textContent = `${language.label} · ${language.browser}`;
    const description = section.createEl("p");
    description.append("Expected · ");
    const expected = description.createEl("code");
    expected.textContent = example.expected;
  }
  const pre = section.createEl("pre");
  const code = pre.createEl("code");
  code.className = `language-${language.fence}`;
  code.textContent = example.code;
}
