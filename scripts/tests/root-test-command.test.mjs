import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../../package.json"), "utf8"),
);
const workflow = readFileSync(
  resolve(import.meta.dirname, "../../.github/workflows/ci.yml"),
  "utf8",
);

describe("root test command", () => {
  it("builds before running workspace tests", () => {
    const command = manifest.scripts.test;
    expect(command).toContain("npm run build");
    expect(command.indexOf("npm run build")).toBeLessThan(
      command.indexOf("--workspaces"),
    );
    expect(command).not.toContain("--parallel");
    expect(workflow).toMatch(/Fresh-worktree build and test\n\s+run: npm test/);
  });
});
