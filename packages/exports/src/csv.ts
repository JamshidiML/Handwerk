import { formatMinor } from "./money";
import type { ApprovedOfferViewModel } from "./types";

export const CSV_HEADERS = [
  "schema_version",
  "offer_number",
  "revision",
  "record_type",
  "status",
  "item_code",
  "description",
  "quantity",
  "unit",
  "unit_price_eur",
  "net_eur",
  "tax_rate_percent",
  "tax_eur",
  "gross_eur",
  "reason",
] as const;

function neutralizeSpreadsheetFormula(value: string): string {
  const normalized = value.replace(/\u0000/g, " ");
  return /^[\u0009\u000a\u000d\u0020]*[=+\-@]/.test(normalized)
    ? `'${normalized}`
    : normalized;
}

function csvCell(value: string | number): string {
  const safe = neutralizeSpreadsheetFormula(String(value));
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function taxPercent(basisPoints: number): string {
  return `${Math.floor(basisPoints / 100)}.${String(basisPoints % 100).padStart(2, "0")}`;
}

export function renderOfferCsv(model: ApprovedOfferViewModel): Uint8Array {
  const context = [model.contractVersion, model.offerNumber, model.revision];
  const rows: Array<Array<string | number>> = model.lines.map((line) => [
    ...context,
    "LINE",
    "PRICED",
    line.itemCode,
    line.description,
    line.quantity,
    line.unit,
    formatMinor(line.unitPriceMinor),
    formatMinor(line.netMinor),
    taxPercent(line.taxRateBasisPoints),
    formatMinor(line.taxMinor),
    formatMinor(line.grossMinor),
    "",
  ]);

  for (const item of model.unpricedItems) {
    rows.push([
      ...context,
      "ITEM",
      item.status,
      item.key,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      item.reason,
    ]);
  }
  rows.push([
    ...context,
    "TOTAL",
    "APPROVED",
    "",
    "Gesamtsumme",
    "",
    "",
    "",
    formatMinor(model.netMinor),
    "",
    formatMinor(model.taxMinor),
    formatMinor(model.grossMinor),
    "",
  ]);

  const csv = [
    CSV_HEADERS.join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\n");
  return new TextEncoder().encode(`\uFEFF${csv}\n`);
}

export function spreadsheetSafeCell(value: string): string {
  return neutralizeSpreadsheetFormula(value);
}
