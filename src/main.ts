import { MarkdownRenderChild, Plugin } from "obsidian";
import { fenceForLanguage } from "./contracts";
import { RunnerRegistry } from "./runner-registry";
import { BrowserJavaScriptRunner } from "./runners/javascript-runner";
import { LocalKotlinRunner } from "./runners/kotlin-runner";
import { SUPPORTED_LANGUAGES } from "./supported-languages";
import {
  DEFAULT_SETTINGS,
  RunnableCodeBlocksSettingTab,
  type RunnableCodeBlocksSettings
} from "./settings";
import { mountRunnableBlock, type MountedRunnableBlock } from "./ui";

class RunnableRenderChild extends MarkdownRenderChild {
  #mounted: MountedRunnableBlock | null = null;

  mount(source: string, language: string, registry: RunnerRegistry): void {
    const runner = registry.create(language);
    if (runner === null) throw new Error(`Missing registered runner for ${language}`);
    this.#mounted = mountRunnableBlock(this.containerEl, { code: source, language, runner });
  }

  override onunload(): void {
    this.#mounted?.dispose();
    this.#mounted = null;
  }
}

export default class RunnableCodeBlocksPlugin extends Plugin {
  override settings: RunnableCodeBlocksSettings = { ...DEFAULT_SETTINGS };

  override async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new RunnableCodeBlocksSettingTab(this.app, this));
    const registry = new RunnerRegistry();
    for (const language of SUPPORTED_LANGUAGES) {
      if (language.id === "javascript") {
        registry.register(language.id, () => new BrowserJavaScriptRunner());
      } else {
        registry.register(
          language.id,
          () =>
            new LocalKotlinRunner({
              compilerPath: this.settings.kotlinCompilerPath,
              javaPath: this.settings.javaPath
            })
        );
      }
    }

    for (const language of registry.languages()) {
      this.registerMarkdownCodeBlockProcessor(
        fenceForLanguage(language),
        (source, element, context) => {
          const child = new RunnableRenderChild(element);
          child.mount(source, language, registry);
          context.addChild(child);
        }
      );
    }
  }

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as Partial<RunnableCodeBlocksSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
