import type { EntityId } from "@handwerk/contracts";
import { describe, expect, it } from "vitest";
import { getOfferReviewControlState } from "./model";
import { createSyntheticReviewInput } from "./test-fixture";

describe("offer review control state", () => {
  it("enables export only for the current approved revision", () => {
    const input = createSyntheticReviewInput();
    expect(
      getOfferReviewControlState({
        draft: input.draft,
        revision: input.revision,
        approval: input.approval,
        unresolvedCriticalQuestionCount: 0,
      }),
    ).toMatchObject({
      approvalState: "CURRENT",
      canApprove: false,
      canExport: true,
    });
  });

  it("marks an older approval stale and blocks export", () => {
    const input = createSyntheticReviewInput();
    const state = getOfferReviewControlState({
      draft: input.draft,
      revision: input.revision,
      approval: { ...input.approval!, revision: 2 },
      unresolvedCriticalQuestionCount: 0,
    });
    expect(state).toMatchObject({ approvalState: "STALE", canExport: false });
    expect(state.exportBlockReason).toMatch(/älteren Revision/);
  });

  it("blocks approval and export while a critical question remains", () => {
    const input = createSyntheticReviewInput();
    const { approvedRevision, ...draftWithoutApproval } = input.draft;
    expect(approvedRevision).toBe(3);
    const state = getOfferReviewControlState({
      draft: { ...draftWithoutApproval, state: "READY_FOR_REVIEW" },
      revision: input.revision,
      unresolvedCriticalQuestionCount: 1,
    });
    expect(state).toMatchObject({ canApprove: false, canExport: false });
    expect(state.approvalBlockReason).toMatch(/Rückfragen/);
  });

  it("blocks zero-line approval", () => {
    const input = createSyntheticReviewInput();
    const { approvedRevision, ...draftWithoutApproval } = input.draft;
    expect(approvedRevision).toBe(3);
    const state = getOfferReviewControlState({
      draft: { ...draftWithoutApproval, state: "READY_FOR_REVIEW" },
      revision: {
        ...input.revision,
        id: "empty-review-revision" as EntityId,
        lines: [],
      },
      unresolvedCriticalQuestionCount: 0,
    });
    expect(state).toMatchObject({ canApprove: false, canExport: false });
    expect(state.approvalBlockReason).toMatch(/Mindestens eine/);
  });
});
