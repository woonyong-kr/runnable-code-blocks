import type { RunnableBlockSpec, RunResult } from "./contracts";
import {
  createRunnableEditor,
  EDITOR_TRAILING_BLANK_LINE_COUNT,
  type RunnableEditor
} from "./editor";

export interface MountedRunnableBlock {
  dispose(): void;
}

function element<K extends keyof HTMLElementTagNameMap>(
  parent: Node,
  name: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] {
  return parent.createEl(name, { cls: className, text });
}

function svgIcon(parent: Node, pathData: string, className: string): SVGSVGElement {
  const icon = parent.createSvg("svg");
  icon.setAttribute("viewBox", "0 0 20 20");
  icon.setAttribute("aria-hidden", "true");
  icon.classList.add(className);
  const path = icon.createSvg("path");
  path.setAttribute("d", pathData);
  return icon;
}

function durationLabel(durationMs: number): string {
  if (durationMs >= 1000) return `${(durationMs / 1000).toFixed(2)} s`;
  return `${String(Math.round(durationMs))} ms`;
}

function environmentLabel(environment: RunnableBlockSpec["runner"]["environment"]): string {
  if (environment === "remote") return "Remote";
  return "Browser";
}

function resultText(result: RunResult): string {
  const parts: string[] = [];
  if (result.stdout) parts.push(result.stdout.trimEnd());
  if (result.stderr) parts.push(result.stderr.trimEnd());
  return parts.join("\n");
}

function withTrailingBlankLines(code: string, count = EDITOR_TRAILING_BLANK_LINE_COUNT): string {
  const trailingNewlines = code.match(/\n*$/u)?.[0].length ?? 0;
  return trailingNewlines >= count ? code : code + "\n".repeat(count - trailingNewlines);
}

function withoutTrailingDisplayLines(code: string): string {
  return code.replace(/\n+$/u, "");
}

export function mountRunnableBlock(host: HTMLElement, spec: RunnableBlockSpec): MountedRunnableBlock {
  const editorInitialCode = withTrailingBlankLines(spec.code);
  host.replaceChildren();
  const root = element(host, "section", "rcb");
  root.dataset.language = spec.language;
  root.dataset.environment = spec.runner.environment;

  const toolbar = element(root, "header", "rcb__toolbar");
  const identity = element(toolbar, "div", "rcb__identity");
  const languageIcon = element(identity, "span", "rcb__file-icon");
  svgIcon(languageIcon, "M7.25 5 3 10l4.25 5M12.75 5 17 10l-4.25 5", "rcb__icon");
  element(identity, "strong", "rcb__language", spec.language);
  const environment = element(identity, "span", "rcb__environment");
  element(environment, "span", "rcb__environment-dot");
  const environmentName = element(environment, "span", "rcb__environment-name");
  environmentName.textContent = environmentLabel(spec.runner.environment);

  const actions = element(toolbar, "div", "rcb__actions");
  const status = element(actions, "span", "rcb__status", "Checking");
  const resetButton = element(actions, "button", "rcb__button rcb__button--secondary", "Reset");
  resetButton.type = "button";
  resetButton.hidden = true;
  const runButton = element(actions, "button", "rcb__button rcb__button--run");
  runButton.type = "button";
  runButton.title = "Run (⌘/Ctrl+Enter)";
  runButton.setAttribute("aria-label", "Run code");
  svgIcon(runButton, "M6.5 4.75v10.5L15 10 6.5 4.75Z", "rcb__button-icon");
  element(runButton, "span", "rcb__button-label", "Run");

  const editorHost = element(root, "div", "rcb__editor");
  const notice = element(root, "div", "rcb__notice");
  notice.hidden = true;
  const consolePanel = element(root, "section", "rcb__console");
  consolePanel.hidden = true;
  const consoleHeader = element(consolePanel, "header", "rcb__console-header");
  const consoleTitle = element(consoleHeader, "span", "rcb__console-title", "Output");
  const output = element(consolePanel, "pre", "rcb__output", "");
  output.setAttribute("aria-live", "polite");
  const preview = element(consolePanel, "div", "rcb__preview");
  preview.hidden = true;

  const lifecycle = { disposed: false };
  let running = false;
  let available = false;
  let availabilityDetail = "";
  let disposePreview: () => void = () => undefined;

  const setDirty = (dirty: boolean) => {
    resetButton.hidden = !dirty;
    root.dataset.dirty = dirty ? "true" : "false";
  };

  const run = async () => {
    if (lifecycle.disposed || running || !available) return;
    running = true;
    runButton.disabled = true;
    root.dataset.state = "running";
    status.textContent = "Running";
    status.title = availabilityDetail;
    consolePanel.hidden = false;
    consoleTitle.textContent = "Output";
    output.textContent = "";
    disposePreview();
    preview.replaceChildren();
    preview.hidden = true;
    try {
      const result = await spec.runner.run(withoutTrailingDisplayLines(editor.getValue()));
      if (lifecycle.disposed) return;
      const resultEnvironment = result.environment ?? spec.runner.environment;
      root.dataset.environment = resultEnvironment;
      environmentName.textContent = environmentLabel(resultEnvironment);
      root.dataset.state = result.exitCode === 0 ? "success" : "error";
      status.textContent = result.exitCode === 0 ? durationLabel(result.durationMs) : "Failed";
      status.title = result.provider ?? availabilityDetail;
      consoleTitle.textContent = result.provider ? `Output · ${result.provider}` : "Output";
      output.textContent = resultText(result) || "Process finished with no output.";
      if (result.preview !== undefined) disposePreview = renderPreview(preview, result.preview);
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
    editorInitialCode,
    spec.language,
    () => void run(),
    (value) => setDirty(value !== editorInitialCode)
  );
  runButton.addEventListener("click", () => { void run(); });
  resetButton.addEventListener("click", () => {
    if (running) return;
    editor.setValue(editorInitialCode);
    root.dataset.environment = spec.runner.environment;
    environmentName.textContent = environmentLabel(spec.runner.environment);
    root.dataset.state = "idle";
    status.textContent = available ? "Ready" : "Unavailable";
    status.title = availabilityDetail;
    output.textContent = "";
    disposePreview();
    disposePreview = () => undefined;
    preview.replaceChildren();
    preview.hidden = true;
    consoleTitle.textContent = "Output";
    consolePanel.hidden = true;
    setDirty(false);
    editor.focus();
  });

  void spec.runner.availability()
    .then((runnerStatus) => {
      if (lifecycle.disposed) return;
      available = runnerStatus.available;
      availabilityDetail = runnerStatus.detail;
      runButton.disabled = !available;
      root.dataset.state = available ? "idle" : "unavailable";
      status.textContent = available ? "Ready" : "Unavailable";
      status.title = runnerStatus.detail;
      notice.hidden = available;
      notice.textContent = available ? "" : runnerStatus.detail;
    })
    .catch((error: unknown) => {
      if (lifecycle.disposed) return;
      available = false;
      availabilityDetail = error instanceof Error ? error.message : String(error);
      runButton.disabled = true;
      root.dataset.state = "unavailable";
      status.textContent = "Unavailable";
      status.title = availabilityDetail;
      notice.hidden = false;
      notice.textContent = availabilityDetail;
    });

  return {
    dispose: () => {
      lifecycle.disposed = true;
      disposePreview();
      editor.destroy();
      spec.runner.dispose?.();
      root.remove();
    }
  };
}

function renderPreview(host: HTMLElement, preview: NonNullable<RunResult["preview"]>): () => void {
  host.replaceChildren();
  const frame = host.createEl("iframe");
  frame.className = "rcb__preview-frame";
  frame.setAttribute("sandbox", "");
  frame.setAttribute("title", "Code preview");
  frame.srcdoc = preview.html;
  host.hidden = false;
  return () => undefined;
}
