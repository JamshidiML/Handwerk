import { describe, expect, it } from "vitest";

import {
  createOfferLine,
  DomainInvariantError,
  editOfferLineQuantity,
} from "../src/index";
import {
  citation,
  ORG,
  OTHER_ORG,
  priceBook,
  priceBookItem,
  id,
} from "./fixtures";

function createLine() {
  return createOfferLine({
    id: id("line-1"),
    organisationId: ORG,
    priceBook: priceBook(),
    priceBookItem: priceBookItem(),
    quantity: { value: "52", unit: "M2" },
    citations: [citation()],
    risk: "LOW_RISK",
    origin: "GENERATED",
    asOfDate: "2026-08-12",
  });
}

describe("approved-price-book-only line creation", () => {
  it("copies price and tax from the approved item and calculates exact totals", () => {
    const line = createLine();
    expect(line.unitPrice.minor).toBe(1_290);
    expect(line.netTotal.minor).toBe(67_080);
    expect(line.taxTotal.minor).toBe(12_745);
    expect(line.grossTotal.minor).toBe(79_825);
    expect(line.priceBookItemId).toBe(priceBookItem().id);
  });

  it("rejects a price book from another organisation", () => {
    expect(() =>
      createOfferLine({
        id: id("line-1"),
        organisationId: ORG,
        priceBook: priceBook({ organisationId: OTHER_ORG }),
        priceBookItem: priceBookItem(),
        quantity: { value: "1", unit: "M2" },
        citations: [citation()],
        risk: "LOW_RISK",
        origin: "GENERATED",
        asOfDate: "2026-08-12",
      }),
    ).toThrowError(/same organisation/);
  });

  it.each([
    ["inactive book", priceBook({ active: false }), priceBookItem()],
    ["inactive item", priceBook(), priceBookItem({ active: false })],
    ["future item", priceBook(), priceBookItem({ validFrom: "2027-01-01" })],
    ["expired item", priceBook(), priceBookItem({ validTo: "2026-01-01" })],
  ])("rejects %s", (_name, book, item) => {
    expect(() =>
      createOfferLine({
        id: id("line-1"),
        organisationId: ORG,
        priceBook: book,
        priceBookItem: item,
        quantity: { value: "1", unit: "M2" },
        citations: [citation()],
        risk: "LOW_RISK",
        origin: "GENERATED",
        asOfDate: "2026-08-12",
      }),
    ).toThrowError(DomainInvariantError);
  });

  it("rejects a mismatched price-book parent", () => {
    expect(() =>
      createOfferLine({
        id: id("line-1"),
        organisationId: ORG,
        priceBook: priceBook(),
        priceBookItem: priceBookItem({ priceBookId: id("another-book") }),
        quantity: { value: "1", unit: "M2" },
        citations: [citation()],
        risk: "LOW_RISK",
        origin: "GENERATED",
        asOfDate: "2026-08-12",
      }),
    ).toThrowError(/does not belong/);
  });

  it("rejects incompatible quantity units", () => {
    expect(() =>
      createOfferLine({
        id: id("line-1"),
        organisationId: ORG,
        priceBook: priceBook(),
        priceBookItem: priceBookItem(),
        quantity: { value: "1", unit: "STK" },
        citations: [citation()],
        risk: "LOW_RISK",
        origin: "GENERATED",
        asOfDate: "2026-08-12",
      }),
    ).toThrowError(/incompatible/);
  });

  it("rejects missing and cross-tenant citations", () => {
    const base = {
      id: id("line-1"),
      organisationId: ORG,
      priceBook: priceBook(),
      priceBookItem: priceBookItem(),
      quantity: { value: "1", unit: "M2" } as const,
      risk: "LOW_RISK" as const,
      origin: "GENERATED" as const,
      asOfDate: "2026-08-12",
    };
    expect(() => createOfferLine({ ...base, citations: [] })).toThrowError(
      /source citation/,
    );
    expect(() =>
      createOfferLine({
        ...base,
        citations: [citation({ organisationId: OTHER_ORG })],
      }),
    ).toThrowError(/citations/);
  });

  it("rejects photo-context-only support for a commercial quantity", () => {
    expect(() =>
      createOfferLine({
        id: id("line-photo-only"),
        organisationId: ORG,
        priceBook: priceBook(),
        priceBookItem: priceBookItem(),
        quantity: { value: "52", unit: "M2" },
        citations: [
          citation({ sourceType: "PHOTO_CONTEXT", authority: "CONTEXT_ONLY" }),
        ],
        risk: "BLOCKING",
        origin: "GENERATED",
        asOfDate: "2026-08-12",
      }),
    ).toThrowError(/photo context alone/);
  });

  it("rejects impossible price-book validity dates", () => {
    expect(() =>
      createOfferLine({
        id: id("line-bad-date"),
        organisationId: ORG,
        priceBook: priceBook(),
        priceBookItem: priceBookItem({ validFrom: "2026-02-31" }),
        quantity: { value: "1", unit: "M2" },
        citations: [citation()],
        risk: "LOW_RISK",
        origin: "GENERATED",
        asOfDate: "2026-08-12",
      }),
    ).toThrowError(/valid ISO calendar date/);
  });

  it("requires the frozen tax category rate", () => {
    expect(() =>
      createOfferLine({
        id: id("line-1"),
        organisationId: ORG,
        priceBook: priceBook(),
        priceBookItem: priceBookItem({ taxRateBasisPoints: 1_800 }),
        quantity: { value: "1", unit: "M2" },
        citations: [citation()],
        risk: "LOW_RISK",
        origin: "GENERATED",
        asOfDate: "2026-08-12",
      }),
    ).toThrowError(/requires 1900/);
  });

  it("allows a quantity edit without exposing a unit-price override", () => {
    const edited = editOfferLineQuantity({
      line: createLine(),
      priceBook: priceBook(),
      priceBookItem: priceBookItem(),
      quantity: { value: "50.5", unit: "M2" },
      asOfDate: "2026-08-12",
    });
    expect(edited.origin).toBe("EDITED");
    expect(edited.unitPrice.minor).toBe(1_290);
    expect(edited.netTotal.minor).toBe(65_145);
  });
});
