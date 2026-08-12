import type {
  HumanApproval,
  OfferDraft,
  OfferDraftRevision,
} from "@handwerk/contracts";

export type ReviewApprovalState =
  | "MISSING"
  | "STALE"
  | "INVALIDATED"
  | "CURRENT";

export interface OfferReviewStateInput {
  draft: OfferDraft;
  revision: OfferDraftRevision;
  approval?: HumanApproval;
  unresolvedCriticalQuestionCount: number;
}

export interface OfferReviewControlState {
  approvalState: ReviewApprovalState;
  canApprove: boolean;
  canExport: boolean;
  approvalBlockReason?: string;
  exportBlockReason?: string;
}

export function getOfferReviewControlState(
  input: OfferReviewStateInput,
): OfferReviewControlState {
  const approvalState: ReviewApprovalState = !input.approval
    ? "MISSING"
    : input.approval.invalidatedAt
      ? "INVALIDATED"
      : input.approval.revision !== input.revision.revision ||
          input.draft.approvedRevision !== input.revision.revision ||
          input.draft.currentRevision !== input.revision.revision
        ? "STALE"
        : "CURRENT";
  const hasLines = input.revision.lines.length > 0;
  const hasCriticalQuestions = input.unresolvedCriticalQuestionCount > 0;
  const canApprove =
    input.draft.state === "READY_FOR_REVIEW" &&
    hasLines &&
    !hasCriticalQuestions;
  const canExport =
    approvalState === "CURRENT" &&
    (input.draft.state === "APPROVED" || input.draft.state === "EXPORTED") &&
    hasLines &&
    !hasCriticalQuestions;

  let approvalBlockReason: string | undefined;
  if (!hasLines)
    approvalBlockReason =
      "Mindestens eine bepreiste Position ist erforderlich.";
  else if (hasCriticalQuestions)
    approvalBlockReason =
      "Kritische Rückfragen müssen zuerst beantwortet werden.";
  else if (input.draft.state !== "READY_FOR_REVIEW")
    approvalBlockReason = "Diese Revision ist nicht zur Freigabe bereit.";

  let exportBlockReason: string | undefined;
  if (!hasLines)
    exportBlockReason =
      "Ein Angebot ohne Positionen kann nicht exportiert werden.";
  else if (hasCriticalQuestions)
    exportBlockReason =
      "Der Export ist wegen offener kritischer Rückfragen gesperrt.";
  else if (approvalState === "INVALIDATED")
    exportBlockReason =
      "Eine kommerzielle Änderung hat die Freigabe ungültig gemacht.";
  else if (approvalState === "STALE")
    exportBlockReason = "Die Freigabe gehört zu einer älteren Revision.";
  else if (approvalState === "MISSING")
    exportBlockReason = "Die aktuelle Revision muss zuerst freigegeben werden.";
  else if (input.draft.state !== "APPROVED" && input.draft.state !== "EXPORTED")
    exportBlockReason = "Die aktuelle Revision ist nicht freigegeben.";

  return {
    approvalState,
    canApprove,
    canExport,
    ...(approvalBlockReason ? { approvalBlockReason } : {}),
    ...(exportBlockReason ? { exportBlockReason } : {}),
  };
}
