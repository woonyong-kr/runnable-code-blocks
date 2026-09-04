import { App, type Plugin } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  RunnableCodeBlocksSettingTab,
  type RunnableCodeBlocksSettings
} from "../src/settings";

describe("normalizeSettings", () => {
  it("uses safe defaults for missing or malformed data", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings([])).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ executionOrder: "unknown", remoteExecutionEnabled: "yes" }))
      .toEqual(DEFAULT_SETTINGS);
  });

  it("preserves the old private-first value as browser-first", () => {
    expect(normalizeSettings({ executionOrder: "private-first", remoteExecutionEnabled: false }))
      .toEqual({ executionOrder: "browser-first", remoteExecutionEnabled: false });
  });

  it("accepts current settings", () => {
    expect(normalizeSettings({ executionOrder: "browser-first", remoteExecutionEnabled: true }))
      .toEqual({ executionOrder: "browser-first", remoteExecutionEnabled: true });
  });
});

describe("RunnableCodeBlocksSettingTab", () => {
  function createTab() {
    const settings: RunnableCodeBlocksSettings = { ...DEFAULT_SETTINGS };
    const saveSettings = vi.fn(async () => undefined);
    const plugin = { saveSettings, settings } as unknown as Plugin & {
      saveSettings(): Promise<void>;
      settings: RunnableCodeBlocksSettings;
    };
    return { saveSettings, settings, tab: new RunnableCodeBlocksSettingTab(new App(), plugin) };
  }

  it("describes the shared language catalog and both execution controls", () => {
    const { tab } = createTab();

    expect(tab.getSettingDefinitions().map((definition) =>
      "name" in definition ? definition.name : undefined
    )).toEqual([
      "Supported languages",
      "Remote execution",
      "Provider order"
    ]);
    expect(tab.getControlValue("remoteExecutionEnabled")).toBe(true);
    expect(tab.getControlValue("executionOrder")).toBe("remote-first");
    expect(tab.getControlValue("unknown")).toBeUndefined();
  });

  it("persists only valid control values", async () => {
    const { saveSettings, settings, tab } = createTab();

    await tab.setControlValue("remoteExecutionEnabled", false);
    await tab.setControlValue("executionOrder", "browser-first");
    await tab.setControlValue("executionOrder", "invalid");
    await tab.setControlValue("unknown", true);

    expect(settings).toEqual({ executionOrder: "browser-first", remoteExecutionEnabled: false });
    expect(saveSettings).toHaveBeenCalledTimes(2);
  });
});
