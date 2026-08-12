import { describe, expect, it } from "vitest";
import { evaluateAudit } from "../lib/audit-policy.mjs";

const report = {
  vulnerabilities: {
    "dev-tool": {
      severity: "high",
      nodes: ["apps/web/node_modules/dev-tool"],
    },
  },
};

const policy = {
  schemaVersion: 1,
  exceptions: [
    {
      package: "dev-tool",
      severity: "high",
      nodes: ["apps/web/node_modules/dev-tool"],
      expiresOn: "2026-08-26",
      owner: "T09",
      reason: "synthetic test exception",
    },
  ],
};

describe("dependency audit policy", () => {
  it("accepts only an exact, unexpired vulnerability path", () => {
    const result = evaluateAudit(
      report,
      policy,
      new Date("2026-08-12T00:00:00Z"),
    );
    expect(result.failures).toEqual([]);
    expect(result.accepted).toHaveLength(1);
  });

  it("fails when an exception expires", () => {
    const result = evaluateAudit(
      report,
      policy,
      new Date("2026-08-27T00:00:00Z"),
    );
    expect(result.failures).toEqual([
      { package: "dev-tool", reason: "exception expired" },
    ]);
  });

  it("fails for a new high finding", () => {
    const expanded = {
      vulnerabilities: {
        ...report.vulnerabilities,
        "new-high": { severity: "high", nodes: ["node_modules/new-high"] },
      },
    };
    const result = evaluateAudit(
      expanded,
      policy,
      new Date("2026-08-12T00:00:00Z"),
    );
    expect(result.failures).toEqual([
      { package: "new-high", reason: "no exact exception" },
    ]);
  });

  it("never exempts a critical finding through a high exception", () => {
    const critical = {
      vulnerabilities: {
        "dev-tool": {
          severity: "critical",
          nodes: ["apps/web/node_modules/dev-tool"],
        },
      },
    };
    const result = evaluateAudit(
      critical,
      policy,
      new Date("2026-08-12T00:00:00Z"),
    );
    expect(result.failures).toEqual([
      { package: "dev-tool", reason: "no exact exception" },
    ]);
  });
});
