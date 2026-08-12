import { describe, expect, it } from "vitest";
import { scanText } from "../lib/secret-scan.mjs";

describe("secret scanner", () => {
  it("detects representative credentials without returning their values", () => {
    const findings = scanText(
      [
        ["-----BEGIN ", "PRIVATE KEY-----"].join(""),
        `OPENAI_KEY=${["sk", "proj", "abcdefghijklmnopqrstuvwxyz123456"].join("-")}`,
        `${["client", "secret"].join("_")}=${["actual", "credential", "value123"].join("")}`,
      ].join("\n"),
    );

    expect(findings.map((finding) => finding.rule)).toEqual([
      "private-key",
      "openai-key",
      "credential-assignment",
    ]);
    expect(JSON.stringify(findings)).not.toContain("actualcredentialvalue123");
  });

  it("accepts explicit local placeholders", () => {
    expect(
      scanText("POSTGRES_PASSWORD=local-development-only-change-me"),
    ).toEqual([]);
  });
});
