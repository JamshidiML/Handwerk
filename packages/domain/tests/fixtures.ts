import type {
  EntityId,
  IsoDateTime,
  Membership,
  OfferDraft,
  OfferDraftRevision,
  OrganisationId,
  PriceBook,
  PriceBookItem,
  SourceCitation,
  UserId,
} from "@handwerk/contracts";

import { createOfferDraftRevision, createOfferLine } from "../src/index";

export const NOW = "2026-08-12T10:00:00.000Z" as IsoDateTime;
export const LATER = "2026-08-12T10:05:00.000Z" as IsoDateTime;
export const ORG = "org-westblick" as OrganisationId;
export const OTHER_ORG = "org-other" as OrganisationId;
export const USER = "user-demo-owner" as UserId;

export function id(value: string): EntityId {
  return value as EntityId;
}

export function priceBook(overrides: Partial<PriceBook> = {}): PriceBook {
  return {
    id: id("pricebook-westblick"),
    organisationId: ORG,
    name: "Synthetic price book",
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

export function priceBookItem(
  overrides: Partial<PriceBookItem> = {},
): PriceBookItem {
  return {
    id: id("pb-item-wall"),
    organisationId: ORG,
    priceBookId: id("pricebook-westblick"),
    code: "MAL-WAND-2X",
    description: "Synthetic wall coating",
    category: "Malerarbeiten",
    unit: "M2",
    unitPrice: { currency: "EUR", minor: 1_290 },
    taxCategory: "STANDARD_19",
    taxRateBasisPoints: 1_900,
    active: true,
    validFrom: "2026-01-01",
    synonyms: [],
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

export function citation(
  overrides: Partial<SourceCitation> = {},
): SourceCitation {
  return {
    id: id("citation-wall-measurement"),
    organisationId: ORG,
    sourceType: "EXPLICIT_MEASUREMENT",
    sourceEntityId: id("measurement-wall"),
    locator: "measurement-wall",
    extractionVersion: "deterministic-v1",
    explanation: "Explicit synthetic wall measurement",
    authority: "AUTHORITATIVE",
    ...overrides,
  };
}

export function draft(overrides: Partial<OfferDraft> = {}): OfferDraft {
  return {
    id: id("draft-1"),
    organisationId: ORG,
    projectId: id("project-1"),
    state: "READY_FOR_REVIEW",
    currentRevision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    version: 4,
    ...overrides,
  };
}

export function revision(
  offerDraft = draft(),
  overrides: Partial<OfferDraftRevision> = {},
): OfferDraftRevision {
  const line = createOfferLine({
    id: id("line-wall"),
    organisationId: offerDraft.organisationId,
    priceBook: priceBook({ organisationId: offerDraft.organisationId }),
    priceBookItem: priceBookItem({
      organisationId: offerDraft.organisationId,
    }),
    quantity: { value: "52", unit: "M2" },
    citations: [citation({ organisationId: offerDraft.organisationId })],
    risk: "CONFIRMED",
    origin: "GENERATED",
    asOfDate: "2026-08-12",
  });
  return {
    ...createOfferDraftRevision({
      id: id(`revision-${offerDraft.currentRevision}`),
      draft: offerDraft,
      revision: offerDraft.currentRevision,
      lines: [line],
      createdByUserId: USER,
      now: NOW,
    }),
    ...overrides,
  };
}

export function membership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: id("membership-owner"),
    organisationId: ORG,
    userId: USER,
    role: "OWNER",
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}
