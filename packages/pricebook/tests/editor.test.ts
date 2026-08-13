import { describe, expect, it } from "vitest";
import {
  CANONICAL_IDS,
  type EntityId,
  type IsoDateTime,
  type OrganisationId,
} from "@handwerk/contracts";
import {
  InMemoryPriceBookStore,
  PriceBookEditorService,
  PriceBookValidationError,
  PriceBookVersionConflictError,
  SYNTHETIC_MALER_PRICE_BOOK,
} from "../src";

const NOW = "2026-08-12T10:00:00.000Z" as IsoDateTime;
const LATER = "2026-08-12T10:05:00.000Z" as IsoDateTime;

function setup() {
  const store = new InMemoryPriceBookStore([
    { priceBook: SYNTHETIC_MALER_PRICE_BOOK, items: [] },
  ]);
  let currentNow = NOW;
  const editor = new PriceBookEditorService(
    store,
    CANONICAL_IDS.organisation,
    SYNTHETIC_MALER_PRICE_BOOK.id,
    {
      now: () => currentNow,
      createId: () => "manual-item-1" as EntityId,
    },
  );
  return { store, editor, advance: () => (currentNow = LATER) };
}

const VALID_INPUT = {
  code: "MAL-SOCKEL-1X",
  description: "Sockelleiste einmal weiß lackieren",
  category: "Lackierarbeiten",
  unit: "M" as const,
  unitPriceMinor: 725,
  taxCategory: "STANDARD_19" as const,
  synonyms: ["Sockel weiß"],
};

describe("manual price-book editor", () => {
  it("creates inactive drafts and prevents activation before approval", () => {
    const { editor } = setup();
    const draft = editor.createDraft(VALID_INPUT);

    expect(draft).toMatchObject({
      active: false,
      approvalStatus: "DRAFT",
      version: 1,
    });
    expect(() => editor.setActive(draft.id, draft.version, true)).toThrow(
      PriceBookValidationError,
    );
  });

  it("approves and activates explicitly, then commercial edits reset approval", () => {
    const { editor, advance } = setup();
    const draft = editor.createDraft(VALID_INPUT);
    const approved = editor.approve(draft.id, draft.version, true);
    expect(approved).toMatchObject({
      active: true,
      approvalStatus: "APPROVED",
      version: 2,
    });

    advance();
    const edited = editor.update(approved.id, approved.version, {
      ...VALID_INPUT,
      unitPriceMinor: 750,
    });
    expect(edited).toMatchObject({
      unitPrice: { currency: "EUR", minor: 750 },
      active: false,
      approvalStatus: "DRAFT",
      version: 3,
      updatedAt: LATER,
    });
  });

  it("supports deactivation without discarding approval", () => {
    const { editor } = setup();
    const draft = editor.createDraft(VALID_INPUT);
    const approved = editor.approve(draft.id, 1, true);
    const inactive = editor.setActive(approved.id, 2, false);

    expect(inactive).toMatchObject({
      active: false,
      approvalStatus: "APPROVED",
      version: 3,
    });
  });

  it("rejects stale versions and cross-tenant editors", () => {
    const { store, editor } = setup();
    const draft = editor.createDraft(VALID_INPUT);
    expect(() => editor.approve(draft.id, 99, true)).toThrow(
      PriceBookVersionConflictError,
    );

    const otherTenantEditor = new PriceBookEditorService(
      store,
      "org-other" as OrganisationId,
      SYNTHETIC_MALER_PRICE_BOOK.id,
    );
    expect(() => otherTenantEditor.list()).toThrow("Preisbuch nicht gefunden");
  });

  it.each([-1, 0, Number.MAX_SAFE_INTEGER + 1])(
    "rejects unsafe manual price %s",
    (unitPriceMinor) => {
      const { editor } = setup();
      expect(() =>
        editor.createDraft({ ...VALID_INPUT, unitPriceMinor }),
      ).toThrow(PriceBookValidationError);
    },
  );

  it("rejects formula-like text, invalid dates, and inconsistent tax references", () => {
    const { editor } = setup();
    expect(() =>
      editor.createDraft({ ...VALID_INPUT, description: "=1+1" }),
    ).toThrow(PriceBookValidationError);
    expect(() =>
      editor.createDraft({
        ...VALID_INPUT,
        validFrom: "2026-02-30",
        validTo: "2026-01-01",
      }),
    ).toThrow(PriceBookValidationError);
    expect(() =>
      editor.createDraft({ ...VALID_INPUT, taxRateBasisPoints: 700 }),
    ).toThrow(PriceBookValidationError);
  });
});
