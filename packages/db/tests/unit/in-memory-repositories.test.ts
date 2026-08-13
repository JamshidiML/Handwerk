import type {
  Customer,
  OfferDraft,
  OrganisationId,
  PriceBook,
  PriceBookItem,
} from "@handwerk/contracts";
import {
  applyCommercialEdit,
  createOfferDraftRevision,
  createOfferLine,
  type EntityId,
  type IsoDateTime,
  type SourceCitation,
  type UserId,
} from "@handwerk/domain";
import { describe, expect, it } from "vitest";

import {
  InMemoryCustomerProjectRepository,
  InMemoryOfferDraftRepository,
  InMemoryPriceBookRepository,
} from "../../src/index";

const NOW = "2026-08-12T10:00:00.000Z" as IsoDateTime;
const ORG = "org-westblick" as OrganisationId;
const OTHER_ORG = "org-other" as OrganisationId;
const USER = "user-demo-owner" as UserId;
const id = (value: string) => value as EntityId;

const book: PriceBook = {
  id: id("book-1"),
  organisationId: ORG,
  name: "Synthetic book",
  active: true,
  createdAt: NOW,
  updatedAt: NOW,
  version: 1,
};
const item: PriceBookItem = {
  id: id("item-1"),
  organisationId: ORG,
  priceBookId: book.id,
  code: "SYN-M2",
  description: "Synthetic item",
  category: "Synthetic",
  unit: "M2",
  unitPrice: { currency: "EUR", minor: 100 },
  taxCategory: "STANDARD_19",
  taxRateBasisPoints: 1_900,
  active: true,
  synonyms: [],
  createdAt: NOW,
  updatedAt: NOW,
  version: 1,
};
const citation: SourceCitation = {
  id: id("citation-1"),
  organisationId: ORG,
  sourceType: "EXPLICIT_MEASUREMENT",
  sourceEntityId: id("measurement-1"),
  locator: "measurement-1",
  extractionVersion: "deterministic-v1",
  explanation: "Synthetic explicit measurement",
  authority: "AUTHORITATIVE",
};

function aggregateFixture() {
  const draft: OfferDraft = {
    id: id("draft-1"),
    organisationId: ORG,
    projectId: id("project-1"),
    state: "READY_FOR_REVIEW",
    currentRevision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
  const line = createOfferLine({
    id: id("line-1"),
    organisationId: ORG,
    priceBook: book,
    priceBookItem: item,
    quantity: { value: "1", unit: "M2" },
    citations: [citation],
    risk: "CONFIRMED",
    origin: "GENERATED",
    asOfDate: "2026-08-12",
  });
  const revision = createOfferDraftRevision({
    id: id("revision-1"),
    draft,
    revision: 1,
    lines: [line],
    createdByUserId: USER,
    now: NOW,
  });
  return { draft, revision };
}

describe("deterministic in-memory repositories", () => {
  it("returns the same null result for unknown and cross-tenant customers", async () => {
    const customer: Customer = {
      id: id("customer-1"),
      organisationId: ORG,
      displayName: "Synthetic Customer",
      synthetic: true,
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
    };
    const repository = new InMemoryCustomerProjectRepository({
      customers: [customer],
    });
    await expect(
      repository.findCustomer({ organisationId: ORG }, customer.id),
    ).resolves.toEqual(customer);
    await expect(
      repository.findCustomer({ organisationId: OTHER_ORG }, customer.id),
    ).resolves.toBeNull();
    await expect(
      repository.findCustomer({ organisationId: ORG }, id("missing")),
    ).resolves.toBeNull();
  });

  it("filters inactive, expired, and cross-tenant price-book items", async () => {
    const repository = new InMemoryPriceBookRepository(
      [book],
      [item, { ...item, id: id("expired"), validTo: "2025-01-01" }],
    );
    await expect(
      repository.findActiveItem({ organisationId: ORG }, item.id, "2026-08-12"),
    ).resolves.toEqual({ priceBook: book, item });
    await expect(
      repository.findActiveItem(
        { organisationId: OTHER_ORG },
        item.id,
        "2026-08-12",
      ),
    ).resolves.toBeNull();
    await expect(
      repository.findActiveItem(
        { organisationId: ORG },
        id("expired"),
        "2026-08-12",
      ),
    ).resolves.toBeNull();
  });

  it("enforces optimistic concurrency when persisting a commercial edit", async () => {
    const repository = new InMemoryOfferDraftRepository();
    const initial = aggregateFixture();
    await repository.create(
      { organisationId: ORG },
      initial.draft,
      initial.revision,
    );
    const edit = applyCommercialEdit({
      draft: initial.draft,
      currentRevision: initial.revision,
      expectedVersion: 1,
      revisionId: id("revision-2"),
      lines: initial.revision.lines,
      editedByUserId: USER,
      now: NOW,
    });
    await expect(
      repository.saveCommercialEdit({ organisationId: ORG }, 0, edit),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    await expect(
      repository.saveCommercialEdit({ organisationId: ORG }, 1, edit),
    ).resolves.toMatchObject({
      draft: { currentRevision: 2, version: 2, state: "READY_FOR_REVIEW" },
    });
  });

  it("does not reveal another tenant's draft", async () => {
    const repository = new InMemoryOfferDraftRepository();
    const initial = aggregateFixture();
    await repository.create(
      { organisationId: ORG },
      initial.draft,
      initial.revision,
    );
    await expect(
      repository.findAggregate({ organisationId: OTHER_ORG }, initial.draft.id),
    ).resolves.toBeNull();
  });
});
