import { existsSync } from "node:fs";

import { expect, test } from "@playwright/test";

import {
  fixturePath,
  readFixture,
  readFixtureBytes,
  sha256,
} from "./helpers/fixture-data";

type JsonObject = Record<string, unknown>;

function fixture<T extends JsonObject>(path: string): T {
  return readFixture<T>(path);
}

function asRecord(value: unknown): JsonObject {
  expect(value).toBeTruthy();
  expect(typeof value).toBe("object");
  return value as JsonObject;
}

function asArray(value: unknown): unknown[] {
  expect(Array.isArray(value)).toBe(true);
  return value as unknown[];
}

function decimalToThousandths(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 1000n + BigInt(`${fraction}000`.slice(0, 3));
}

function calculateMinor(quantity: string, unitPriceMinor: number): number {
  return Number(
    (decimalToThousandths(quantity) * BigInt(unitPriceMinor)) / 1000n,
  );
}

test.describe("synthetic fixture contract", () => {
  test("declares every required artifact and labels all JSON fixtures synthetic", () => {
    const manifest = fixture<{
      fixtureSetId: string;
      synthetic: boolean;
      disclaimer: string;
      requiredFiles: string[];
    }>("manifest.json");

    expect(manifest.fixtureSetId).toBe("handwerk-synthetic-v1");
    expect(manifest.synthetic).toBe(true);
    expect(manifest.disclaimer).toContain("FABRICATED TEST DATA ONLY");

    for (const path of manifest.requiredFiles) {
      expect(existsSync(fixturePath(path)), `missing fixture ${path}`).toBe(
        true,
      );
      if (path.endsWith(".json")) {
        expect(fixture<JsonObject>(path).synthetic, path).toBe(true);
      }
    }
  });

  test("keeps canonical identity and tenancy relationships internally consistent", () => {
    const manifest = fixture<{
      canonicalIds: Record<string, string>;
    }>("manifest.json");
    const organisation = fixture<{ id: string; name: string }>(
      "identity/organisation.json",
    );
    const user = fixture<{ id: string }>("identity/user.json");
    const customer = fixture<{ id: string; organisationId: string }>(
      "identity/customer.json",
    );
    const project = fixture<{
      id: string;
      organisationId: string;
      customerId: string;
    }>("identity/project.json");

    expect(organisation.id).toBe(manifest.canonicalIds.organisation);
    expect(organisation.name).toBe("Malerbetrieb Westblick GmbH");
    expect(user.id).toBe(manifest.canonicalIds.user);
    expect(customer.id).toBe(manifest.canonicalIds.customer);
    expect(customer.organisationId).toBe(organisation.id);
    expect(project.id).toBe(manifest.canonicalIds.project);
    expect(project.organisationId).toBe(organisation.id);
    expect(project.customerId).toBe(customer.id);
  });

  test("keeps generated media deterministic and unmistakably synthetic", () => {
    const media = fixture<{
      synthetic: boolean;
      files: Array<{
        filename: string;
        sizeBytes: number;
        checksumSha256: string;
        synthetic: boolean;
        semantics: string;
      }>;
    }>("media/media-manifest.json");

    expect(media.synthetic).toBe(true);
    for (const file of media.files) {
      const bytes = readFixtureBytes(`media/${file.filename}`);
      expect(file.synthetic).toBe(true);
      expect(file.semantics.toLowerCase()).toContain("synthetic");
      expect(bytes.byteLength).toBe(file.sizeBytes);
      expect(sha256(bytes)).toBe(file.checksumSha256);
    }

    expect(
      readFixtureBytes("media/synthetic-living-room.png")
        .subarray(1, 4)
        .toString(),
    ).toBe("PNG");
    expect(
      readFixtureBytes("media/synthetic-site-note.wav")
        .subarray(0, 4)
        .toString(),
    ).toBe("RIFF");
  });

  test("uses explicit measurements and transcript citations for canonical extraction facts", () => {
    const measurements = fixture<{ measurements: JsonObject[] }>(
      "capture/measurements.json",
    ).measurements;
    const transcript = fixture<{ segments: JsonObject[] }>(
      "capture/transcript.json",
    ).segments;
    const facts = fixture<{ expectedOutput: { facts: JsonObject[] } }>(
      "extraction/expected-facts.json",
    ).expectedOutput.facts;

    const measurementIds = new Set(measurements.map((item) => String(item.id)));
    const transcriptIds = new Set(transcript.map((item) => String(item.id)));
    const wallArea = facts.find((item) => item.key === "wall_area");
    const ceilingInclusion = facts.find(
      (item) => item.key === "ceiling_included",
    );

    expect(wallArea?.value).toBe(52);
    expect(ceilingInclusion?.value).toBeNull();
    expect(ceilingInclusion?.status).toBe("UNKNOWN");

    for (const fact of facts) {
      for (const locator of asArray(fact.sourceLocators)) {
        const source = asRecord(locator);
        const sourceId = String(source.sourceEntityId);
        if (source.sourceType === "EXPLICIT_MEASUREMENT") {
          expect(measurementIds.has(sourceId), sourceId).toBe(true);
          expect(source.authority).toBe("AUTHORITATIVE");
        }
        if (source.sourceType === "TRANSCRIPT_SEGMENT") {
          expect(transcriptIds.has(sourceId), sourceId).toBe(true);
        }
      }
    }
  });

  test("proves canonical questions are critical, answered, and tied to cited uncertainty", () => {
    const clarifications = fixture<{
      questions: JsonObject[];
      answers: JsonObject[];
    }>("clarifications/canonical.json");
    const prompts = clarifications.questions.map((question) => question.prompt);

    expect(prompts).toEqual([
      "Soll die Decke mitgestrichen werden?",
      "Ist der Untergrund tragfähig und ohne zusätzliche Ausbesserung?",
    ]);
    expect(clarifications.answers.map((answer) => answer.value)).toEqual([
      false,
      true,
    ]);
    for (const question of clarifications.questions) {
      expect(question.severity).toBe("CRITICAL");
      expect(question.blocking).toBe(true);
      expect(question.status).toBe("ANSWERED");
      expect(asArray(question.sourceContext)).not.toHaveLength(0);
    }
  });

  test("allows the approved draft to reference active same-tenant price-book entries only", () => {
    const priceBook = fixture<{ items: JsonObject[] }>(
      "pricebook/approved-pricebook.json",
    );
    const approved = fixture<{
      draft: JsonObject;
      revision: { lines: JsonObject[]; excludedItems: JsonObject[] };
      approval: JsonObject;
    }>("draft/approved-draft.json");
    const activeById = new Map(
      priceBook.items
        .filter((item) => item.active === true)
        .map((item) => [String(item.id), item]),
    );

    expect(approved.draft.currentRevision).toBe(
      approved.draft.approvedRevision,
    );
    expect(approved.approval.revision).toBe(approved.draft.currentRevision);
    for (const line of approved.revision.lines) {
      const priceItem = activeById.get(String(line.priceBookItemId));
      expect(priceItem, String(line.priceBookItemId)).toBeDefined();
      expect(line.organisationId).toBe(priceItem?.organisationId);
      expect(line.itemCode).toBe(priceItem?.code);
      expect(line.quantity).toMatchObject({ unit: priceItem?.unit });
      expect(asArray(line.citations)).not.toHaveLength(0);
    }
    expect(approved.revision.lines.map((line) => line.itemCode)).not.toContain(
      "MAL-DECKE-2X",
    );
    expect(approved.revision.excludedItems[0]?.key).toBe("ceiling_painting");
  });

  test("uses integer minor-unit totals that reconcile with every approved line", () => {
    const approved = fixture<{
      revision: {
        lines: Array<{
          quantity: { value: string };
          unitPrice: { minor: number };
          netTotal: { minor: number };
          taxTotal: { minor: number };
          grossTotal: { minor: number };
        }>;
        netTotal: { minor: number };
        taxTotal: { minor: number };
        grossTotal: { minor: number };
      };
    }>("draft/approved-draft.json");

    const totals = approved.revision.lines.reduce(
      (sum, line) => {
        expect(calculateMinor(line.quantity.value, line.unitPrice.minor)).toBe(
          line.netTotal.minor,
        );
        expect(line.netTotal.minor + line.taxTotal.minor).toBe(
          line.grossTotal.minor,
        );
        return {
          net: sum.net + line.netTotal.minor,
          tax: sum.tax + line.taxTotal.minor,
          gross: sum.gross + line.grossTotal.minor,
        };
      },
      { net: 0, tax: 0, gross: 0 },
    );

    expect(totals.net).toBe(approved.revision.netTotal.minor);
    expect(totals.tax).toBe(approved.revision.taxTotal.minor);
    expect(totals.gross).toBe(approved.revision.grossTotal.minor);
  });

  test("keeps adversarial extraction payloads unpriced and context-only photos non-authoritative", () => {
    const invalid = fixture<{ expected: JsonObject }>(
      "extraction/invalid-model-output.json",
    );
    const hallucinated = fixture<{
      modelOutput: { facts: JsonObject[] };
      expected: JsonObject;
    }>("extraction/hallucinated-code.json");
    const photoOnly = fixture<{
      expected: JsonObject;
      modelOutput: JsonObject;
    }>("extraction/photo-only-measurement.json");
    const injection = fixture<{ expected: JsonObject }>(
      "extraction/prompt-injection-transcript.json",
    );

    expect(invalid.expected).toMatchObject({
      status: "FAILED_SAFE",
      pricedLinesCreated: 0,
    });
    expect(hallucinated.expected).toMatchObject({
      status: "FAILED_SAFE",
      pricedLinesCreated: 0,
    });
    expect(hallucinated.modelOutput.facts[0]).toHaveProperty(
      "approvedItemCode",
    );
    expect(photoOnly.expected).toMatchObject({
      authoritativeMeasurementsCreated: 0,
      pricedLinesCreated: 0,
      requiresExplicitMeasurement: true,
    });
    expect(photoOnly.modelOutput).toMatchObject({
      facts: [
        {
          sourceLocators: [
            { sourceType: "PHOTO_CONTEXT", authority: "CONTEXT_ONLY" },
          ],
        },
      ],
    });
    expect(injection.expected).toMatchObject({
      contentTreatedAsInstructions: false,
      inventedCodes: 0,
      autonomousMessagesSent: 0,
    });
  });

  test("defines safe cross-tenant and CSV-injection expectations", () => {
    const tenant = fixture<{ expected: JsonObject }>(
      "security/cross-tenant.json",
    );
    const csv = fixture<{
      fields: Array<{ input: string; expectedCell: string }>;
      expected: JsonObject;
    }>("security/malicious-csv.json");

    expect(tenant.expected).toMatchObject({
      httpStatus: 404,
      apiErrorCode: "FORBIDDEN_OR_NOT_FOUND",
    });
    for (const field of csv.fields) {
      expect(field.expectedCell).toBe(`'${field.input}`);
    }
    expect(csv.expected).toMatchObject({ formulaCapableCells: 0 });
  });
});
