import type {
  EntityId,
  HumanApproval,
  IsoDateTime,
  OfferDraft,
  OfferDraftRevision,
  OrganisationId,
  UserId,
} from "@handwerk/contracts";

const organisationId = "org-westblick" as OrganisationId;
const offerDraftId = "offer-review-synthetic" as EntityId;
const userId = "user-review-synthetic" as UserId;
const now = "2026-08-12T09:30:00.000Z" as IsoDateTime;

export function createSyntheticReviewInput(): {
  draft: OfferDraft;
  revision: OfferDraftRevision;
  approval: HumanApproval;
} {
  const revision: OfferDraftRevision = {
    id: "revision-review-synthetic-3" as EntityId,
    organisationId,
    offerDraftId,
    revision: 3,
    lines: [
      {
        id: "line-review-synthetic-1" as EntityId,
        organisationId,
        priceBookItemId: "price-item-review-synthetic-1" as EntityId,
        itemCode: "WB-001",
        description: "Wandflächen zweimal weiß beschichten",
        quantity: { value: "52", unit: "M2" },
        unitPrice: { currency: "EUR", minor: 1099 },
        netTotal: { currency: "EUR", minor: 57148 },
        taxCategory: "STANDARD_19",
        taxRateBasisPoints: 1900,
        taxTotal: { currency: "EUR", minor: 10858 },
        grossTotal: { currency: "EUR", minor: 68006 },
        calculation: "52 M2 × 10.99 EUR",
        citations: [
          {
            id: "citation-review-synthetic-1" as EntityId,
            organisationId,
            sourceType: "EXPLICIT_MEASUREMENT",
            sourceEntityId: "measurement-review-synthetic-1" as EntityId,
            locator: "measurement:wall-area",
            extractionVersion: "deterministic-fixture-v1",
            explanation:
              "Explizit eingegebene und bestätigte synthetische Messung",
            authority: "AUTHORITATIVE",
          },
        ],
        risk: "CONFIRMED",
        origin: "CONFIRMED",
      },
    ],
    excludedItems: [
      {
        key: "Deckenfläche 20 m²",
        reason: "Auf ausdrückliche Rückfrage ausgeschlossen.",
        citations: [],
      },
    ],
    unmatchedItems: [
      {
        key: "Beschädigte Sockelleiste",
        reason: "Kein aktiver freigegebener Preisbuch-Eintrag vorhanden.",
        citations: [],
      },
    ],
    netTotal: { currency: "EUR", minor: 57148 },
    taxTotal: { currency: "EUR", minor: 10858 },
    grossTotal: { currency: "EUR", minor: 68006 },
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
  const draft: OfferDraft = {
    id: offerDraftId,
    organisationId,
    projectId: "project-wohnzimmer-bochum" as EntityId,
    state: "APPROVED",
    currentRevision: 3,
    approvedRevision: 3,
    createdAt: now,
    updatedAt: now,
    version: 4,
  };
  const approval: HumanApproval = {
    id: "approval-review-synthetic-3" as EntityId,
    organisationId,
    offerDraftId,
    revision: 3,
    approvedByUserId: userId,
    confirmationText:
      "Ich habe Umfang, Mengen, Preise und Ausschlüsse der aktuellen Revision geprüft.",
    approvedAt: now,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
  return { draft, revision, approval };
}
