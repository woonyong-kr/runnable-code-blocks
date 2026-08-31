import { LocalKotlinRunner } from "../src/runners/kotlin-runner";

const runner = new LocalKotlinRunner();
const availability = await runner.availability();
if (!availability.available) throw new Error(availability.detail);

const result = await runner.run(`fun main() {
    val values = listOf(1, 2, 3, 4)
    println(values.map { it * 2 }.joinToString(", "))
}`);
if (result.exitCode !== 0 || result.stdout.trim() !== "2, 4, 6, 8") {
  throw new Error(`Kotlin smoke test failed: ${JSON.stringify(result)}`);
}

console.log(
  JSON.stringify({
    compiler: availability.detail,
    durationMs: Math.round(result.durationMs),
    output: result.stdout.trim(),
    status: "ok"
  })
);

