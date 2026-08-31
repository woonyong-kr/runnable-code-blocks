import { LANGUAGE_EXAMPLES } from "../src/language-examples";
import { LOCAL_LANGUAGE_SPECS, LocalLanguageRunner } from "../src/runners/local-language-runner";

interface SmokeResult {
  detail?: string;
  language: string;
  provider?: string;
  status: "failed" | "passed" | "unavailable";
}

const requested = new Set(process.argv.slice(2));
const results: SmokeResult[] = [];

for (const example of LANGUAGE_EXAMPLES) {
  if (LOCAL_LANGUAGE_SPECS[example.language] === undefined) continue;
  if (requested.size > 0 && !requested.has(example.language)) continue;
  const runner = new LocalLanguageRunner({ language: example.language });
  const availability = await runner.availability();
  if (!availability.available) {
    results.push({ detail: availability.detail, language: example.language, status: "unavailable" });
    continue;
  }
  const result = await runner.run(example.code);
  const passed = result.exitCode === 0 && result.stdout.includes(example.expected);
  results.push({
    detail: passed ? undefined : `exit=${String(result.exitCode)} stdout=${JSON.stringify(result.stdout)} stderr=${JSON.stringify(result.stderr)}`,
    language: example.language,
    provider: result.provider,
    status: passed ? "passed" : "failed"
  });
}

console.log(JSON.stringify(results, null, 2));
if (results.some(({ status }) => status === "failed")) process.exitCode = 1;
