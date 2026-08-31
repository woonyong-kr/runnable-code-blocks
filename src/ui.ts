import type { RunnableBlockSpec, RunResult } from "./contracts";
import { createRunnableEditor, type RunnableEditor } from "./editor";

export interface MountedRunnableBlock {
  dispose(): void;
}

function element<K extends keyof HTMLElementTagNameMap>(
  name: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(name);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function resultText(result: RunResult): string {
  const parts: string[] = [];
  if (result.stdout) parts.push(result.stdout.trimEnd());
  if (result.stderr) parts.push(result.stderr.trimEnd());
  return parts.join("\n");
}

export function mountRunnableBlock(host: HTMLElement, spec: RunnableBlockSpec): MountedRunnableBlock {
  const root = element("section", "rcb");
  root.dataset.language = spec.language;
  root.dataset.environment = spec.runner.environment;

  const toolbar = element("header", "rcb__toolbar");
  const identity = element("div", "rcb__identity");
  identity.append(
    element("span", "rcb__file-icon", "<>"),
    element("strong", "rcb__language", spec.language),
    element("span", "rcb__environment", spec.runner.environment)
  );

  const actions = element("div", "rcb__actions");
  const resetButton = element("button", "rcb__button rcb__button--secondary", "Reset");
  resetButton.type = "button";
  const runButton = element("button", "rcb__button rcb__button--run", "▶ Run");
  runButton.type = "button";
  actions.append(resetButton, runButton);
  toolbar.append(identity, actions);

  const editorHost = element("div", "rcb__editor");
  const consolePanel = element("section", "rcb__console");
  const consoleHeader = element("header", "rcb__console-header");
  const consoleTitle = element("span", "rcb__console-title", "Console");
  const status = element("span", "rcb__status", "Checking runner…");
  consoleHeader.append(consoleTitle, status);
  const output = element("pre", "rcb__output", "");
  output.setAttribute("aria-live", "polite");
  consolePanel.append(consoleHeader, output);
  root.append(toolbar, editorHost, consolePanel);
  host.replaceChildren(root);

  const lifecycle = { disposed: false };
  let running = false;
  let available = false;

  const run = async () => {
    if (lifecycle.disposed || running || !available) return;
    running = true;
    runButton.disabled = true;
    root.dataset.state = "running";
    status.textContent = "Running…";
    output.textContent = "";
    try {
      const result = await spec.runner.run(editor.getValue());
      if (lifecycle.disposed) return;
      root.dataset.state = result.exitCode === 0 ? "success" : "error";
      status.textContent = `${result.exitCode === 0 ? "Finished" : "Failed"} · ${String(Math.round(result.durationMs))} ms`;
      output.textContent = resultText(result) || "Process finished with no output.";
    } catch (error) {
      if (lifecycle.disposed) return;
      root.dataset.state = "error";
      status.textContent = "Runner error";
      output.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      running = false;
      if (!lifecycle.disposed) runButton.disabled = !available;
    }
  };

  const editor: RunnableEditor = createRunnableEditor(
    editorHost,
    spec.code,
    spec.language,
    () => void run()
  );
  runButton.addEventListener("click", run);
  resetButton.addEventListener("click", () => {
    if (running) return;
    editor.setValue(spec.code);
    root.dataset.state = "idle";
    status.textContent = "Reset to Markdown source";
    output.textContent = "";
    editor.focus();
  });

  void spec.runner.availability().then((runnerStatus) => {
    if (lifecycle.disposed) return;
    available = runnerStatus.available;
    runButton.disabled = !available;
    root.dataset.state = available ? "idle" : "unavailable";
    status.textContent = runnerStatus.detail;
    if (!available) output.textContent = runnerStatus.detail;
  });

  return {
    dispose: () => {
      lifecycle.disposed = true;
      editor.destroy();
      spec.runner.dispose?.();
      root.remove();
    }
  };
}
