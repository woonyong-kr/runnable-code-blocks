import { App, Plugin, PluginSettingTab, Setting } from "obsidian";

export interface RunnableCodeBlocksSettings {
  javaPath: string;
  kotlinCompilerPath: string;
}

export const DEFAULT_SETTINGS: RunnableCodeBlocksSettings = {
  javaPath: "java",
  kotlinCompilerPath: ""
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
      .setName("Kotlin compiler")
      .setDesc("Executable path for local kotlinc. No server is contacted.")
      .addText((text) =>
        text
          .setPlaceholder("Auto-detect")
          .setValue(this.#plugin.settings.kotlinCompilerPath)
          .onChange(async (value) => {
            this.#plugin.settings.kotlinCompilerPath = value.trim();
            await this.#plugin.saveSettings();
          })
      );
    new Setting(this.containerEl)
      .setName("Java runtime")
      .setDesc("Executable path for java used to run the compiled Kotlin JAR.")
      .addText((text) =>
        text
          .setPlaceholder("java")
          .setValue(this.#plugin.settings.javaPath)
          .onChange(async (value) => {
            this.#plugin.settings.javaPath = value.trim() || "java";
            await this.#plugin.saveSettings();
          })
      );
  }
}
