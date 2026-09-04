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
  icon.classList.add(...className.split(/\s+/u).filter(Boolean));
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
  const status = element(actions, "span", "rcb__status rcb__sr-only", "Checking runner availability");
  status.setAttribute("aria-live", "polite");
  const resetButton = element(actions, "button", "rcb__button rcb__button--secondary", "Reset");
  resetButton.type = "button";
  resetButton.hidden = true;
  const runButton = element(actions, "button", "rcb__button rcb__button--run");
  runButton.type = "button";
  runButton.title = "Run (⌘/Ctrl+Enter)";
  runButton.setAttribute("aria-label", "Run code");
  const runIcon = svgIcon(runButton, "M6.5 4.75v10.5L15 10 6.5 4.75Z", "rcb__button-icon rcb__button-icon--run");
  const runningIcon = svgIcon(runButton, "M10 3.25a6.75 6.75 0 1 1-5.4 2.7", "rcb__button-icon rcb__button-icon--running");
  runningIcon.setAttribute("hidden", "");
  const runLabel = element(runButton, "span", "rcb__button-label", "Run");

  const editorHost = element(root, "div", "rcb__editor");
  const notice = element(root, "div", "rcb__notice");
  notice.hidden = true;
  const consolePanel = element(root, "section", "rcb__console");
  consolePanel.hidden = true;
  const consoleHeader = element(consolePanel, "header", "rcb__console-header");
  const consoleTitle = element(consoleHeader, "span", "rcb__console-title", "Output");
  const consoleMeta = element(consoleHeader, "span", "rcb__console-meta", "");
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

  const setRunning = (value: boolean) => {
    runButton.disabled = value || !available;
    resetButton.disabled = value;
    runButton.setAttribute("aria-busy", value ? "true" : "false");
    root.setAttribute("aria-busy", value ? "true" : "false");
    runIcon.toggleAttribute("hidden", value);
    runningIcon.toggleAttribute("hidden", !value);
    runLabel.textContent = value ? "Running…" : "Run";
  };

  const run = async () => {
    if (lifecycle.disposed || running || !available) return;
    running = true;
    setRunning(true);
    root.dataset.state = "running";
    status.textContent = "Running code";
    status.title = availabilityDetail;
    consolePanel.hidden = false;
    consoleTitle.textContent = "Output";
    consoleMeta.textContent = "Running…";
    consoleMeta.title = availabilityDetail;
    output.hidden = false;
    output.textContent = "Waiting for result…";
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
      const outcome = result.exitCode === 0 ? "Success" : "Failed";
      const duration = durationLabel(result.durationMs);
      status.textContent = `${outcome} in ${duration}`;
      status.title = result.provider ?? availabilityDetail;
      consoleMeta.textContent = `${outcome} · ${duration}${result.provider ? ` · ${result.provider}` : ""}`;
      consoleMeta.title = result.provider ?? "";
      const text = resultText(result);
      output.hidden = result.preview !== undefined && text === "";
      output.textContent = text || (result.preview === undefined ? "Process finished with no output." : "");
      if (result.preview !== undefined) {
        const previewLogs: string[] = [];
        disposePreview = renderPreview(preview, result.preview, ({ message, type }) => {
          if (lifecycle.disposed) return;
          if (type === "ready") return;
          previewLogs.push(message);
          output.hidden = false;
          output.textContent = previewLogs.join("\n");
          if (type === "error") {
            root.dataset.state = "error";
            status.textContent = "Interactive preview reported an error";
            consoleMeta.textContent = "Runtime error · interactive browser sandbox";
          }
        });
      }
    } catch (error) {
      if (lifecycle.disposed) return;
      root.dataset.state = "error";
      status.textContent = "Runner error";
      consoleMeta.textContent = "Runner error";
      output.hidden = false;
      output.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      running = false;
      if (!lifecycle.disposed) setRunning(false);
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
    status.textContent = available ? "Ready to run" : "Runner unavailable";
    status.title = availabilityDetail;
    output.textContent = "";
    output.hidden = false;
    disposePreview();
    disposePreview = () => undefined;
    preview.replaceChildren();
    preview.hidden = true;
    consoleTitle.textContent = "Output";
    consoleMeta.textContent = "";
    consoleMeta.title = "";
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
      status.textContent = available ? "Ready to run" : "Runner unavailable";
      status.title = runnerStatus.detail;
      environment.title = runnerStatus.detail;
      notice.hidden = available;
      notice.textContent = available ? "" : runnerStatus.detail;
    })
    .catch((error: unknown) => {
      if (lifecycle.disposed) return;
      available = false;
      availabilityDetail = error instanceof Error ? error.message : String(error);
      runButton.disabled = true;
      root.dataset.state = "unavailable";
      status.textContent = "Runner unavailable";
      status.title = availabilityDetail;
      environment.title = availabilityDetail;
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

interface PreviewMessage {
  message: string;
  type: "error" | "info" | "log" | "ready" | "warn";
}

function renderPreview(
  host: HTMLElement,
  preview: NonNullable<RunResult["preview"]>,
  onMessage: (message: PreviewMessage) => void
): () => void {
  host.replaceChildren();
  const frame = host.createEl("iframe");
  frame.className = "rcb__preview-frame";
  frame.dataset.scripts = preview.scripts;
  frame.setAttribute("sandbox", preview.scripts === "isolated" ? "allow-scripts" : "");
  frame.setAttribute("title", preview.scripts === "isolated" ? "Interactive code preview" : "Code preview");
  const receiveMessage = (event: MessageEvent<unknown>) => {
    if (event.source !== frame.contentWindow || event.origin !== "null") return;
    if (typeof event.data !== "object" || event.data === null) return;
    const data = event.data as Record<string, unknown>;
    if (data.sender !== "runnable-code-blocks-preview") return;
    if (typeof data.message !== "string" || !isPreviewMessageType(data.type)) return;
    onMessage({ message: data.message, type: data.type });
  };
  window.addEventListener("message", receiveMessage);
  frame.srcdoc = preview.html;
  host.hidden = false;
  return () => {
    window.removeEventListener("message", receiveMessage);
    frame.remove();
  };
}

function isPreviewMessageType(value: unknown): value is PreviewMessage["type"] {
  return value === "error" || value === "info" || value === "log" || value === "ready" || value === "warn";
}
