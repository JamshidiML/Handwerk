import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  ReplayExtractionProvider,
  StructuredExtractionRunner,
  parseReplayFixture,
  type ReplayFixture,
} from "../src/index.js";
import { canonicalEvidence } from "./test-data.js";

const readFixture = async (filename: string): Promise<ReplayFixture> => {
  const contents = await readFile(
    new URL(`../fixtures/${filename}`, import.meta.url),
    "utf8",
  );
  return parseReplayFixture(JSON.parse(contents) as unknown);
};

const replay = async (filename: string) => {
  const fixture = await readFixture(filename);
  const transcriptText = fixture.request?.transcriptText ?? "synthetic replay";
  const evidence = canonicalEvidence(fixture.fixtureId, transcriptText);
  if (fixture.request !== undefined) {
    evidence.evidenceRevision = fixture.request.evidenceRevision;
  }
  const runner = new StructuredExtractionRunner(
    new ReplayExtractionProvider(fixture),
    {
      timeoutMs: 5,
      maxAttempts: 1,
    },
  );
  return runner.run({
    idempotencyKey: `replay-${fixture.fixtureId}`,
    evidence,
  });
};

describe("synthetic replay fixtures", () => {
  it("replays the canonical Westblick facts", async () => {
    const result = await replay("canonical-westblick.json");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.facts).toHaveLength(5);
      expect(result.data.missingFields).toEqual([
        "ceiling.included",
        "substrate.condition",
      ]);
    }
  });

  it("keeps prompt injection as data and accepts only schema-safe facts", async () => {
    const result = await replay("prompt-injection.json");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.stringify(result.data)).not.toMatch(
        /unitPrice|approvedItemCode|MAL-999/,
      );
      expect(result.data.facts[0]?.key).toBe("wall.area");
    }
  });

  it.each([
    "malformed-output.json",
    "hallucinated-commercial-fields.json",
    "missing-citations.json",
  ])("fails closed for unsafe replay %s", async (filename) => {
    const result = await replay(filename);

    expect(result).toMatchObject({
      ok: false,
      state: "FAILED_SAFE",
      failure: { code: "INVALID_OUTPUT" },
    });
  });

  it("preserves contradictory measurements without choosing one", async () => {
    const result = await replay("contradictory-measurements.json");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.facts[0]).toMatchObject({
        key: "wall.area",
        value: null,
        status: "CONTRADICTORY",
      });
      expect(result.data.missingFields).toContain("wall.area");
    }
  });

  it("replays a bounded provider timeout as FAILED_SAFE", async () => {
    const result = await replay("provider-timeout.json");

    expect(result).toMatchObject({
      ok: false,
      state: "FAILED_SAFE",
      failure: { code: "TIMEOUT", recoverable: true },
    });
  });
});
