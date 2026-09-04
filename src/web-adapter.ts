import { parseRunnableFence } from "./contracts";
import { RunnerRegistry, UnavailableRunner } from "./runner-registry";
import { mountRunnableBlock, type MountedRunnableBlock } from "./ui";
import { appendElement } from "./dom";

function fenceFromCodeElement(code: HTMLElement): string | null {
  for (const className of code.classList) {
    if (className.startsWith("language-")) return className.slice("language-".length);
  }
  return null;
}

export function enhanceRunnableCodeBlocks(
  root: ParentNode,
  registry: RunnerRegistry
): MountedRunnableBlock[] {
  const mounted: MountedRunnableBlock[] = [];
  for (const code of root.querySelectorAll<HTMLElement>("pre > code")) {
    const fence = fenceFromCodeElement(code);
    const language = fence === null ? null : parseRunnableFence(fence);
    if (language === null) continue;
    const pre = code.parentElement;
    if (pre === null) continue;
    const parent = pre.parentElement;
    if (parent === null) continue;
    const host = appendElement(parent, "div");
    pre.replaceWith(host);
    const runner =
      registry.create(language) ??
      new UnavailableRunner(
        language,
        "browser",
        `${language} has no browser runner in this build.`
      );
    mounted.push(mountRunnableBlock(host, { code: code.textContent, language, runner }));
  }
  return mounted;
}
