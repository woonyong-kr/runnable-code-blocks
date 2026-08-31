import type { CodeRunner, RunResult } from "../contracts";

export class BrowserPreviewRunner implements CodeRunner {
  readonly environment = "browser" as const;
  readonly language: "css" | "html";

  constructor(language: "css" | "html") {
    this.language = language;
  }

  async availability() {
    return typeof document === "undefined"
      ? { available: false, detail: "Preview에는 DOM이 필요합니다." }
      : { available: true, detail: "sandboxed iframe에서 렌더링하며 top navigation과 same-origin 접근을 허용하지 않습니다." };
  }

  async run(code: string): Promise<RunResult> {
    const html = this.language === "html"
      ? secureHtml(code)
      : `<!doctype html><html><head>${CSP}<style>${escapeClosingStyle(code)}</style></head><body><main class="preview">CSS preview</main></body></html>`;
    return {
      durationMs: 0,
      environment: "browser",
      exitCode: 0,
      provider: "Sandboxed browser preview",
      preview: { html, kind: "html" },
      stderr: "",
      stdout: "Preview rendered."
    };
  }
}

const CSP = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\';">';

function secureHtml(html: string): string {
  if (/<head(?:\s|>)/iu.test(html)) return html.replace(/<head([^>]*)>/iu, `<head$1>${CSP}`);
  return `<!doctype html><html><head>${CSP}</head><body>${html}</body></html>`;
}

function escapeClosingStyle(css: string): string {
  return css.replace(/<\/style/giu, "<\\/style");
}
