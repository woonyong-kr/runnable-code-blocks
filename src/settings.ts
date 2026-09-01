import { App, Plugin, PluginSettingTab, type SettingDefinitionItem } from "obsidian";
import type { ExecutionOrder } from "./runner-composition";
import { supportedLanguagesDescription } from "./supported-languages";

export interface RunnableCodeBlocksSettings {
  executionOrder: ExecutionOrder;
  remoteExecutionEnabled: boolean;
}

export const DEFAULT_SETTINGS: RunnableCodeBlocksSettings = {
  executionOrder: "remote-first",
  remoteExecutionEnabled: true
};

export function normalizeSettings(value: unknown): RunnableCodeBlocksSettings {
  const stored = isRecord(value) ? value : {};
  return {
    executionOrder: stored.executionOrder === "browser-first" || stored.executionOrder === "private-first"
      ? "browser-first"
      : DEFAULT_SETTINGS.executionOrder,
    remoteExecutionEnabled: typeof stored.remoteExecutionEnabled === "boolean"
      ? stored.remoteExecutionEnabled
      : DEFAULT_SETTINGS.remoteExecutionEnabled
  };
}

type RunnableSettingKey = keyof RunnableCodeBlocksSettings;

export class RunnableCodeBlocksSettingTab extends PluginSettingTab {
  readonly #plugin: Plugin & {
    settings: RunnableCodeBlocksSettings;
    saveSettings(): Promise<void>;
  };

  constructor(app: App, plugin: Plugin & { settings: RunnableCodeBlocksSettings; saveSettings(): Promise<void> }) {
    super(app, plugin);
    this.#plugin = plugin;
  }

  override getSettingDefinitions(): SettingDefinitionItem<RunnableSettingKey>[] {
    return [
      {
        name: "Supported languages",
        desc: supportedLanguagesDescription()
      },
      {
        name: "Remote execution",
        desc: "Wandbox, Kotlin Playground, SwiftFiddle, and DartPad can receive source code. Disable this for browser-only execution.",
        control: {
          defaultValue: DEFAULT_SETTINGS.remoteExecutionEnabled,
          key: "remoteExecutionEnabled",
          type: "toggle"
        }
      },
      {
        name: "Provider order",
        desc: "Remote first follows the Wiki adapter policy. Browser first avoids source upload when an in-browser runner is available.",
        control: {
          defaultValue: DEFAULT_SETTINGS.executionOrder,
          key: "executionOrder",
          options: {
            "browser-first": "Browser → remote",
            "remote-first": "Remote → browser"
          },
          type: "dropdown"
        }
      }
    ];
  }

  override getControlValue(key: string): unknown {
    if (key === "executionOrder" || key === "remoteExecutionEnabled") {
      return this.#plugin.settings[key];
    }
    return undefined;
  }

  override async setControlValue(key: string, value: unknown): Promise<void> {
    if (key === "remoteExecutionEnabled" && typeof value === "boolean") {
      this.#plugin.settings.remoteExecutionEnabled = value;
    } else if (key === "executionOrder" && (value === "remote-first" || value === "browser-first")) {
      this.#plugin.settings.executionOrder = value;
    } else {
      return;
    }
    await this.#plugin.saveSettings();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
