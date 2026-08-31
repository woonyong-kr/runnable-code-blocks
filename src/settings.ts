import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { ExecutionOrder } from "./runner-composition";
import { supportedLanguagesDescription } from "./supported-languages";

export interface RunnableCodeBlocksSettings {
  executionOrder: ExecutionOrder;
  localExecutableOverrides: Record<string, string>;
  remoteExecutionEnabled: boolean;
}

export const DEFAULT_SETTINGS: RunnableCodeBlocksSettings = {
  executionOrder: "remote-first",
  localExecutableOverrides: {},
  remoteExecutionEnabled: true
};

export class RunnableCodeBlocksSettingTab extends PluginSettingTab {
  readonly #plugin: Plugin & {
    settings: RunnableCodeBlocksSettings;
    saveSettings(): Promise<void>;
  };

  constructor(app: App, plugin: Plugin & { settings: RunnableCodeBlocksSettings; saveSettings(): Promise<void> }) {
    super(app, plugin);
    this.#plugin = plugin;
  }

  override display(): void {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName("Supported languages")
      .setDesc(supportedLanguagesDescription());
    new Setting(this.containerEl)
      .setName("Remote execution")
      .setDesc("Wandbox, Kotlin Playground, SwiftFiddle, and DartPad can receive source code. Disable this for browser/local-only execution.")
      .addToggle((toggle) =>
        toggle.setValue(this.#plugin.settings.remoteExecutionEnabled).onChange(async (value) => {
          this.#plugin.settings.remoteExecutionEnabled = value;
          await this.#plugin.saveSettings();
        })
      );
    new Setting(this.containerEl)
      .setName("Provider order")
      .setDesc("Remote first follows the Wiki adapter policy. Private first avoids source upload when a browser or local runner is available.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("remote-first", "Remote → browser/local")
          .addOption("private-first", "Browser/local → remote")
          .setValue(this.#plugin.settings.executionOrder)
          .onChange(async (value) => {
            this.#plugin.settings.executionOrder = value as ExecutionOrder;
            await this.#plugin.saveSettings();
          })
      );
    new Setting(this.containerEl)
      .setName("Local executable overrides")
      .setDesc('Optional JSON map, for example {"python":"/opt/homebrew/bin/python3","kotlinc":"/path/to/kotlinc"}. PATH is never modified and runtimes are never installed.')
      .addTextArea((text) =>
        text
          .setPlaceholder("{}")
          .setValue(JSON.stringify(this.#plugin.settings.localExecutableOverrides, null, 2))
          .onChange(async (value) => {
            try {
              const parsed = JSON.parse(value) as unknown;
              if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return;
              const entries = Object.entries(parsed).filter(
                (entry): entry is [string, string] => typeof entry[1] === "string"
              );
              this.#plugin.settings.localExecutableOverrides = Object.fromEntries(entries);
              await this.#plugin.saveSettings();
            } catch {
              // Keep the last valid settings while the user is still editing JSON.
            }
          })
      );
  }
}
