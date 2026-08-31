import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      obsidian: new URL("./tests/obsidian-runtime.ts", import.meta.url).pathname
    }
  },
  test: {
    environment: "happy-dom",
    coverage: {
      exclude: ["src/main.ts", "src/settings.ts", "site/main.ts"],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: {
        branches: 70,
        functions: 75,
        lines: 80,
        statements: 80
      }
    }
  }
});

