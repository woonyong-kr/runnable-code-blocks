import { getVersion, transform } from "sucrase";
import type { CodeRunner, RunResult } from "../contracts";

type PreviewLanguage = "css" | "html" | "web" | "web-ts";

const STATIC_CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "connect-src 'none'",
  "font-src data:",
  "form-action 'none'",
  "img-src data: blob:",
  "media-src data: blob:",
  "object-src 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline'"
].join("; ");

const INTERACTIVE_CSP = STATIC_CSP.replace("script-src 'none'", "script-src 'unsafe-inline'");

const CSS_SPECIMEN = String.raw`
<style>
  :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, sans-serif; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px; background: #f5f6f8; color: #202124; }
  .preview { display: grid; min-height: 220px; place-items: center; }
  .preview-card { width: min(100%, 360px); padding: 24px; border: 1px solid #d9dce1; border-radius: 12px; background: #fff; box-shadow: 0 12px 32px rgb(31 35 40 / 10%); }
  .preview-eyebrow { color: #59616b; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .preview-title { margin: 8px 0 6px; font-size: 22px; }
  .preview-copy { margin: 0 0 20px; color: #59616b; line-height: 1.55; }
  .preview-button { border: 1px solid #c7cbd1; border-radius: 8px; padding: 9px 14px; background: #fff; color: #202124; font: inherit; font-weight: 700; }
  @media (prefers-color-scheme: dark) {
    body { background: #1e1f22; color: #dfe1e5; }
    .preview-card { border-color: #43454a; background: #2b2d30; box-shadow: 0 12px 32px rgb(0 0 0 / 28%); }
    .preview-eyebrow, .preview-copy { color: #a8adb5; }
    .preview-button { border-color: #4c4f55; background: #393b40; color: #dfe1e5; }
  }
</style>
<main class="preview">
  <article class="preview-card">
    <span class="preview-eyebrow">CSS playground</span>
    <h1 class="preview-title">Style a real component</h1>
    <p class="preview-copy">Your CSS is applied after this neutral specimen.</p>
    <button class="preview-button" type="button">Continue</button>
  </article>
</main>`;

const INTERACTIVE_BASE_STYLE = String.raw`<style>
  :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, sans-serif; }
  body { margin: 0; padding: 24px; }
</style>`;

const CONSOLE_BRIDGE = String.raw`${INTERACTIVE_BASE_STYLE}<script>
(() => {
  const format = (value) => {
    if (typeof value === "string") return value;
    if (typeof value === "undefined") return "undefined";
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
  };
  const send = (type, message) => parent.postMessage({ sender: "runnable-code-blocks-preview", type, message }, "*");
  for (const level of ["log", "info", "warn", "error"]) {
    const original = console[level].bind(console);
    console[level] = (...values) => {
      send(level, values.map(format).join(" "));
      original(...values);
    };
  }
  window.addEventListener("error", (event) => send("error", event.error?.stack || event.message));
  window.addEventListener("unhandledrejection", (event) => send("error", format(event.reason)));
  window.addEventListener("DOMContentLoaded", () => send("ready", "Preview ready"), { once: true });
})();
</script>`;

export class BrowserPreviewRunner implements CodeRunner {
  readonly environment = "browser" as const;
  readonly language: PreviewLanguage;

  constructor(language: PreviewLanguage) {
    this.language = language;
  }

  async availability() {
    if (typeof document === "undefined") {
      return { available: false, detail: "Preview에는 DOM이 필요합니다." };
    }
    return this.language === "web" || this.language === "web-ts"
      ? {
          available: true,
          detail: "JavaScript는 fetch/XHR/WebSocket, 외부 리소스, 팝업, form 제출, top navigation 및 same-origin 접근이 차단된 iframe에서 실행됩니다."
        }
      : {
          available: true,
          detail: "script, network, top navigation 및 same-origin 접근이 차단된 iframe에서 렌더링합니다."
        };
  }

  async run(code: string): Promise<RunResult> {
    if (this.language === "web") {
      return previewResult(
        secureDocument(code, INTERACTIVE_CSP, CONSOLE_BRIDGE),
        "isolated",
        "Interactive browser sandbox"
      );
    }
    if (this.language === "web-ts") {
      const started = performance.now();
      const provider = `Sucrase ${getVersion()} → interactive browser sandbox`;
      try {
        const html = transpileTypeScriptScripts(code);
        return {
          ...previewResult(secureDocument(html, INTERACTIVE_CSP, CONSOLE_BRIDGE), "isolated", provider),
          durationMs: performance.now() - started
        };
      } catch (error) {
        return {
          durationMs: performance.now() - started,
          environment: "browser",
          exitCode: 1,
          provider,
          stderr: error instanceof Error ? error.message : String(error),
          stdout: ""
        };
      }
    }
    if (this.language === "css") {
      const html = `${CSS_SPECIMEN}<style>${escapeClosingStyle(code)}</style>`;
      return previewResult(secureDocument(html, STATIC_CSP), "blocked", "Sandboxed CSS preview");
    }
    return previewResult(secureDocument(code, STATIC_CSP), "blocked", "Sandboxed HTML preview");
  }
}

function previewResult(
  html: string,
  scripts: NonNullable<RunResult["preview"]>["scripts"],
  provider: string
): RunResult {
  return {
    durationMs: 0,
    environment: "browser",
    exitCode: 0,
    provider,
    preview: { html, kind: "html", scripts },
    stderr: "",
    stdout: ""
  };
}

function secureDocument(html: string, policy: string, prefix = ""): string {
  const security = `<meta http-equiv="Content-Security-Policy" content="${policy}">${prefix}`;
  if (/<head(?:\s|>)/iu.test(html)) return html.replace(/<head([^>]*)>/iu, `<head$1>${security}`);
  return `<!doctype html><html><head>${security}</head><body>${html}</body></html>`;
}

function transpileTypeScriptScripts(html: string): string {
  const document_ = new DOMParser().parseFromString(html, "text/html");
  const scripts = document_.querySelectorAll<HTMLScriptElement>('script[type="text/typescript"]');
  for (const script of scripts) {
    script.textContent = transform(script.textContent, {
      disableESTransforms: true,
      production: true,
      transforms: ["typescript"]
    }).code;
    script.type = "text/javascript";
  }
  if (scripts.length === 0) {
    throw new Error('run-web-ts requires at least one <script type="text/typescript"> block.');
  }
  return `<!doctype html>${document_.documentElement.outerHTML}`;
}

function escapeClosingStyle(css: string): string {
  return css.replace(/<\/style/giu, "<\\/style");
}
