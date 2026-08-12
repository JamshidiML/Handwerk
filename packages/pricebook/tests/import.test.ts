import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CANONICAL_IDS,
  type EntityId,
  type IsoDateTime,
} from "@handwerk/contracts";
import {
  InMemoryPriceBookStore,
  SYNTHETIC_MALER_ITEMS,
  SYNTHETIC_MALER_PRICE_BOOK,
  commitCsvImport,
  previewCsvImport,
} from "../src";

const NOW = "2026-08-12T09:00:00.000Z" as IsoDateTime;
const FIXTURE = readFileSync(
  new URL(
    "../fixtures/maler-westblick-pricebook.synthetic.csv",
    import.meta.url,
  ),
  "utf8",
);
const MAPPING = {
  code: "Positionscode",
  description: "Beschreibung",
  category: "Kategorie",
  unit: "Einheit",
  unitPrice: "Einzelpreis",
  taxCategory: "Steuer",
  validFrom: "Gültig ab",
  active: "Aktiv",
  synonyms: "Synonyme",
} as const;

function emptyStore() {
  return new InMemoryPriceBookStore([
    { priceBook: SYNTHETIC_MALER_PRICE_BOOK, items: [] },
  ]);
}

function preview(
  csv: string,
  existingItems = [] as typeof SYNTHETIC_MALER_ITEMS,
) {
  return previewCsvImport({
    csv,
    organisationId: CANONICAL_IDS.organisation,
    priceBookId: SYNTHETIC_MALER_PRICE_BOOK.id,
    expectedPriceBookVersion: 1,
    mapping: MAPPING,
    existingItems,
    now: NOW,
  });
}

describe("CSV import", () => {
  it("previews German decimals and umlauts, then commits every row atomically", () => {
    const result = preview(FIXTURE);

    expect(result.delimiter).toBe(";");
    expect(result.canCommit).toBe(true);
    expect(result.validRowCount).toBe(4);
    expect(result.errorRowCount).toBe(0);
    expect(result.rows[0]?.item?.unitPrice.minor).toBe(850);
    expect(result.rows[0]?.item?.description).toContain("Wandflächen");
    expect(result.rows[2]?.item?.unit).toBe("STK");
    expect(result.rows[3]?.requestedActive).toBe(false);

    const store = emptyStore();
    const committed = commitCsvImport(
      { preview: result, approvalConfirmed: true },
      store,
    );

    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    expect(committed.importedCount).toBe(4);
    expect(committed.priceBookVersion).toBe(2);
    expect(
      committed.items.every((item) => item.approvalStatus === "APPROVED"),
    ).toBe(true);
    expect(committed.items.map((item) => item.active)).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("requires explicit approval and leaves the store unchanged", () => {
    const store = emptyStore();
    const result = commitCsvImport(
      { preview: preview(FIXTURE), approvalConfirmed: false },
      store,
    );

    expect(result).toMatchObject({ ok: false, importedCount: 0 });
    expect(
      store.read(CANONICAL_IDS.organisation, SYNTHETIC_MALER_PRICE_BOOK.id)
        ?.items,
    ).toHaveLength(0);
  });

  it("reports duplicate codes in-file and against the current price book", () => {
    const duplicateCsv =
      "Positionscode;Beschreibung;Kategorie;Einheit;Einzelpreis;Steuer\n" +
      "MÄL-01;Fläche weiß streichen;Maler;m²;12,50;19%\n" +
      "mäl-01;Fläche erneut streichen;Maler;m²;13,50;19%";
    const inFile = preview(duplicateCsv);
    expect(inFile.canCommit).toBe(false);
    expect(inFile.rows[1]?.issues).toContainEqual(
      expect.objectContaining({ code: "DUPLICATE_CODE" }),
    );
    expect(inFile.rows[1]?.duplicateOfRow).toBe(2);

    const againstBook = preview(FIXTURE, SYNTHETIC_MALER_ITEMS);
    expect(againstBook.errorRowCount).toBe(4);
    expect(againstBook.rows[0]?.issues[0]?.code).toBe("DUPLICATE_CODE");
  });

  it("rejects spreadsheet formulas, negative, zero, and unsafe-large prices", () => {
    const csv =
      "Positionscode;Beschreibung;Kategorie;Einheit;Einzelpreis;Steuer\n" +
      "BAD-1;=1+1;Maler;m²;10,00;19%\n" +
      "BAD-2;Negativer Preis;Maler;m²;-1,00;19%\n" +
      "BAD-3;Nullpreis;Maler;m²;0,00;19%\n" +
      "BAD-4;Zu großer Preis;Maler;m²;999.999.999.999.999,99;19%";
    const result = preview(csv);

    expect(result.canCommit).toBe(false);
    expect(result.rows[0]?.issues).toContainEqual(
      expect.objectContaining({ code: "CSV_INJECTION", field: "description" }),
    );
    for (const row of result.rows.slice(1)) {
      expect(row.issues).toContainEqual(
        expect.objectContaining({ code: "INVALID_MONEY" }),
      );
    }
  });

  it("fails the whole commit on one bad row or a stale book version", () => {
    const invalid = preview(
      "Positionscode;Beschreibung;Kategorie;Einheit;Einzelpreis;Steuer\n" +
        "OK-1;Gültige Fläche;Maler;m²;12,50;19%\n" +
        "BAD-1;Ungültige Einheit;Maler;Liter;12,50;19%",
    );
    const store = emptyStore();
    expect(
      commitCsvImport({ preview: invalid, approvalConfirmed: true }, store),
    ).toMatchObject({ ok: false, importedCount: 0 });
    expect(
      store.read(CANONICAL_IDS.organisation, SYNTHETIC_MALER_PRICE_BOOK.id)
        ?.items,
    ).toHaveLength(0);

    const stale = preview(FIXTURE);
    const changedBook = { ...SYNTHETIC_MALER_PRICE_BOOK, version: 2 };
    const changedStore = new InMemoryPriceBookStore([
      { priceBook: changedBook, items: [] },
    ]);
    expect(
      commitCsvImport(
        { preview: stale, approvalConfirmed: true },
        changedStore,
      ),
    ).toMatchObject({ ok: false, code: "VERSION_CONFLICT", importedCount: 0 });
  });

  it("detects a mutated preview before any write", () => {
    const result = preview(FIXTURE);
    const store = emptyStore();
    const mutable = result as unknown as {
      rows: Array<{ item?: { description: string } }>;
    };
    mutable.rows[0]!.item!.description = "Nach Vorschau verändert";

    expect(
      commitCsvImport({ preview: result, approvalConfirmed: true }, store),
    ).toMatchObject({ ok: false, code: "STALE_PREVIEW", importedCount: 0 });
    expect(
      store.read(CANONICAL_IDS.organisation, SYNTHETIC_MALER_PRICE_BOOK.id)
        ?.items,
    ).toHaveLength(0);
  });

  it("fails safely when a caller forges canCommit on an invalid preview", () => {
    const invalid = preview(
      "Positionscode;Beschreibung;Kategorie;Einheit;Einzelpreis;Steuer\n" +
        "BAD-1;Ungültige Einheit;Maler;Liter;12,50;19%",
    );
    const forged = invalid as unknown as { canCommit: boolean };
    forged.canCommit = true;
    const store = emptyStore();

    expect(() =>
      commitCsvImport({ preview: invalid, approvalConfirmed: true }, store),
    ).not.toThrow();
    expect(
      commitCsvImport({ preview: invalid, approvalConfirmed: true }, store),
    ).toMatchObject({ ok: false, code: "STALE_PREVIEW", importedCount: 0 });
  });

  it("reports missing mappings and unknown item-shape values without throwing", () => {
    const result = previewCsvImport({
      csv: "Code,Beschreibung\nX,Test",
      organisationId: CANONICAL_IDS.organisation,
      priceBookId: "pb-missing" as EntityId,
      expectedPriceBookVersion: 1,
      mapping: { code: "Code", description: "Beschreibung" },
      now: NOW,
    });

    expect(result.canCommit).toBe(false);
    expect(
      result.issues.filter((issue) => issue.code === "MISSING_COLUMN").length,
    ).toBeGreaterThan(0);
    expect(result.rows[0]?.issues).toContainEqual(
      expect.objectContaining({ code: "INVALID_UNIT" }),
    );
  });

  it("rejects rows with a mismatched column count", () => {
    const result = preview(
      "Positionscode;Beschreibung;Kategorie;Einheit;Einzelpreis;Steuer\n" +
        "BAD-COLUMNS;Fläche streichen;Maler;m²;12,50;19%;unerwartet",
    );
    expect(result.canCommit).toBe(false);
    expect(result.rows[0]?.issues).toContainEqual(
      expect.objectContaining({ code: "CSV_PARSE_ERROR" }),
    );
  });
});
