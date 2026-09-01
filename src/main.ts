import { MarkdownRenderChild, Plugin } from "obsidian";
import { fenceForLanguage } from "./contracts";
import { obsidianFetch } from "./obsidian-fetch";
import { createRunnerRegistry } from "./runner-composition";
import type { RunnerRegistry } from "./runner-registry";
import {
  DEFAULT_SETTINGS,
  RunnableCodeBlocksSettingTab,
  normalizeSettings,
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
    const registry = createRunnerRegistry({
      executionOrder: this.settings.executionOrder,
      fetch: obsidianFetch,
      remoteExecutionEnabled: this.settings.remoteExecutionEnabled
    });

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
    this.settings = normalizeSettings(await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
