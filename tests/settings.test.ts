import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings } from "../src/settings";

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
