import type {
  HumanApproval,
  Money,
  OfferDraft,
  OfferDraftRevision,
  OfferLine,
} from "@handwerk/contracts";
import {
  calculateLineAmounts,
  normalizeQuantityValue,
  sumSafeMinor,
} from "./money";
import {
  APPROVAL_CONFIRMATION_TEXT,
  type ApprovalInput,
  type ApprovedRevisionResult,
  type CommercialChange,
  type ExportAuthorizationInput,
  type ExportBlocker,
  type ExportDecision,
  type QuantityEditInput,
  type QuantityEditResult,
  type RevisionSummary,
} from "./types";

function moneyMatches(left: Money, right: Money): boolean {
  return left.currency === right.currency && left.minor === right.minor;
}

function lineCommercialBlockers(
  line: OfferLine,
  organisationId: OfferDraft["organisationId"],
): ExportBlocker[] {
  const blockers: ExportBlocker[] = [];
  if (line.organisationId !== organisationId) {
    blockers.push({
      code: "INVALID_REVISION",
      message: `Position ${line.itemCode} gehört nicht zur Organisation des Angebots.`,
    });
  }
  if (
    line.citations.length === 0 ||
    line.citations.some(
      (citation) => citation.organisationId !== organisationId,
    )
  ) {
    blockers.push({
      code: "MISSING_LINE_EVIDENCE",
      message: `Position ${line.itemCode} hat keinen gültigen Nachweis.`,
    });
  }
  const expectedTaxRate = {
    STANDARD_19: 1900,
    REDUCED_7: 700,
    EXEMPT: 0,
  }[line.taxCategory];
  if (line.taxRateBasisPoints !== expectedTaxRate) {
    blockers.push({
      code: "INVALID_COMMERCIAL_TOTALS",
      message: `Position ${line.itemCode} enthält eine widersprüchliche Steuerbehandlung.`,
    });
  }

  try {
    const expected = calculateLineAmounts(
      line.quantity,
      line.unitPrice,
      line.taxRateBasisPoints,
    );
    if (
      !moneyMatches(expected.netTotal, line.netTotal) ||
      !moneyMatches(expected.taxTotal, line.taxTotal) ||
      !moneyMatches(expected.grossTotal, line.grossTotal)
    ) {
      blockers.push({
        code: "INVALID_COMMERCIAL_TOTALS",
        message: `Position ${line.itemCode} enthält nicht nachvollziehbare Summen.`,
      });
    }
  } catch {
    blockers.push({
      code: "INVALID_COMMERCIAL_TOTALS",
      message: `Position ${line.itemCode} enthält ungültige Mengen- oder Geldwerte.`,
    });
  }
  return blockers;
}

function revisionBlockers(
  draft: OfferDraft,
  revision: OfferDraftRevision,
): ExportBlocker[] {
  const blockers: ExportBlocker[] = [];
  if (
    revision.offerDraftId !== draft.id ||
    revision.organisationId !== draft.organisationId ||
    revision.revision !== draft.currentRevision
  ) {
    blockers.push({
      code: "INVALID_REVISION",
      message: "Die geprüfte Revision ist nicht die aktuelle Angebotsrevision.",
    });
  }
  if (revision.lines.length === 0) {
    blockers.push({
      code: "NO_PRICED_LINES",
      message:
        "Ein Angebot ohne bepreiste Positionen kann nicht exportiert werden.",
    });
  }
  blockers.push(
    ...revision.lines.flatMap((line) =>
      lineCommercialBlockers(line, draft.organisationId),
    ),
  );

  let expectedNet: number;
  let expectedTax: number;
  let expectedGross: number;
  try {
    expectedNet = sumSafeMinor(
      revision.lines.map((line) => line.netTotal.minor),
    );
    expectedTax = sumSafeMinor(
      revision.lines.map((line) => line.taxTotal.minor),
    );
    expectedGross = sumSafeMinor(
      revision.lines.map((line) => line.grossTotal.minor),
    );
  } catch {
    blockers.push({
      code: "INVALID_COMMERCIAL_TOTALS",
      message: "Die Angebotssummen enthalten ungültige Geldwerte.",
    });
    return blockers;
  }
  if (
    revision.netTotal.currency !== "EUR" ||
    revision.taxTotal.currency !== "EUR" ||
    revision.grossTotal.currency !== "EUR" ||
    revision.netTotal.minor !== expectedNet ||
    revision.taxTotal.minor !== expectedTax ||
    revision.grossTotal.minor !== expectedGross ||
    expectedGross !== expectedNet + expectedTax
  ) {
    blockers.push({
      code: "INVALID_COMMERCIAL_TOTALS",
      message:
        "Die Angebotssummen stimmen nicht mit den Positionssummen überein.",
    });
  }
  return blockers;
}

export function getExportDecision(
  input: ExportAuthorizationInput,
): ExportDecision {
  const blockers = revisionBlockers(input.draft, input.revision);
  if (input.unresolvedCriticalQuestionIds.length > 0) {
    blockers.push({
      code: "UNRESOLVED_CRITICAL_QUESTIONS",
      message: "Kritische Rückfragen müssen vor dem Export beantwortet werden.",
    });
  }

  const { approval, draft, revision } = input;
  if (!approval) {
    blockers.push({
      code: "APPROVAL_REQUIRED",
      message:
        "Die aktuelle Revision benötigt eine ausdrückliche menschliche Freigabe.",
    });
  } else if (approval.invalidatedAt) {
    blockers.push({
      code: "APPROVAL_INVALIDATED",
      message:
        "Die Freigabe wurde durch eine spätere kommerzielle Änderung ungültig.",
    });
  } else if (
    approval.offerDraftId !== draft.id ||
    approval.organisationId !== draft.organisationId ||
    approval.revision !== revision.revision ||
    draft.approvedRevision !== revision.revision
  ) {
    blockers.push({
      code: "STALE_APPROVAL",
      message: "Die vorhandene Freigabe gehört nicht zur aktuellen Revision.",
    });
  } else if (
    approval.confirmationText !== APPROVAL_CONFIRMATION_TEXT ||
    (draft.state !== "APPROVED" && draft.state !== "EXPORTED")
  ) {
    blockers.push({
      code: "APPROVAL_REQUIRED",
      message:
        "Die aktuelle Revision wurde nicht mit der erforderlichen Bestätigung freigegeben.",
    });
  }

  return blockers.length === 0
    ? { allowed: true, revision: revision.revision }
    : { allowed: false, blockers };
}

export class ExportBlockedError extends Error {
  readonly blockers: readonly ExportBlocker[];

  constructor(blockers: readonly ExportBlocker[]) {
    super(blockers.map((blocker) => blocker.message).join(" "));
    this.name = "ExportBlockedError";
    this.blockers = blockers;
  }
}

export function assertExportAllowed(input: ExportAuthorizationInput): void {
  const decision = getExportDecision(input);
  if (!decision.allowed) {
    throw new ExportBlockedError(decision.blockers);
  }
}

export function approveCurrentRevision(
  input: ApprovalInput,
): ApprovedRevisionResult {
  if (!input.confirmed) {
    throw new ExportBlockedError([
      {
        code: "APPROVAL_REQUIRED",
        message: "Die ausdrückliche Bestätigung wurde nicht erteilt.",
      },
    ]);
  }
  if (input.draft.state !== "READY_FOR_REVIEW") {
    throw new ExportBlockedError([
      {
        code: "INVALID_REVISION",
        message:
          "Nur eine prüfbereite aktuelle Revision kann freigegeben werden.",
      },
    ]);
  }

  const blockers = revisionBlockers(input.draft, input.revision);
  if (input.unresolvedCriticalQuestionIds.length > 0) {
    blockers.push({
      code: "UNRESOLVED_CRITICAL_QUESTIONS",
      message:
        "Kritische Rückfragen müssen vor der Freigabe beantwortet werden.",
    });
  }
  if (blockers.length > 0) {
    throw new ExportBlockedError(blockers);
  }

  const approval: HumanApproval = {
    id: input.approvalId,
    organisationId: input.draft.organisationId,
    offerDraftId: input.draft.id,
    revision: input.revision.revision,
    approvedByUserId: input.approvedByUserId,
    confirmationText: APPROVAL_CONFIRMATION_TEXT,
    approvedAt: input.approvedAt,
    createdAt: input.approvedAt,
    updatedAt: input.approvedAt,
    version: 1,
  };

  return {
    draft: {
      ...input.draft,
      state: "APPROVED",
      approvedRevision: input.revision.revision,
      updatedAt: input.approvedAt,
      version: input.draft.version + 1,
    },
    approval,
  };
}

function setSignature(
  items: readonly { key: string; reason: string }[],
): string {
  return [...items]
    .map((item) => `${item.key}\u0000${item.reason}`)
    .sort()
    .join("\u0001");
}

export function summarizeRevisionChanges(
  previous: OfferDraftRevision,
  current: OfferDraftRevision,
): RevisionSummary {
  const changes: CommercialChange[] = [];
  const previousLines = new Map(previous.lines.map((line) => [line.id, line]));
  const currentLines = new Map(current.lines.map((line) => [line.id, line]));

  for (const line of previous.lines) {
    const next = currentLines.get(line.id);
    if (!next) {
      changes.push({
        kind: "LINE_REMOVED",
        lineId: line.id,
        itemCode: line.itemCode,
        summary: `${line.itemCode} entfernt`,
      });
      continue;
    }
    if (
      line.quantity.value !== next.quantity.value ||
      line.quantity.unit !== next.quantity.unit
    ) {
      changes.push({
        kind: "QUANTITY_CHANGED",
        lineId: line.id,
        itemCode: line.itemCode,
        summary: `${line.itemCode}: Menge ${line.quantity.value} ${line.quantity.unit} → ${next.quantity.value} ${next.quantity.unit}`,
      });
    }
    if (!moneyMatches(line.unitPrice, next.unitPrice)) {
      changes.push({
        kind: "PRICE_CHANGED",
        lineId: line.id,
        itemCode: line.itemCode,
        summary: `${line.itemCode}: Einheitspreis geändert`,
      });
    }
    if (
      line.taxCategory !== next.taxCategory ||
      line.taxRateBasisPoints !== next.taxRateBasisPoints
    ) {
      changes.push({
        kind: "TAX_CHANGED",
        lineId: line.id,
        itemCode: line.itemCode,
        summary: `${line.itemCode}: Steuerbehandlung geändert`,
      });
    }
    if (
      line.description !== next.description ||
      line.priceBookItemId !== next.priceBookItemId
    ) {
      changes.push({
        kind: "DESCRIPTION_CHANGED",
        lineId: line.id,
        itemCode: line.itemCode,
        summary: `${line.itemCode}: Leistungsumfang geändert`,
      });
    }
  }

  for (const line of current.lines) {
    if (!previousLines.has(line.id)) {
      changes.push({
        kind: "LINE_ADDED",
        lineId: line.id,
        itemCode: line.itemCode,
        summary: `${line.itemCode} hinzugefügt`,
      });
    }
  }
  if (
    setSignature(previous.excludedItems) !== setSignature(current.excludedItems)
  ) {
    changes.push({
      kind: "EXCLUSION_CHANGED",
      summary: "Ausschlüsse wurden geändert",
    });
  }
  if (
    setSignature(previous.unmatchedItems) !==
    setSignature(current.unmatchedItems)
  ) {
    changes.push({
      kind: "UNMATCHED_CHANGED",
      summary: "Nicht zugeordnete Leistungen wurden geändert",
    });
  }

  return {
    fromRevision: previous.revision,
    toRevision: current.revision,
    hasCommercialChanges: changes.length > 0,
    changes,
    netDeltaMinor: current.netTotal.minor - previous.netTotal.minor,
    taxDeltaMinor: current.taxTotal.minor - previous.taxTotal.minor,
    grossDeltaMinor: current.grossTotal.minor - previous.grossTotal.minor,
  };
}

function withRevisionTotals(
  revision: OfferDraftRevision,
  lines: readonly OfferLine[],
): OfferDraftRevision {
  return {
    ...revision,
    lines: [...lines],
    netTotal: {
      currency: "EUR",
      minor: sumSafeMinor(lines.map((line) => line.netTotal.minor)),
    },
    taxTotal: {
      currency: "EUR",
      minor: sumSafeMinor(lines.map((line) => line.taxTotal.minor)),
    },
    grossTotal: {
      currency: "EUR",
      minor: sumSafeMinor(lines.map((line) => line.grossTotal.minor)),
    },
  };
}

export function applyQuantityEdit(
  input: QuantityEditInput,
): QuantityEditResult {
  if (
    input.revision.offerDraftId !== input.draft.id ||
    input.revision.revision !== input.draft.currentRevision
  ) {
    throw new ExportBlockedError([
      {
        code: "INVALID_REVISION",
        message: "Die Bearbeitung basiert nicht auf der aktuellen Revision.",
      },
    ]);
  }
  if (
    input.draft.state !== "READY_FOR_REVIEW" &&
    input.draft.state !== "APPROVED" &&
    input.draft.state !== "EXPORTED"
  ) {
    throw new ExportBlockedError([
      {
        code: "INVALID_REVISION",
        message:
          "Positionen können nur in einer prüfbaren Angebotsrevision bearbeitet werden.",
      },
    ]);
  }
  const line = input.revision.lines.find(
    (candidate) => candidate.id === input.lineId,
  );
  if (!line) {
    throw new RangeError("Die zu bearbeitende Position wurde nicht gefunden.");
  }
  const normalizedQuantity = normalizeQuantityValue(
    input.quantityValue,
    line.quantity.unit,
  );
  if (normalizedQuantity === line.quantity.value) {
    return {
      changed: false,
      draft: input.draft,
      revision: input.revision,
      summary: summarizeRevisionChanges(input.revision, input.revision),
    };
  }

  const quantity = { ...line.quantity, value: normalizedQuantity };
  const updatedLine: OfferLine = {
    ...line,
    quantity,
    ...calculateLineAmounts(quantity, line.unitPrice, line.taxRateBasisPoints),
    origin: "EDITED",
  };
  const nextRevisionBase: OfferDraftRevision = {
    ...input.revision,
    id: input.revisionId,
    revision: input.revision.revision + 1,
    createdAt: input.editedAt,
    updatedAt: input.editedAt,
    version: 1,
    createdByUserId: input.createdByUserId,
    lines: input.revision.lines.map((candidate) =>
      candidate.id === line.id ? updatedLine : candidate,
    ),
  };
  const nextRevision = withRevisionTotals(
    nextRevisionBase,
    nextRevisionBase.lines,
  );
  const { approvedRevision: _approvedRevision, ...draftWithoutApproval } =
    input.draft;
  const nextDraft: OfferDraft = {
    ...draftWithoutApproval,
    state: "READY_FOR_REVIEW",
    currentRevision: nextRevision.revision,
    updatedAt: input.editedAt,
    version: input.draft.version + 1,
  };
  const invalidatedApproval = input.approval
    ? {
        ...input.approval,
        invalidatedAt: input.approval.invalidatedAt ?? input.editedAt,
        invalidationReason:
          input.approval.invalidationReason ??
          `Menge der Position ${line.itemCode} wurde in Revision ${nextRevision.revision} geändert.`,
        updatedAt: input.editedAt,
        version:
          input.approval.version + (input.approval.invalidatedAt ? 0 : 1),
      }
    : undefined;

  return {
    changed: true,
    draft: nextDraft,
    revision: nextRevision,
    ...(invalidatedApproval ? { invalidatedApproval } : {}),
    summary: summarizeRevisionChanges(input.revision, nextRevision),
  };
}
