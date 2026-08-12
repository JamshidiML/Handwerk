import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const configSource = readFileSync(
  resolve(import.meta.dirname, "../../vitest.config.ts"),
  "utf8",
);

describe("Vitest discovery", () => {
  it("excludes isolated worktrees from root test discovery", () => {
    expect(configSource).toContain("configDefaults.exclude");
    expect(configSource).toContain('"**/.worktrees/**"');
  });
});
