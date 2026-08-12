import { describe, expect, it } from "vitest";
import {
  CANONICAL_IDS,
  type EntityId,
  type ExtractedFact,
  type IsoDateTime,
  type OrganisationId,
  type SourceCitation,
} from "@handwerk/contracts";
import {
  SYNTHETIC_MALER_ITEMS,
  SYNTHETIC_MALER_PRICE_BOOK,
  SYNTHETIC_MAPPING_RULES,
  SYNTHETIC_TENANT_SYNONYM_RULES,
  mapFactsToApprovedPriceBook,
  type CommercialPriceBookItem,
  type MappingContext,
} from "../src";

const NOW = "2026-08-12T11:00:00.000Z" as IsoDateTime;

function citation(overrides: Partial<SourceCitation> = {}): SourceCitation {
  return {
    id: "citation-measurement-wall" as EntityId,
    organisationId: CANONICAL_IDS.organisation,
    sourceType: "EXPLICIT_MEASUREMENT",
    sourceEntityId: "measurement-wall" as EntityId,
    locator: "measurement:wall-area",
    extractionVersion: "handwerk.vertical-slice.v1",
    explanation: "Explizit bestätigte Wandfläche.",
    authority: "AUTHORITATIVE",
    ...overrides,
  };
}

function fact(overrides: Partial<ExtractedFact> = {}): ExtractedFact {
  return {
    id: "fact-wall-area" as EntityId,
    organisationId: CANONICAL_IDS.organisation,
    extractionRunId: "extract-1" as EntityId,
    key: "walls.paint.white.two_coats",
    value: "52",
    unit: "M2",
    status: "CONFIRMED",
    citations: [citation()],
    ...overrides,
  };
}

function context(overrides: Partial<MappingContext> = {}): MappingContext {
  return {
    organisationId: CANONICAL_IDS.organisation,
    priceBook: SYNTHETIC_MALER_PRICE_BOOK,
    items: SYNTHETIC_MALER_ITEMS,
    rules: SYNTHETIC_MAPPING_RULES,
    synonymRules: SYNTHETIC_TENANT_SYNONYM_RULES,
    effectiveOn: "2026-08-12",
    now: NOW,
    ...overrides,
  };
}

function firstStatus(result: ReturnType<typeof mapFactsToApprovedPriceBook>) {
  return result.results[0]?.proposal.status;
}

describe("deterministic approved-price-book mapping", () => {
  it("prices the canonical wall fact only from the allowlisted item", () => {
    const result = mapFactsToApprovedPriceBook([fact()], context());

    expect(firstStatus(result)).toBe("SUPPORTED");
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({
      organisationId: CANONICAL_IDS.organisation,
      itemCode: "MAL-WAND-2X",
      quantity: { value: "52", unit: "M2" },
      unitPrice: { currency: "EUR", minor: 850 },
      netTotal: { currency: "EUR", minor: 44_200 },
      taxTotal: { currency: "EUR", minor: 8_398 },
      grossTotal: { currency: "EUR", minor: 52_598 },
    });
    expect(result.lines[0]?.calculation).toContain("52 m² × 8,50 €");
  });

  it.each([
    ["DRAFT", false, "nicht freigegeben"],
    ["APPROVED", false, "inaktiv"],
  ] as const)(
    "does not price approval=%s active=%s entries",
    (approvalStatus, active, reason) => {
      const item: CommercialPriceBookItem = {
        ...SYNTHETIC_MALER_ITEMS[0]!,
        approvalStatus,
        active,
      };
      const result = mapFactsToApprovedPriceBook(
        [fact()],
        context({ items: [item] }),
      );
      expect(firstStatus(result)).toBe("REJECTED");
      expect(result.results[0]?.proposal.explanation).toContain(reason);
      expect(result.lines).toHaveLength(0);
    },
  );

  it("rejects expired, unit-incompatible, and unknown item codes", () => {
    const expired = {
      ...SYNTHETIC_MALER_ITEMS[0]!,
      validTo: "2026-01-01",
    };
    expect(
      firstStatus(
        mapFactsToApprovedPriceBook([fact()], context({ items: [expired] })),
      ),
    ).toBe("REJECTED");

    const wrongUnit = mapFactsToApprovedPriceBook(
      [fact({ unit: "STK" })],
      context(),
    );
    expect(firstStatus(wrongUnit)).toBe("REJECTED");
    expect(wrongUnit.lines).toHaveLength(0);

    const unknownCode = mapFactsToApprovedPriceBook(
      [fact()],
      context({
        rules: [
          {
            organisationId: CANONICAL_IDS.organisation,
            factKey: "walls.paint.white.two_coats",
            itemCode: "UNKNOWN-999",
            unit: "M2",
          },
        ],
      }),
    );
    expect(firstStatus(unknownCode)).toBe("UNMATCHED");
    expect(unknownCode.lines).toHaveLength(0);

    const invalidValidity = {
      ...SYNTHETIC_MALER_ITEMS[0]!,
      validTo: "kein-datum",
    };
    expect(
      mapFactsToApprovedPriceBook(
        [fact()],
        context({ items: [invalidValidity] }),
      ).lines,
    ).toHaveLength(0);
  });

  it("keeps provider-only suggestions unmatched regardless of confidence", () => {
    const result = mapFactsToApprovedPriceBook(
      [fact()],
      context({
        rules: [],
        synonymRules: [],
        providerSuggestions: [
          {
            extractedFactId: "fact-wall-area" as EntityId,
            suggestedItemCode: "MAL-WAND-2X",
            confidence: 1,
          },
        ],
      }),
    );

    expect(firstStatus(result)).toBe("UNMATCHED");
    expect(result.results[0]?.proposal.explanation).toContain("unverbindlich");
    expect(result.lines).toHaveLength(0);
  });

  it("fails closed for cross-tenant facts, books, items, citations, and synonym rules", () => {
    const otherOrganisation = "org-other" as OrganisationId;
    expect(
      firstStatus(
        mapFactsToApprovedPriceBook(
          [fact({ organisationId: otherOrganisation })],
          context(),
        ),
      ),
    ).toBe("REJECTED");

    const otherBook = {
      ...SYNTHETIC_MALER_PRICE_BOOK,
      organisationId: otherOrganisation,
    };
    expect(
      mapFactsToApprovedPriceBook([fact()], context({ priceBook: otherBook }))
        .lines,
    ).toHaveLength(0);

    const otherItem = {
      ...SYNTHETIC_MALER_ITEMS[0]!,
      organisationId: otherOrganisation,
    };
    expect(
      mapFactsToApprovedPriceBook([fact()], context({ items: [otherItem] }))
        .lines,
    ).toHaveLength(0);

    const wrongCitation = fact({
      citations: [citation(), citation({ organisationId: otherOrganisation })],
    });
    expect(
      mapFactsToApprovedPriceBook([wrongCitation], context()).lines,
    ).toHaveLength(0);

    const synonymFact = fact({ key: "walls.paint.double_white" });
    const crossTenantSynonym = SYNTHETIC_TENANT_SYNONYM_RULES.map((rule) => ({
      ...rule,
      organisationId: otherOrganisation,
    }));
    expect(
      mapFactsToApprovedPriceBook(
        [synonymFact],
        context({ rules: [], synonymRules: crossTenantSynonym }),
      ).lines,
    ).toHaveLength(0);
  });

  it("supports exact tenant synonyms without fuzzy matching", () => {
    const result = mapFactsToApprovedPriceBook(
      [fact({ key: "walls.paint.double_white" })],
      context({ rules: [] }),
    );
    expect(firstStatus(result)).toBe("SUPPORTED");
    expect(result.lines[0]?.itemCode).toBe("MAL-WAND-2X");

    const wrongTerm = SYNTHETIC_TENANT_SYNONYM_RULES.map((rule) => ({
      ...rule,
      term: "ähnlicher aber nicht exakter Text",
    }));
    expect(
      mapFactsToApprovedPriceBook(
        [fact({ key: "walls.paint.double_white" })],
        context({ rules: [], synonymRules: wrongTerm }),
      ).lines,
    ).toHaveLength(0);
  });

  it("keeps unknown, contradictory, zero, negative, and unsafe-large facts unpriced", () => {
    for (const candidate of [
      fact({ status: "UNKNOWN", value: null }),
      fact({ status: "CONTRADICTORY" }),
      fact({ value: "0" }),
      fact({ value: "-2" }),
      fact({ value: "9007199254740991" }),
    ]) {
      const result = mapFactsToApprovedPriceBook([candidate], context());
      expect(result.lines).toHaveLength(0);
      expect(firstStatus(result)).not.toBe("SUPPORTED");
    }
  });

  it("rejects photo-only quantity evidence", () => {
    const photoFact = fact({
      citations: [
        citation({
          sourceType: "PHOTO_CONTEXT",
          authority: "CONTEXT_ONLY",
          locator: "photo:visible-wall",
        }),
      ],
    });
    const result = mapFactsToApprovedPriceBook([photoFact], context());
    expect(firstStatus(result)).toBe("REJECTED");
    expect(result.results[0]?.proposal.explanation).toContain("Fotobeleg");
    expect(result.lines).toHaveLength(0);
  });

  it("prevents duplicate lines for facts mapped to the same approved item", () => {
    const duplicate = fact({ id: "fact-wall-duplicate" as EntityId });
    const result = mapFactsToApprovedPriceBook([fact(), duplicate], context());

    expect(result.lines).toHaveLength(1);
    expect(result.results.map((entry) => entry.proposal.status)).toEqual([
      "SUPPORTED",
      "REJECTED",
    ]);
    expect(result.results[1]?.proposal.explanation).toContain("Doppelzählung");
  });
});
