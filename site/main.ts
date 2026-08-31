import { RunnerRegistry, UnavailableRunner } from "../src/runner-registry";
import { BrowserJavaScriptRunner } from "../src/runners/javascript-runner";
import { SUPPORTED_LANGUAGES } from "../src/supported-languages";
import { enhanceRunnableCodeBlocks } from "../src/web-adapter";

const languageList = document.querySelector<HTMLElement>("[data-supported-languages]");
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

const registry = new RunnerRegistry();
for (const language of SUPPORTED_LANGUAGES) {
  registry.register(language.id, () =>
    language.id === "javascript"
      ? new BrowserJavaScriptRunner()
      : new UnavailableRunner(
          language.id,
          "browser",
          "Kotlin execution is local-only in this serverless build. Open this Markdown block in Obsidian Desktop to run it with kotlinc."
        )
  );
}

enhanceRunnableCodeBlocks(document, registry);
