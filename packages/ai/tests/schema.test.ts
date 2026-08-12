import { describe, expect, it } from "vitest";

import {
  CANONICAL_EXTRACTION_RESULT,
  ExtractionValidationError,
  parseExtractionResult,
} from "../src/index.js";

const cloneCanonical = (): unknown =>
  structuredClone(CANONICAL_EXTRACTION_RESULT);

describe("strict extraction validation", () => {
  it("accepts the canonical contract-compatible facts", () => {
    const result = parseExtractionResult(cloneCanonical());

    expect(result.contractVersion).toBe("handwerk.vertical-slice.v1");
    expect(result.facts.map((fact) => fact.key)).toEqual([
      "wall.area",
      "wall.coats",
      "ceiling.area",
      "door_frames.protection_count",
      "substrate.condition",
    ]);
    expect(result.missingFields).toEqual([
      "ceiling.included",
      "substrate.condition",
    ]);
  });

  it("rejects malformed JSON without retaining the raw payload", () => {
    const raw = '{"secret-transcript":"synthetic-sensitive-marker"';

    try {
      parseExtractionResult(raw);
      throw new Error("Expected strict parsing to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ExtractionValidationError);
      expect(JSON.stringify(error)).not.toContain("synthetic-sensitive-marker");
    }
  });

  it.each(["unitPrice", "priceBookItemId", "approvedItemCode", "itemCode"])(
    "rejects hallucinated commercial field %s",
    (field) => {
      const candidate = structuredClone(CANONICAL_EXTRACTION_RESULT) as Record<
        string,
        unknown
      >;
      const facts = candidate.facts as Array<Record<string, unknown>>;
      facts[0]![field] = field === "unitPrice" ? 1 : "MAL-999";

      expect(() => parseExtractionResult(candidate)).toThrow(
        ExtractionValidationError,
      );
    },
  );

  it.each(["unitPrice", "approvedItemCode", "price_book_code", "taxRate"])(
    "rejects commercial intent smuggled through fact key %s",
    (key) => {
      const candidate = structuredClone(CANONICAL_EXTRACTION_RESULT);
      candidate.facts[0]!.key = key;

      expect(() => parseExtractionResult(candidate)).toThrow(
        ExtractionValidationError,
      );
    },
  );

  it("rejects a fact without citations", () => {
    const candidate = structuredClone(CANONICAL_EXTRACTION_RESULT);
    candidate.facts[0]!.sourceLocators = [];

    expect(() => parseExtractionResult(candidate)).toThrow(
      ExtractionValidationError,
    );
  });

  it("rejects authoritative photo claims", () => {
    const candidate = structuredClone(CANONICAL_EXTRACTION_RESULT);
    candidate.facts[0]!.sourceLocators = [
      {
        sourceType: "PHOTO_CONTEXT",
        sourceEntityId: "photo-synthetic-living-room-001",
        locator: "photo:whole-image",
        authority: "AUTHORITATIVE",
      },
    ];

    expect(() => parseExtractionResult(candidate)).toThrow(
      ExtractionValidationError,
    );
  });

  it("rejects a photo-only measurement even when the photo stays context-only", () => {
    const candidate = structuredClone(CANONICAL_EXTRACTION_RESULT);
    candidate.facts[0]!.sourceLocators = [
      {
        sourceType: "PHOTO_CONTEXT",
        sourceEntityId: "photo-synthetic-living-room-001",
        locator: "photo:whole-image",
        authority: "CONTEXT_ONLY",
      },
    ];

    expect(() => parseExtractionResult(candidate)).toThrow(
      ExtractionValidationError,
    );
  });

  it("rejects a unitless numeric count inferred only from a photo", () => {
    const candidate = structuredClone(CANONICAL_EXTRACTION_RESULT);
    candidate.facts[0] = {
      key: "door_frames.visible_count",
      value: 2,
      status: "CONFIRMED",
      sourceLocators: [
        {
          sourceType: "PHOTO_CONTEXT",
          sourceEntityId: "photo-synthetic-living-room-001",
          locator: "photo:whole-image",
          authority: "CONTEXT_ONLY",
        },
      ],
    };

    expect(() => parseExtractionResult(candidate)).toThrow(
      ExtractionValidationError,
    );
  });

  it("keeps contradictions unresolved and requires two sources", () => {
    const contradictory = {
      contractVersion: "handwerk.vertical-slice.v1",
      facts: [
        {
          key: "wall.area",
          value: null,
          unit: "M2",
          status: "CONTRADICTORY",
          sourceLocators: [
            {
              sourceType: "EXPLICIT_MEASUREMENT",
              sourceEntityId: "measurement-a",
              locator: "measurement:measurement-a",
              authority: "AUTHORITATIVE",
            },
            {
              sourceType: "EXPLICIT_MEASUREMENT",
              sourceEntityId: "measurement-b",
              locator: "measurement:measurement-b",
              authority: "AUTHORITATIVE",
            },
          ],
        },
      ],
      missingFields: ["wall.area"],
    };

    expect(parseExtractionResult(contradictory).facts[0]).toMatchObject({
      status: "CONTRADICTORY",
      value: null,
    });

    const selectedValue = structuredClone(contradictory);
    (selectedValue.facts[0] as { value: unknown }).value = 52;
    expect(() => parseExtractionResult(selectedValue)).toThrow(
      ExtractionValidationError,
    );

    const oneSource = structuredClone(contradictory);
    oneSource.facts[0]!.sourceLocators.pop();
    expect(() => parseExtractionResult(oneSource)).toThrow(
      ExtractionValidationError,
    );
  });
});
