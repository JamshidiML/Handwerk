import { describe, expect, it } from "vitest";

import {
  applyCommercialEdit,
  approveOfferDraft,
  assertExportAuthorized,
  createOfferDraftRevision,
  DomainInvariantError,
  markOfferDraftExported,
  transitionOfferDraft,
} from "../src/index";
import {
  draft,
  id,
  LATER,
  membership,
  NOW,
  OTHER_ORG,
  revision,
  USER,
} from "./fixtures";

describe("offer state and revision rules", () => {
  it.each([
    ["CAPTURING", "PROCESSING"],
    ["PROCESSING", "NEEDS_CLARIFICATION"],
    ["PROCESSING", "READY_FOR_REVIEW"],
    ["NEEDS_CLARIFICATION", "READY_FOR_REVIEW"],
  ] as const)("allows %s -> %s", (state, target) => {
    const current = draft({ state, version: 1 });
    expect(
      transitionOfferDraft(current, target, { expectedVersion: 1, now: LATER }),
    ).toMatchObject({ state: target, version: 2 });
  });

  it("rejects invalid transitions", () => {
    expect(() =>
      transitionOfferDraft(draft(), "EXPORTED", {
        expectedVersion: 4,
        now: LATER,
      }),
    ).toThrowError(/cannot transition/);
  });

  it("requires the commercial edit service to leave an approved state", () => {
    expect(() =>
      transitionOfferDraft(
        draft({ state: "APPROVED", approvedRevision: 1 }),
        "READY_FOR_REVIEW",
        { expectedVersion: 4, now: LATER },
      ),
    ).toThrowError(/requires applyCommercialEdit/);
  });

  it("rejects stale optimistic versions", () => {
    expect(() =>
      transitionOfferDraft(draft(), "APPROVED", {
        expectedVersion: 3,
        approvedRevision: 1,
        now: LATER,
      }),
    ).toThrowError(/Expected version/);
  });

  it("requires zero unresolved blocking questions", () => {
    const current = draft();
    expect(() =>
      approveOfferDraft({
        id: id("approval-1"),
        draft: current,
        revision: revision(current),
        membership: membership(),
        expectedVersion: 4,
        approvedByUserId: USER,
        confirmationText: "Ich habe den Entwurf geprüft.",
        unresolvedBlockingQuestions: 1,
        now: LATER,
      }),
    ).toThrowError(/must be resolved/);
  });

  it.each([
    membership({ active: false }),
    membership({ role: "MEMBER" }),
    membership({ organisationId: OTHER_ORG }),
  ])("rejects inactive, unauthorized, or foreign approval", (reviewer) => {
    const current = draft();
    expect(() =>
      approveOfferDraft({
        id: id("approval-1"),
        draft: current,
        revision: revision(current),
        membership: reviewer,
        expectedVersion: 4,
        approvedByUserId: USER,
        confirmationText: "Ich habe den Entwurf geprüft.",
        unresolvedBlockingQuestions: 0,
        now: LATER,
      }),
    ).toThrowError(DomainInvariantError);
  });

  it("binds human approval to the current revision", () => {
    const current = draft();
    const approved = approveOfferDraft({
      id: id("approval-1"),
      draft: current,
      revision: revision(current),
      membership: membership(),
      expectedVersion: 4,
      approvedByUserId: USER,
      confirmationText: "Ich habe den Entwurf geprüft.",
      unresolvedBlockingQuestions: 0,
      now: LATER,
    });
    expect(approved.draft).toMatchObject({
      state: "APPROVED",
      currentRevision: 1,
      approvedRevision: 1,
      version: 5,
    });
    expect(approved.approval.revision).toBe(1);
    expect(() =>
      assertExportAuthorized(approved.draft, approved.approval),
    ).not.toThrow();
  });

  it("blocks export for missing, stale, invalidated, or foreign approval", () => {
    const approvedDraft = draft({
      state: "APPROVED",
      approvedRevision: 1,
    });
    expect(() => assertExportAuthorized(approvedDraft, undefined)).toThrowError(
      /absent, stale/,
    );
    const result = approveOfferDraft({
      id: id("approval-1"),
      draft: draft(),
      revision: revision(draft()),
      membership: membership(),
      expectedVersion: 4,
      approvedByUserId: USER,
      confirmationText: "Ich habe den Entwurf geprüft.",
      unresolvedBlockingQuestions: 0,
      now: LATER,
    });
    expect(() =>
      assertExportAuthorized(result.draft, {
        ...result.approval,
        invalidatedAt: LATER,
      }),
    ).toThrowError(/invalidated/);
    expect(() =>
      assertExportAuthorized(result.draft, {
        ...result.approval,
        organisationId: OTHER_ORG,
      }),
    ).toThrowError(/another tenant/);
  });

  it("moves an approved draft to EXPORTED only with current approval", () => {
    const approved = approveOfferDraft({
      id: id("approval-1"),
      draft: draft(),
      revision: revision(draft()),
      membership: membership(),
      expectedVersion: 4,
      approvedByUserId: USER,
      confirmationText: "Ich habe den Entwurf geprüft.",
      unresolvedBlockingQuestions: 0,
      now: LATER,
    });
    expect(
      markOfferDraftExported(
        approved.draft,
        approved.approval,
        approved.draft.version,
        LATER,
      ),
    ).toMatchObject({ state: "EXPORTED", approvedRevision: 1, version: 6 });
  });

  it("creates a new revision and invalidates approval after a commercial edit", () => {
    const initialDraft = draft();
    const initialRevision = revision(initialDraft);
    const approved = approveOfferDraft({
      id: id("approval-1"),
      draft: initialDraft,
      revision: initialRevision,
      membership: membership(),
      expectedVersion: initialDraft.version,
      approvedByUserId: USER,
      confirmationText: "Ich habe den Entwurf geprüft.",
      unresolvedBlockingQuestions: 0,
      now: LATER,
    });
    const edit = applyCommercialEdit({
      draft: approved.draft,
      currentRevision: initialRevision,
      expectedVersion: approved.draft.version,
      revisionId: id("revision-2"),
      lines: initialRevision.lines.map((line) => ({
        ...line,
        origin: "EDITED" as const,
      })),
      editedByUserId: USER,
      now: "2026-08-12T10:10:00.000Z" as typeof NOW,
      activeApproval: approved.approval,
    });
    expect(edit.draft).toMatchObject({
      state: "READY_FOR_REVIEW",
      currentRevision: 2,
      version: 6,
    });
    expect(edit.draft.approvedRevision).toBeUndefined();
    expect(edit.invalidatedApproval).toMatchObject({
      invalidationReason: "COMMERCIAL_EDIT",
      version: 2,
    });
    expect(() =>
      assertExportAuthorized(edit.draft, edit.invalidatedApproval),
    ).toThrowError(/requires current human approval/);
  });

  it("will not edit an approved revision without its active approval", () => {
    const approvedDraft = draft({
      state: "APPROVED",
      approvedRevision: 1,
    });
    expect(() =>
      applyCommercialEdit({
        draft: approvedDraft,
        currentRevision: revision(approvedDraft),
        expectedVersion: approvedDraft.version,
        revisionId: id("revision-2"),
        lines: revision(approvedDraft).lines,
        editedByUserId: USER,
        now: LATER,
      }),
    ).toThrowError(/must invalidate/);
  });

  it("rejects a tampered line total in a revision", () => {
    const current = draft();
    const line = revision(current).lines[0];
    expect(line).toBeDefined();
    expect(() =>
      createOfferDraftRevision({
        id: id("revision-bad"),
        draft: current,
        revision: 1,
        lines: [
          {
            ...line!,
            netTotal: { currency: "EUR", minor: line!.netTotal.minor + 1 },
          },
        ],
        createdByUserId: USER,
        now: NOW,
      }),
    ).toThrowError(/do not match/);
  });
});
