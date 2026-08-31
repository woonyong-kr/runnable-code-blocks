import { MarkdownRenderChild, Plugin } from "obsidian";
import { fenceForLanguage } from "./contracts";
import { createRunnerRegistry } from "./runner-composition";
import type { RunnerRegistry } from "./runner-registry";
import { LOCAL_LANGUAGE_SPECS, LocalLanguageRunner } from "./runners/local-language-runner";
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
    const registry = createRunnerRegistry({
      executionOrder: this.settings.executionOrder,
      localRunner: (language) => LOCAL_LANGUAGE_SPECS[language] === undefined
        ? null
        : new LocalLanguageRunner({
            executableOverrides: this.settings.localExecutableOverrides,
            language
          }),
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
    const stored = (await this.loadData()) as Record<string, unknown> | null;
    const overrides = isStringRecord(stored?.localExecutableOverrides)
      ? { ...stored.localExecutableOverrides }
      : {};
    if (typeof stored?.kotlinCompilerPath === "string" && stored.kotlinCompilerPath.trim()) {
      overrides.kotlinc = stored.kotlinCompilerPath.trim();
    }
    if (typeof stored?.javaPath === "string" && stored.javaPath.trim()) {
      overrides.java = stored.javaPath.trim();
    }
    this.settings = {
      executionOrder: stored?.executionOrder === "private-first" ? "private-first" : DEFAULT_SETTINGS.executionOrder,
      localExecutableOverrides: overrides,
      remoteExecutionEnabled: typeof stored?.remoteExecutionEnabled === "boolean"
        ? stored.remoteExecutionEnabled
        : DEFAULT_SETTINGS.remoteExecutionEnabled
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.values(value).every((entry) => typeof entry === "string");
}
