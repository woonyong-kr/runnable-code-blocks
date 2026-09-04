import { describe, expect, it } from "vitest";
import { BoundedOutput, OUTPUT_LIMITS } from "../src/output-buffer";

describe("BoundedOutput", () => {
  it("keeps ordered output below both limits", () => {
    const output = new BoundedOutput({ characterLimit: 20, entryLimit: 3 });
    output.append("one");
    output.append("two");
    expect(output.toString()).toBe("one\ntwo");
  });

  it("adds one stable marker when output exceeds its budget", () => {
    const output = new BoundedOutput({ characterLimit: 40, entryLimit: 2 });
    output.append("one");
    output.append("two");
    output.append("three");
    output.append("four");
    expect(output.toString()).toContain(OUTPUT_LIMITS.marker);
    expect(output.toString().match(/output truncated/gu)).toHaveLength(1);
    expect(output.toString().length).toBeLessThanOrEqual(40);
  });
});
