import type {
  ConfidenceRisk,
  EntityId,
  HumanOrigin,
  IsoDateTime,
  OfferLine,
  OrganisationId,
  PriceBook,
  PriceBookItem,
  Quantity,
  SourceCitation,
  TaxCategory,
} from "@handwerk/contracts";

import { invariant } from "./errors";
import {
  assertCompatibleUnits,
  assertMoney,
  calculateLineAmounts,
  canonicalQuantity,
} from "./money";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const TAX_RATES: Readonly<Record<TaxCategory, number>> = {
  STANDARD_19: 1_900,
  REDUCED_7: 700,
  EXEMPT: 0,
};

function assertIsoDate(value: string): void {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  invariant(
    ISO_DATE_PATTERN.test(value) &&
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value,
    "INACTIVE_PRICE_BOOK_ITEM",
    "Price-book validity must use a valid ISO calendar date.",
  );
}

export function assertActivePriceBookItem(
  organisationId: OrganisationId,
  priceBook: PriceBook,
  item: PriceBookItem,
  asOfDate: string,
): void {
  assertIsoDate(asOfDate);
  invariant(
    priceBook.organisationId === organisationId &&
      item.organisationId === organisationId,
    "TENANT_MISMATCH",
    "Price book, item, and draft must belong to the same organisation.",
  );
  invariant(
    item.priceBookId === priceBook.id,
    "TENANT_MISMATCH",
    "Price-book item does not belong to the supplied price book.",
  );
  invariant(
    priceBook.active && item.active,
    "INACTIVE_PRICE_BOOK_ITEM",
    "Only active price books and active price-book items may be priced.",
  );

  if (item.validFrom !== undefined) {
    assertIsoDate(item.validFrom);
    invariant(
      item.validFrom <= asOfDate,
      "INACTIVE_PRICE_BOOK_ITEM",
      "Price-book item is not yet effective.",
    );
  }
  if (item.validTo !== undefined) {
    assertIsoDate(item.validTo);
    invariant(
      item.validTo >= asOfDate,
      "INACTIVE_PRICE_BOOK_ITEM",
      "Price-book item is no longer effective.",
    );
  }

  assertMoney(item.unitPrice);
  invariant(
    item.taxRateBasisPoints === TAX_RATES[item.taxCategory],
    "INVALID_MONEY",
    `Tax category ${item.taxCategory} requires ${TAX_RATES[item.taxCategory]} basis points.`,
  );
}

export interface CreateOfferLineInput {
  id: EntityId;
  organisationId: OrganisationId;
  priceBook: PriceBook;
  priceBookItem: PriceBookItem;
  quantity: Quantity;
  citations: readonly SourceCitation[];
  risk: ConfidenceRisk;
  origin: HumanOrigin;
  asOfDate: string;
}

export function createOfferLine(input: CreateOfferLineInput): OfferLine {
  const { priceBookItem: item } = input;
  assertActivePriceBookItem(
    input.organisationId,
    input.priceBook,
    item,
    input.asOfDate,
  );
  assertCompatibleUnits(input.quantity.unit, item.unit);
  invariant(
    input.citations.length > 0,
    "INVALID_REVISION",
    "Every commercial line requires at least one source citation.",
  );
  invariant(
    input.citations.some((citation) => citation.authority === "AUTHORITATIVE"),
    "INVALID_REVISION",
    "A commercial line requires authoritative evidence; photo context alone cannot support quantity.",
  );
  invariant(
    input.citations.every(
      (citation) => citation.organisationId === input.organisationId,
    ),
    "TENANT_MISMATCH",
    "Offer-line citations must belong to the draft organisation.",
  );

  const quantity = canonicalQuantity(input.quantity);
  const totals = calculateLineAmounts(
    item.unitPrice,
    quantity,
    item.taxRateBasisPoints,
  );

  return {
    id: input.id,
    organisationId: input.organisationId,
    priceBookItemId: item.id,
    itemCode: item.code,
    description: item.description,
    quantity,
    unitPrice: { ...item.unitPrice },
    ...totals,
    taxCategory: item.taxCategory,
    taxRateBasisPoints: item.taxRateBasisPoints,
    calculation: `${quantity.value} ${quantity.unit} x ${item.unitPrice.minor} EUR-Cent`,
    citations: [...input.citations],
    risk: input.risk,
    origin: input.origin,
  };
}

export interface EditOfferLineQuantityInput {
  line: OfferLine;
  priceBook: PriceBook;
  priceBookItem: PriceBookItem;
  quantity: Quantity;
  asOfDate: string;
}

export function editOfferLineQuantity(
  input: EditOfferLineQuantityInput,
): OfferLine {
  invariant(
    input.line.priceBookItemId === input.priceBookItem.id,
    "INVALID_REVISION",
    "A quantity edit cannot replace the approved price-book item.",
  );

  return createOfferLine({
    id: input.line.id,
    organisationId: input.line.organisationId,
    priceBook: input.priceBook,
    priceBookItem: input.priceBookItem,
    quantity: input.quantity,
    citations: input.line.citations,
    risk: input.line.risk,
    origin: "EDITED",
    asOfDate: input.asOfDate,
  });
}

export function asIsoDate(instant: IsoDateTime): string {
  return instant.slice(0, 10);
}
