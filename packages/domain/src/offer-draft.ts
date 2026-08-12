import {
  VALID_DRAFT_TRANSITIONS,
  type DraftState,
  type EntityId,
  type HumanApproval,
  type IsoDateTime,
  type Membership,
  type OfferDraft,
  type OfferDraftRevision,
  type OfferLine,
  type UserId,
} from "@handwerk/contracts";

import { invariant } from "./errors";
import { calculateLineAmounts, calculateOfferTotals } from "./money";

export function assertExpectedVersion(
  actualVersion: number,
  expectedVersion: number,
): void {
  invariant(
    Number.isInteger(expectedVersion) && actualVersion === expectedVersion,
    "VERSION_CONFLICT",
    `Expected version ${expectedVersion}, but found ${actualVersion}.`,
  );
}

function withoutApproval(
  draft: OfferDraft,
): Omit<OfferDraft, "approvedRevision"> {
  const { approvedRevision: _approvedRevision, ...unapproved } = draft;
  return unapproved;
}

export interface TransitionDraftOptions {
  expectedVersion: number;
  now: IsoDateTime;
  approvedRevision?: number;
}

export function transitionOfferDraft(
  draft: OfferDraft,
  target: DraftState,
  options: TransitionDraftOptions,
): OfferDraft {
  assertExpectedVersion(draft.version, options.expectedVersion);
  invariant(
    VALID_DRAFT_TRANSITIONS[draft.state].includes(target),
    "INVALID_STATE_TRANSITION",
    `Draft cannot transition from ${draft.state} to ${target}.`,
  );
  invariant(
    !(
      target === "READY_FOR_REVIEW" &&
      (draft.state === "APPROVED" || draft.state === "EXPORTED")
    ),
    "INVALID_STATE_TRANSITION",
    "Leaving an approved state requires applyCommercialEdit so a new revision is created.",
  );

  if (target === "APPROVED") {
    invariant(
      options.approvedRevision === draft.currentRevision,
      "INVALID_APPROVAL",
      "Approval must bind to the current draft revision.",
    );
    return {
      ...draft,
      state: target,
      approvedRevision: draft.currentRevision,
      updatedAt: options.now,
      version: draft.version + 1,
    };
  }

  const next = {
    ...withoutApproval(draft),
    state: target,
    updatedAt: options.now,
    version: draft.version + 1,
  };
  if (target === "EXPORTED") {
    invariant(
      draft.approvedRevision === draft.currentRevision,
      "APPROVAL_REQUIRED",
      "Only the currently approved revision can be exported.",
    );
    return { ...next, approvedRevision: draft.currentRevision };
  }
  return next;
}

export function assertOfferLineIntegrity(
  line: OfferLine,
  organisationId: OfferDraft["organisationId"],
): void {
  invariant(
    line.organisationId === organisationId &&
      line.citations.every(
        (citation) => citation.organisationId === organisationId,
      ),
    "TENANT_MISMATCH",
    "Offer line and citations must belong to the draft organisation.",
  );
  invariant(
    line.citations.length > 0,
    "INVALID_REVISION",
    "A commercial line cannot exist without evidence.",
  );

  const expected = calculateLineAmounts(
    line.unitPrice,
    line.quantity,
    line.taxRateBasisPoints,
  );
  invariant(
    expected.netTotal.minor === line.netTotal.minor &&
      expected.taxTotal.minor === line.taxTotal.minor &&
      expected.grossTotal.minor === line.grossTotal.minor,
    "INVALID_REVISION",
    "Offer-line totals do not match the exact commercial calculation.",
  );
}

export function assertRevisionIntegrity(
  draft: OfferDraft,
  revision: OfferDraftRevision,
): void {
  invariant(
    revision.organisationId === draft.organisationId &&
      revision.offerDraftId === draft.id,
    "TENANT_MISMATCH",
    "Revision and draft must belong to the same organisation and aggregate.",
  );
  invariant(
    revision.revision === draft.currentRevision,
    "INVALID_REVISION",
    "Revision number must match the draft current revision.",
  );
  revision.lines.forEach((line) =>
    assertOfferLineIntegrity(line, draft.organisationId),
  );

  const totals = calculateOfferTotals(revision.lines);
  invariant(
    totals.netTotal.minor === revision.netTotal.minor &&
      totals.taxTotal.minor === revision.taxTotal.minor &&
      totals.grossTotal.minor === revision.grossTotal.minor,
    "INVALID_REVISION",
    "Revision totals must equal the sum of rounded line totals.",
  );
}

export interface CreateRevisionInput {
  id: EntityId;
  draft: OfferDraft;
  revision: number;
  lines: readonly OfferLine[];
  excludedItems?: OfferDraftRevision["excludedItems"];
  unmatchedItems?: OfferDraftRevision["unmatchedItems"];
  createdByUserId: UserId;
  now: IsoDateTime;
}

export function createOfferDraftRevision(
  input: CreateRevisionInput,
): OfferDraftRevision {
  invariant(
    Number.isInteger(input.revision) && input.revision > 0,
    "INVALID_REVISION",
    "Draft revision numbers are positive integers.",
  );
  input.lines.forEach((line) =>
    assertOfferLineIntegrity(line, input.draft.organisationId),
  );
  const totals = calculateOfferTotals(input.lines);

  return {
    id: input.id,
    organisationId: input.draft.organisationId,
    offerDraftId: input.draft.id,
    revision: input.revision,
    lines: [...input.lines],
    excludedItems: input.excludedItems ?? [],
    unmatchedItems: input.unmatchedItems ?? [],
    ...totals,
    createdByUserId: input.createdByUserId,
    createdAt: input.now,
    updatedAt: input.now,
    version: 1,
  };
}

export interface CommercialEditInput {
  draft: OfferDraft;
  currentRevision: OfferDraftRevision;
  expectedVersion: number;
  revisionId: EntityId;
  lines: readonly OfferLine[];
  editedByUserId: UserId;
  now: IsoDateTime;
  activeApproval?: HumanApproval;
  excludedItems?: OfferDraftRevision["excludedItems"];
  unmatchedItems?: OfferDraftRevision["unmatchedItems"];
}

export interface CommercialEditResult {
  draft: OfferDraft;
  revision: OfferDraftRevision;
  invalidatedApproval?: HumanApproval;
}

export function applyCommercialEdit(
  input: CommercialEditInput,
): CommercialEditResult {
  assertExpectedVersion(input.draft.version, input.expectedVersion);
  assertRevisionIntegrity(input.draft, input.currentRevision);
  invariant(
    ["READY_FOR_REVIEW", "APPROVED", "EXPORTED"].includes(input.draft.state),
    "INVALID_STATE_TRANSITION",
    `Commercial edits are not allowed while a draft is ${input.draft.state}.`,
  );

  if (input.activeApproval !== undefined) {
    invariant(
      input.activeApproval.organisationId === input.draft.organisationId &&
        input.activeApproval.offerDraftId === input.draft.id &&
        input.activeApproval.revision === input.draft.currentRevision &&
        input.activeApproval.invalidatedAt === undefined,
      "INVALID_APPROVAL",
      "Only the active approval for the current revision can be invalidated.",
    );
  }
  invariant(
    input.draft.approvedRevision === undefined ||
      input.activeApproval !== undefined,
    "INVALID_APPROVAL",
    "A commercial edit of an approved revision must invalidate its active approval.",
  );

  const nextDraft: OfferDraft = {
    ...withoutApproval(input.draft),
    state: "READY_FOR_REVIEW",
    currentRevision: input.draft.currentRevision + 1,
    updatedAt: input.now,
    version: input.draft.version + 1,
  };
  const revision = createOfferDraftRevision({
    id: input.revisionId,
    draft: nextDraft,
    revision: nextDraft.currentRevision,
    lines: input.lines,
    excludedItems: input.excludedItems ?? input.currentRevision.excludedItems,
    unmatchedItems:
      input.unmatchedItems ?? input.currentRevision.unmatchedItems,
    createdByUserId: input.editedByUserId,
    now: input.now,
  });

  if (input.activeApproval === undefined) {
    return { draft: nextDraft, revision };
  }

  return {
    draft: nextDraft,
    revision,
    invalidatedApproval: {
      ...input.activeApproval,
      invalidatedAt: input.now,
      invalidationReason: "COMMERCIAL_EDIT",
      updatedAt: input.now,
      version: input.activeApproval.version + 1,
    },
  };
}

export interface ApproveDraftInput {
  id: EntityId;
  draft: OfferDraft;
  revision: OfferDraftRevision;
  membership: Membership;
  expectedVersion: number;
  approvedByUserId: UserId;
  confirmationText: string;
  unresolvedBlockingQuestions: number;
  now: IsoDateTime;
}

export interface ApproveDraftResult {
  draft: OfferDraft;
  approval: HumanApproval;
}

export function approveOfferDraft(
  input: ApproveDraftInput,
): ApproveDraftResult {
  assertExpectedVersion(input.draft.version, input.expectedVersion);
  assertRevisionIntegrity(input.draft, input.revision);
  invariant(
    input.draft.state === "READY_FOR_REVIEW",
    "INVALID_STATE_TRANSITION",
    "Only a review-ready draft can be approved.",
  );
  invariant(
    input.unresolvedBlockingQuestions === 0,
    "UNRESOLVED_CLARIFICATION",
    "Blocking clarification questions must be resolved before approval.",
  );
  invariant(
    input.membership.organisationId === input.draft.organisationId &&
      input.membership.userId === input.approvedByUserId,
    "TENANT_MISMATCH",
    "Approver membership must belong to the draft organisation.",
  );
  invariant(
    input.membership.active &&
      ["OWNER", "REVIEWER"].includes(input.membership.role),
    "INVALID_APPROVAL",
    "An active owner or reviewer membership is required for approval.",
  );
  invariant(
    input.confirmationText.trim().length >= 10,
    "INVALID_APPROVAL",
    "Approval requires an explicit human confirmation statement.",
  );

  const draft = transitionOfferDraft(input.draft, "APPROVED", {
    expectedVersion: input.expectedVersion,
    approvedRevision: input.draft.currentRevision,
    now: input.now,
  });
  return {
    draft,
    approval: {
      id: input.id,
      organisationId: input.draft.organisationId,
      offerDraftId: input.draft.id,
      revision: input.draft.currentRevision,
      approvedByUserId: input.approvedByUserId,
      confirmationText: input.confirmationText.trim(),
      approvedAt: input.now,
      createdAt: input.now,
      updatedAt: input.now,
      version: 1,
    },
  };
}

export function assertExportAuthorized(
  draft: OfferDraft,
  approval: HumanApproval | undefined,
): asserts approval is HumanApproval {
  invariant(
    draft.state === "APPROVED" || draft.state === "EXPORTED",
    "APPROVAL_REQUIRED",
    "Draft export requires current human approval.",
  );
  invariant(
    draft.approvedRevision === draft.currentRevision &&
      approval !== undefined &&
      approval.organisationId === draft.organisationId &&
      approval.offerDraftId === draft.id &&
      approval.revision === draft.currentRevision &&
      approval.invalidatedAt === undefined,
    "APPROVAL_REQUIRED",
    "Draft approval is absent, stale, invalidated, or belongs to another tenant.",
  );
}

export function markOfferDraftExported(
  draft: OfferDraft,
  approval: HumanApproval | undefined,
  expectedVersion: number,
  now: IsoDateTime,
): OfferDraft {
  assertExpectedVersion(draft.version, expectedVersion);
  assertExportAuthorized(draft, approval);
  invariant(
    draft.state === "APPROVED",
    "INVALID_STATE_TRANSITION",
    "Only a newly approved draft needs an EXPORTED state transition.",
  );
  return transitionOfferDraft(draft, "EXPORTED", {
    expectedVersion,
    now,
  });
}
