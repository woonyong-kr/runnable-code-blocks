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
  name: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(name);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgIcon(pathData: string, className: string): SVGSVGElement {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 20 20");
  icon.setAttribute("aria-hidden", "true");
  icon.classList.add(className);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathData);
  icon.append(path);
  return icon;
}

function durationLabel(durationMs: number): string {
  if (durationMs >= 1000) return `${(durationMs / 1000).toFixed(2)} s`;
  return `${String(Math.round(durationMs))} ms`;
}

function environmentLabel(environment: RunnableBlockSpec["runner"]["environment"]): string {
  if (environment === "local") return "Device";
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
  const root = element("section", "rcb");
  root.dataset.language = spec.language;
  root.dataset.environment = spec.runner.environment;

  const toolbar = element("header", "rcb__toolbar");
  const identity = element("div", "rcb__identity");
  const languageIcon = element("span", "rcb__file-icon");
  languageIcon.append(svgIcon("M7.25 5 3 10l4.25 5M12.75 5 17 10l-4.25 5", "rcb__icon"));
  const environment = element("span", "rcb__environment");
  const environmentName = element("span", "rcb__environment-name");
  environmentName.textContent = environmentLabel(spec.runner.environment);
  environment.append(
    element("span", "rcb__environment-dot"),
    environmentName
  );
  identity.append(
    languageIcon,
    element("strong", "rcb__language", spec.language),
    environment
  );

  const actions = element("div", "rcb__actions");
  const status = element("span", "rcb__status", "Checking");
  const resetButton = element("button", "rcb__button rcb__button--secondary", "Reset");
  resetButton.type = "button";
  resetButton.hidden = true;
  const runButton = element("button", "rcb__button rcb__button--run");
  runButton.type = "button";
  runButton.title = "Run (⌘/Ctrl+Enter)";
  runButton.setAttribute("aria-label", "Run code");
  runButton.append(
    svgIcon("M6.5 4.75v10.5L15 10 6.5 4.75Z", "rcb__button-icon"),
    element("span", "rcb__button-label", "Run")
  );
  actions.append(status, resetButton, runButton);
  toolbar.append(identity, actions);

  const editorHost = element("div", "rcb__editor");
  const notice = element("div", "rcb__notice");
  notice.hidden = true;
  const consolePanel = element("section", "rcb__console");
  consolePanel.hidden = true;
  const consoleHeader = element("header", "rcb__console-header");
  const consoleTitle = element("span", "rcb__console-title", "Output");
  consoleHeader.append(consoleTitle);
  const output = element("pre", "rcb__output", "");
  output.setAttribute("aria-live", "polite");
  const preview = element("div", "rcb__preview");
  preview.hidden = true;
  consolePanel.append(consoleHeader, output, preview);
  root.append(toolbar, editorHost, notice, consolePanel);
  host.replaceChildren(root);

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
    consolePanel.hidden = false;
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
  runButton.addEventListener("click", run);
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

  void spec.runner.availability().then((runnerStatus) => {
    if (lifecycle.disposed) return;
    available = runnerStatus.available;
    availabilityDetail = runnerStatus.detail;
    runButton.disabled = !available;
    root.dataset.state = available ? "idle" : "unavailable";
    status.textContent = available ? "Ready" : "Unavailable";
    status.title = runnerStatus.detail;
    notice.hidden = available;
    notice.textContent = available ? "" : runnerStatus.detail;
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
  const frame = document.createElement("iframe");
  frame.className = "rcb__preview-frame";
  frame.setAttribute("sandbox", preview.kind === "html"
    ? "allow-scripts"
    : "allow-scripts allow-forms allow-modals allow-popups allow-downloads");
  frame.setAttribute("title", preview.kind === "html" ? "Code preview" : "Remote code runner");
  if (preview.html !== undefined) frame.srcdoc = preview.html;
  if (preview.src !== undefined) frame.src = preview.src;
  if (preview.postMessage !== undefined) {
    const inject = () => frame.contentWindow?.postMessage(preview.postMessage, "*");
    frame.addEventListener("load", inject);
    const onMessage = (event: MessageEvent) => {
      if (event.source === frame.contentWindow && isReadyMessage(event.data)) inject();
    };
    window.addEventListener("message", onMessage);
    host.replaceChildren(frame);
    host.hidden = false;
    return () => {
      frame.removeEventListener("load", inject);
      window.removeEventListener("message", onMessage);
    };
  }
  host.replaceChildren(frame);
  host.hidden = false;
  return () => undefined;
}

function isReadyMessage(value: unknown): boolean {
  return typeof value === "object" && value !== null && "type" in value
    && (value as { type?: unknown }).type === "ready";
}
