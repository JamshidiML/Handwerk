import type {
  EntityId,
  HumanApproval,
  IsoDateTime,
  OfferDraft,
  OfferDraftRevision,
  OfferLine,
  OrganisationId,
  SourceCitation,
  UserId,
} from "@handwerk/contracts";
import { calculateLineAmounts, sumSafeMinor } from "../src/money";
import {
  APPROVAL_CONFIRMATION_TEXT,
  type ApprovedOfferExportInput,
} from "../src/types";

const organisationId = "org-westblick" as OrganisationId;
const offerDraftId = "offer-synthetic-westblick" as EntityId;
const userId = "user-synthetic-reviewer" as UserId;
const issuedAt = "2026-08-12T09:30:00.000Z" as IsoDateTime;

function id(value: string): EntityId {
  return value as EntityId;
}

function citation(index: number): SourceCitation {
  return {
    id: id(`citation-synthetic-${index}`),
    organisationId,
    sourceType: index % 2 === 0 ? "EXPLICIT_MEASUREMENT" : "USER_ANSWER",
    sourceEntityId: id(`source-synthetic-${index}`),
    locator: index % 2 === 0 ? `measurement:${index}` : `answer:${index}`,
    extractionVersion: "deterministic-fixture-v1",
    explanation:
      index % 2 === 0
        ? "Explizit eingegebene und bestätigte synthetische Messung"
        : "Bestätigte synthetische Rückfrage",
    authority: "AUTHORITATIVE",
  };
}

const LONG_DESCRIPTION =
  "Synthetische Leistungsbeschreibung für sorgfältiges Beschichten von Wandflächen in Küche, Flur und Übergangsbereich: Untergrund prüfen, Fläche staubfrei vorbereiten und gleichmäßig mit emissionsarmer weißer Dispersionsfarbe bearbeiten. Anschlüsse an Türzargen, Fußleisten und Fensterlaibungen sauber ausführen; örtliche Besonderheiten und ausdrücklich bestätigte Maße bleiben nachvollziehbar. Äußere Kanten, größere Übergänge und übliche Unebenheiten werden übersichtlich dokumentiert.";

function line(
  index: number,
  longDescriptions: boolean,
  descriptionOverride?: string,
): OfferLine {
  const quantity = {
    value: index === 0 ? "52" : `${index + 1}`,
    unit: index === 0 ? "M2" : "STK",
  } as const;
  const unitPrice = {
    currency: "EUR",
    minor: index === 0 ? 1099 : 525 + index * 25,
  } as const;
  const amounts = calculateLineAmounts(quantity, unitPrice, 1900);
  return {
    id: id(`offer-line-synthetic-${index}`),
    organisationId,
    priceBookItemId: id(`price-book-item-synthetic-${index}`),
    itemCode: `WB-${String(index + 1).padStart(3, "0")}`,
    description:
      descriptionOverride ??
      (longDescriptions
        ? `${LONG_DESCRIPTION} Position ${index + 1}. Überprüfung mit Umlauten: ä, ö, ü, Ä, Ö, Ü und ß.`
        : index === 0
          ? "Wandflächen zweimal weiß beschichten"
          : `Synthetische Schutz- und Nebenleistung ${index + 1}`),
    quantity,
    unitPrice,
    ...amounts,
    taxCategory: "STANDARD_19",
    taxRateBasisPoints: 1900,
    citations: [citation(index)],
    risk: index === 0 ? "CONFIRMED" : "LOW_RISK",
    origin: index === 0 ? "CONFIRMED" : "GENERATED",
  };
}

export interface SyntheticOfferOptions {
  lineCount?: number;
  longDescriptions?: boolean;
  descriptionOverride?: string;
}

export function createSyntheticApprovedExportInput(
  options: SyntheticOfferOptions = {},
): ApprovedOfferExportInput {
  const lines = Array.from({ length: options.lineCount ?? 3 }, (_, index) =>
    line(index, options.longDescriptions ?? false, options.descriptionOverride),
  );
  const revision: OfferDraftRevision = {
    id: id("offer-revision-synthetic-3"),
    organisationId,
    offerDraftId,
    revision: 3,
    lines,
    excludedItems: [
      {
        key: "Deckenfläche 20 m²",
        reason:
          "Auf ausdrückliche Rückfrage vom Leistungsumfang ausgeschlossen.",
        citations: [citation(101)],
      },
    ],
    unmatchedItems: [
      {
        key: "Beschädigte Sockelleiste",
        reason:
          "Kein aktiver freigegebener Preisbuch-Eintrag vorhanden; daher nicht bepreist.",
        citations: [citation(102)],
      },
    ],
    netTotal: {
      currency: "EUR",
      minor: sumSafeMinor(lines.map((item) => item.netTotal.minor)),
    },
    taxTotal: {
      currency: "EUR",
      minor: sumSafeMinor(lines.map((item) => item.taxTotal.minor)),
    },
    grossTotal: {
      currency: "EUR",
      minor: sumSafeMinor(lines.map((item) => item.grossTotal.minor)),
    },
    createdByUserId: userId,
    createdAt: issuedAt,
    updatedAt: issuedAt,
    version: 1,
  };
  const draft: OfferDraft = {
    id: offerDraftId,
    organisationId,
    projectId: id("project-wohnzimmer-bochum"),
    state: "APPROVED",
    currentRevision: 3,
    approvedRevision: 3,
    createdAt: issuedAt,
    updatedAt: issuedAt,
    version: 4,
  };
  const approval: HumanApproval = {
    id: id("approval-synthetic-revision-3"),
    organisationId,
    offerDraftId,
    revision: 3,
    approvedByUserId: userId,
    confirmationText: APPROVAL_CONFIRMATION_TEXT,
    approvedAt: issuedAt,
    createdAt: issuedAt,
    updatedAt: issuedAt,
    version: 1,
  };

  return {
    draft,
    revision,
    approval,
    unresolvedCriticalQuestionIds: [],
    organisationName: "Malerbetrieb Westblick GmbH",
    recipientName: "Anna Becker (synthetisch)",
    projectName: "Wohnzimmer renovieren",
    projectLocation: "Bochum - synthetisches Projekt",
    offerNumber: "SYN-WB-2026-0007",
    issuedAt,
    notes: [
      "Dieses Dokument enthält ausschließlich synthetische Demo-Daten.",
      "Ausgeschlossene und nicht zugeordnete Leistungen sind nicht Bestandteil der Gesamtsumme.",
    ],
    synthetic: true,
    artifactIds: {
      pdf: id("export-pdf-synthetic-1"),
      csv: id("export-csv-synthetic-1"),
    },
  };
}
