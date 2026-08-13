import type { EntityId, IsoDateTime } from "@handwerk/contracts";
import { describe, expect, it } from "vitest";
import { createSyntheticApprovedExportInput } from "../fixtures/synthetic-offer";
import {
  applyQuantityEdit,
  approveCurrentRevision,
  calculateLineAmounts,
  ExportBlockedError,
  getExportDecision,
  summarizeRevisionChanges,
} from "../src";

const editedAt = "2026-08-12T10:00:00.000Z" as IsoDateTime;

describe("revision-bound approval", () => {
  it("blocks unapproved, stale, invalidated, and unresolved exports", () => {
    const input = createSyntheticApprovedExportInput();
    const draftWithoutApproval = { ...input.draft };
    delete draftWithoutApproval.approvedRevision;
    const unapproved = getExportDecision({
      draft: { ...draftWithoutApproval, state: "READY_FOR_REVIEW" },
      revision: input.revision,
      unresolvedCriticalQuestionIds: [],
    });
    expect(unapproved).toMatchObject({
      allowed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: "APPROVAL_REQUIRED" }),
      ]),
    });

    const stale = getExportDecision({
      ...input,
      approval: { ...input.approval!, revision: 2 },
    });
    expect(stale).toMatchObject({
      allowed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: "STALE_APPROVAL" }),
      ]),
    });

    const invalidated = getExportDecision({
      ...input,
      approval: { ...input.approval!, invalidatedAt: editedAt },
    });
    expect(invalidated).toMatchObject({
      allowed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: "APPROVAL_INVALIDATED" }),
      ]),
    });

    const unresolved = getExportDecision({
      ...input,
      unresolvedCriticalQuestionIds: ["question-critical" as EntityId],
    });
    expect(unresolved).toMatchObject({
      allowed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: "UNRESOLVED_CRITICAL_QUESTIONS" }),
      ]),
    });
  });

  it("requires explicit confirmation before creating approval", () => {
    const input = createSyntheticApprovedExportInput();
    const withoutApproval = { ...input.draft };
    delete withoutApproval.approvedRevision;
    const readyDraft = {
      ...withoutApproval,
      state: "READY_FOR_REVIEW" as const,
    };

    expect(() =>
      approveCurrentRevision({
        draft: readyDraft,
        revision: input.revision,
        unresolvedCriticalQuestionIds: [],
        confirmed: false,
        approvalId: "approval-new" as EntityId,
        approvedByUserId: input.approval!.approvedByUserId,
        approvedAt: editedAt,
      }),
    ).toThrow(ExportBlockedError);

    const approved = approveCurrentRevision({
      draft: readyDraft,
      revision: input.revision,
      unresolvedCriticalQuestionIds: [],
      confirmed: true,
      approvalId: "approval-new" as EntityId,
      approvedByUserId: input.approval!.approvedByUserId,
      approvedAt: editedAt,
    });
    expect(approved.draft).toMatchObject({
      state: "APPROVED",
      approvedRevision: 3,
    });
    expect(approved.approval.revision).toBe(3);
    expect(approved.approval.invalidatedAt).toBeUndefined();
  });

  it("creates a new revision and invalidates approval after a commercial edit", () => {
    const input = createSyntheticApprovedExportInput();
    const edited = applyQuantityEdit({
      draft: input.draft,
      revision: input.revision,
      approval: input.approval!,
      lineId: input.revision.lines[0]!.id,
      quantityValue: "51.5",
      revisionId: "revision-synthetic-4" as EntityId,
      createdByUserId: input.approval!.approvedByUserId,
      editedAt,
    });

    expect(edited.changed).toBe(true);
    expect(edited.draft).toMatchObject({
      state: "READY_FOR_REVIEW",
      currentRevision: 4,
    });
    expect(edited.draft.approvedRevision).toBeUndefined();
    expect(edited.invalidatedApproval).toMatchObject({
      revision: 3,
      invalidatedAt: editedAt,
    });
    expect(edited.summary).toMatchObject({
      fromRevision: 3,
      toRevision: 4,
      hasCommercialChanges: true,
      changes: [expect.objectContaining({ kind: "QUANTITY_CHANGED" })],
    });
    expect(edited.revision.lines[0]!.origin).toBe("EDITED");
    expect(edited.revision.grossTotal.minor).toBe(
      edited.revision.netTotal.minor + edited.revision.taxTotal.minor,
    );

    const decision = getExportDecision({
      draft: edited.draft,
      revision: edited.revision,
      approval: edited.invalidatedApproval!,
      unresolvedCriticalQuestionIds: [],
    });
    expect(decision).toMatchObject({
      allowed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: "APPROVAL_INVALIDATED" }),
      ]),
    });
  });

  it("treats scope, exclusions, and unmatched changes as commercial", () => {
    const input = createSyntheticApprovedExportInput();
    const changed = {
      ...input.revision,
      revision: 4,
      excludedItems: [
        ...input.revision.excludedItems,
        { key: "Fenster", reason: "Nicht enthalten", citations: [] },
      ],
    };
    const summary = summarizeRevisionChanges(input.revision, changed);
    expect(summary.hasCommercialChanges).toBe(true);
    expect(summary.changes).toContainEqual(
      expect.objectContaining({ kind: "EXCLUSION_CHANGED" }),
    );
  });
});

describe("precise commercial arithmetic", () => {
  it("rounds half-up using decimal strings and integer minor units", () => {
    const amounts = calculateLineAmounts(
      { value: "2.5", unit: "M2" },
      { currency: "EUR", minor: 1 },
      1900,
    );
    expect(amounts.netTotal.minor).toBe(3);
    expect(amounts.taxTotal.minor).toBe(1);
    expect(amounts.grossTotal.minor).toBe(4);
  });

  it("rejects fractional pieces and non-unit pauschale edits", () => {
    expect(() =>
      calculateLineAmounts(
        { value: "1.5", unit: "STK" },
        { currency: "EUR", minor: 100 },
        1900,
      ),
    ).toThrow(/ganzzahlig/);
    expect(() =>
      calculateLineAmounts(
        { value: "2", unit: "PAUSCHALE" },
        { currency: "EUR", minor: 100 },
        1900,
      ),
    ).toThrow(/Menge 1/);
  });

  it("blocks a zero-line offer even when an approval object exists", () => {
    const input = createSyntheticApprovedExportInput();
    const emptyRevision = {
      ...input.revision,
      lines: [],
      netTotal: { currency: "EUR" as const, minor: 0 },
      taxTotal: { currency: "EUR" as const, minor: 0 },
      grossTotal: { currency: "EUR" as const, minor: 0 },
    };
    const decision = getExportDecision({ ...input, revision: emptyRevision });
    expect(decision).toMatchObject({
      allowed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: "NO_PRICED_LINES" }),
      ]),
    });
  });

  it("fails closed on malformed money and contradictory tax input", () => {
    const input = createSyntheticApprovedExportInput();
    const malformedRevision = {
      ...input.revision,
      lines: input.revision.lines.map((line, index) =>
        index === 0
          ? {
              ...line,
              taxCategory: "REDUCED_7" as const,
              netTotal: { currency: "EUR" as const, minor: -1 },
            }
          : line,
      ),
    };
    expect(() =>
      getExportDecision({ ...input, revision: malformedRevision }),
    ).not.toThrow();
    expect(
      getExportDecision({ ...input, revision: malformedRevision }),
    ).toMatchObject({
      allowed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_COMMERCIAL_TOTALS" }),
      ]),
    });
  });
});
