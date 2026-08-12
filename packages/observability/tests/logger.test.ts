import { describe, expect, it } from "vitest";
import { createLogger, redactAttributes } from "../src/logger";

describe("structured logger", () => {
  it("redacts every attribute outside the privacy allowlist", () => {
    const lines: string[] = [];
    const logger = createLogger({
      service: "handwerk-web",
      environment: "test",
      minimumLevel: "debug",
      correlationId: "request-12345678",
      sink: (line) => lines.push(line),
      clock: () => new Date("2026-08-12T10:00:00.000Z"),
    });

    logger.info("extraction.completed", {
      durationMs: 120,
      outcome: "success",
      transcript: "Anna Becker at a private address",
      signedUrl: "https://storage.invalid/private-token",
      error: new Error("private failure details"),
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("Anna Becker");
    expect(lines[0]).not.toContain("private-token");
    expect(lines[0]).not.toContain("private failure details");
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({
      correlationId: "request-12345678",
      attributes: {
        durationMs: 120,
        outcome: "success",
        transcript: "[REDACTED]",
        signedUrl: "[REDACTED]",
        error: "[REDACTED]",
      },
    });
  });

  it("honours the minimum severity", () => {
    const lines: string[] = [];
    const logger = createLogger({
      service: "handwerk-web",
      environment: "test",
      minimumLevel: "warn",
      correlationId: "request-12345678",
      sink: (line) => lines.push(line),
    });

    logger.info("request.completed", { httpStatus: 200 });
    logger.warn("request.slow", { durationMs: 900 });
    expect(lines).toHaveLength(1);
  });

  it("rejects malformed privacy hashes", () => {
    expect(redactAttributes({ organisationHash: "org-westblick" })).toEqual({
      organisationHash: "[REDACTED]",
    });
  });
});
