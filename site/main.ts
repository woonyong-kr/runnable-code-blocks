import { RunnerRegistry, UnavailableRunner } from "../src/runner-registry";
import { BrowserJavaScriptRunner } from "../src/runners/javascript-runner";
import { enhanceRunnableCodeBlocks } from "../src/web-adapter";

const registry = new RunnerRegistry()
  .register("javascript", () => new BrowserJavaScriptRunner())
  .register(
    "kotlin",
    () =>
      new UnavailableRunner(
        "kotlin",
        "browser",
        "Kotlin execution is local-only in this serverless build. Open this Markdown block in Obsidian Desktop to run it with kotlinc."
      )
  );

enhanceRunnableCodeBlocks(document, registry);

