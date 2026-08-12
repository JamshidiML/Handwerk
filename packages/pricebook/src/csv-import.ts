import type { IsoDateTime, TaxCategory } from "@handwerk/contracts";
import { createHash } from "node:crypto";
import Papa from "papaparse";
import type {
  CommitImportRequest,
  CommercialPriceBookItem,
  ImportIssue,
  PreviewCsvImportRequest,
  PriceBookColumnMapping,
  PriceBookImportField,
  PriceBookImportPreview,
  PriceBookImportRow,
  PriceBookStore,
} from "./types";
import { PRICEBOOK_IMPORT_VERSION } from "./types";
import {
  PRICEBOOK_TEXT_LIMITS,
  TAX_RATE_BY_CATEGORY,
  buildCommercialItem,
  isSpreadsheetFormula,
  normalizeCode,
  normalizeText,
  parseMoneyMinor,
  parseTaxCategory,
  parseTaxRateBasisPoints,
  parseUnit,
  stableEntityId,
  validateManualInput,
  validateSafeText,
} from "./validation";

const REQUIRED_FIELDS: readonly PriceBookImportField[] = [
  "code",
  "description",
  "category",
  "unit",
  "unitPrice",
];

function globalIssue(code: ImportIssue["code"], message: string): ImportIssue {
  return { code, message };
}

function parseActive(value: string): boolean | undefined {
  if (!value.trim()) return true;
  const normalized = normalizeText(value).toLocaleLowerCase("de-DE");
  if (["ja", "yes", "true", "1", "aktiv"].includes(normalized)) return true;
  if (["nein", "no", "false", "0", "inaktiv"].includes(normalized))
    return false;
  return undefined;
}

function mappedValue(
  source: Readonly<Record<string, string>>,
  mapping: PriceBookColumnMapping,
  field: PriceBookImportField,
): string {
  const header = mapping[field];
  return header ? (source[header] ?? "") : "";
}

function resolveTax(
  categoryValue: string,
  rateValue: string,
  issues: ImportIssue[],
): { category: TaxCategory; basisPoints: number } | undefined {
  const category = categoryValue ? parseTaxCategory(categoryValue) : undefined;
  const basisPoints = rateValue
    ? parseTaxRateBasisPoints(rateValue)
    : undefined;

  if (categoryValue && !category) {
    issues.push({
      code: "INVALID_TAX",
      field: "taxCategory",
      message: "Steuerkategorie ist unbekannt.",
    });
  }
  if (rateValue && basisPoints === undefined) {
    issues.push({
      code: "INVALID_TAX",
      field: "taxRate",
      message: "Steuersatz ist ungültig.",
    });
  }
  if (!category && basisPoints === undefined) {
    issues.push({
      code: "MISSING_VALUE",
      field: "taxCategory",
      message: "Steuerkategorie oder Steuersatz fehlt.",
    });
    return undefined;
  }

  const inferredCategory =
    category ??
    (Object.entries(TAX_RATE_BY_CATEGORY).find(
      ([, expected]) => expected === basisPoints,
    )?.[0] as TaxCategory | undefined);
  if (!inferredCategory) {
    issues.push({
      code: "INVALID_TAX",
      field: "taxRate",
      message: "Steuersatz hat keine unterstützte Steuerkategorie.",
    });
    return undefined;
  }
  const expected = TAX_RATE_BY_CATEGORY[inferredCategory];
  if (basisPoints !== undefined && basisPoints !== expected) {
    issues.push({
      code: "INVALID_TAX",
      field: "taxRate",
      message: "Steuersatz passt nicht zur Steuerkategorie.",
    });
    return undefined;
  }
  return { category: inferredCategory, basisPoints: expected };
}

function buildRow(
  source: Readonly<Record<string, string>>,
  rowNumber: number,
  request: PreviewCsvImportRequest,
  now: IsoDateTime,
): PriceBookImportRow {
  const issues: ImportIssue[] = [];
  const codeValue = mappedValue(source, request.mapping, "code");
  const descriptionValue = mappedValue(source, request.mapping, "description");
  const categoryValue = mappedValue(source, request.mapping, "category");
  const unitValue = mappedValue(source, request.mapping, "unit");
  const priceValue = mappedValue(source, request.mapping, "unitPrice");
  const taxCategoryValue = mappedValue(source, request.mapping, "taxCategory");
  const taxRateValue = mappedValue(source, request.mapping, "taxRate");
  const validFrom = normalizeText(
    mappedValue(source, request.mapping, "validFrom"),
  );
  const validTo = normalizeText(
    mappedValue(source, request.mapping, "validTo"),
  );
  const activeValue = mappedValue(source, request.mapping, "active");
  const synonymsValue = mappedValue(source, request.mapping, "synonyms");

  issues.push(
    ...validateSafeText(codeValue, "code", PRICEBOOK_TEXT_LIMITS.code),
  );
  issues.push(
    ...validateSafeText(
      descriptionValue,
      "description",
      PRICEBOOK_TEXT_LIMITS.description,
    ),
  );
  issues.push(
    ...validateSafeText(
      categoryValue,
      "category",
      PRICEBOOK_TEXT_LIMITS.category,
    ),
  );

  const unit = parseUnit(unitValue);
  if (!unit) {
    issues.push({
      code: "INVALID_UNIT",
      field: "unit",
      message: "Einheit ist unbekannt oder fehlt.",
    });
  }
  const unitPriceMinor = parseMoneyMinor(priceValue);
  if (unitPriceMinor === undefined) {
    issues.push({
      code: "INVALID_MONEY",
      field: "unitPrice",
      message:
        "Preis muss positiv sein und höchstens zwei Dezimalstellen haben.",
    });
  }
  const tax = resolveTax(taxCategoryValue, taxRateValue, issues);
  const requestedActive = parseActive(activeValue);
  if (requestedActive === undefined) {
    issues.push({
      code: "INVALID_ACTIVE",
      field: "active",
      message: "Aktiv-Wert ist ungültig.",
    });
  }

  if (activeValue && isSpreadsheetFormula(activeValue)) {
    issues.push({
      code: "CSV_INJECTION",
      field: "active",
      message: "Formelähnlicher Tabelleninhalt ist nicht erlaubt.",
    });
  }
  if (validFrom && isSpreadsheetFormula(validFrom)) {
    issues.push({
      code: "CSV_INJECTION",
      field: "validFrom",
      message: "Formelähnlicher Tabelleninhalt ist nicht erlaubt.",
    });
  }
  if (validTo && isSpreadsheetFormula(validTo)) {
    issues.push({
      code: "CSV_INJECTION",
      field: "validTo",
      message: "Formelähnlicher Tabelleninhalt ist nicht erlaubt.",
    });
  }

  const synonyms = synonymsValue
    ? synonymsValue.split("|").map(normalizeText).filter(Boolean)
    : [];
  for (const synonym of synonyms) {
    issues.push(
      ...validateSafeText(
        synonym,
        "synonyms",
        PRICEBOOK_TEXT_LIMITS.description,
      ),
    );
  }

  if (
    unit &&
    unitPriceMinor !== undefined &&
    tax &&
    requestedActive !== undefined
  ) {
    const data = {
      code: codeValue,
      description: descriptionValue,
      category: categoryValue,
      unit,
      unitPriceMinor,
      taxCategory: tax.category,
      taxRateBasisPoints: tax.basisPoints,
      synonyms,
      ...(validFrom ? { validFrom } : {}),
      ...(validTo ? { validTo } : {}),
    };
    issues.push(...validateManualInput(data));
    if (issues.length === 0) {
      const item = buildCommercialItem({
        id: stableEntityId(
          request.organisationId,
          request.priceBookId,
          normalizeCode(codeValue),
        ),
        organisationId: request.organisationId,
        priceBookId: request.priceBookId,
        data,
        approvalStatus: "DRAFT",
        active: false,
        createdAt: now,
        updatedAt: now,
        version: 1,
      });
      return { rowNumber, source, item, requestedActive, issues };
    }
  }
  return { rowNumber, source, issues };
}

function validateMapping(
  headers: readonly string[],
  mapping: PriceBookColumnMapping,
): ImportIssue[] {
  const issues: ImportIssue[] = [];
  for (const field of REQUIRED_FIELDS) {
    if (!mapping[field]) {
      issues.push({
        code: "MISSING_COLUMN",
        field,
        message: `Spaltenzuordnung für ${field} fehlt.`,
      });
    }
  }
  if (!mapping.taxCategory && !mapping.taxRate) {
    issues.push({
      code: "MISSING_COLUMN",
      field: "taxCategory",
      message: "Spaltenzuordnung für Steuerkategorie oder Steuersatz fehlt.",
    });
  }
  for (const [field, header] of Object.entries(mapping) as Array<
    [PriceBookImportField, string | undefined]
  >) {
    if (header && !headers.includes(header)) {
      issues.push({
        code: "MISSING_COLUMN",
        field,
        sourceColumn: header,
        message: `CSV-Spalte '${header}' wurde nicht gefunden.`,
      });
    }
  }
  return issues;
}

export function fingerprintImportPreview(
  preview: Omit<PriceBookImportPreview, "previewId">,
): string {
  const rows = preview.rows.map((row) => ({
    rowNumber: row.rowNumber,
    source: row.source,
    item: row.item,
    requestedActive: row.requestedActive,
    issues: row.issues,
    duplicateOfRow: row.duplicateOfRow,
  }));
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: preview.version,
        organisationId: preview.organisationId,
        priceBookId: preview.priceBookId,
        expectedPriceBookVersion: preview.expectedPriceBookVersion,
        headers: preview.headers,
        delimiter: preview.delimiter,
        mapping: preview.mapping,
        issues: preview.issues,
        rows,
        validRowCount: preview.validRowCount,
        errorRowCount: preview.errorRowCount,
        canCommit: preview.canCommit,
      }),
    )
    .digest("hex");
}

export function previewCsvImport(
  request: PreviewCsvImportRequest,
): PriceBookImportPreview {
  const config = request.delimiter
    ? { delimiter: request.delimiter, skipEmptyLines: "greedy" as const }
    : { skipEmptyLines: "greedy" as const };
  const parsed = Papa.parse<string[]>(request.csv, config);
  const matrix = parsed.data;
  const rawHeaders = matrix[0] ?? [];
  const headers = rawHeaders.map((header, index) =>
    normalizeText(index === 0 ? header.replace(/^\uFEFF/, "") : header),
  );
  const issues: ImportIssue[] = parsed.errors.map((error) =>
    globalIssue(
      "CSV_PARSE_ERROR",
      `CSV konnte nicht gelesen werden: ${error.message}`,
    ),
  );

  if (headers.length === 0 || headers.every((header) => !header)) {
    issues.push(globalIssue("EMPTY_FILE", "CSV enthält keine Kopfzeile."));
  }
  if (new Set(headers).size !== headers.length) {
    issues.push(
      globalIssue("CSV_PARSE_ERROR", "CSV enthält doppelte Spaltennamen."),
    );
  }
  issues.push(...validateMapping(headers, request.mapping));

  const now = request.now ?? (new Date().toISOString() as IsoDateTime);
  let rows = matrix.slice(1).map((values, index) => {
    const source = Object.fromEntries(
      headers.map((header, columnIndex) => [header, values[columnIndex] ?? ""]),
    );
    const row = buildRow(source, index + 2, request, now);
    if (values.length === headers.length) return row;
    return {
      ...row,
      issues: [
        ...row.issues,
        {
          code: "CSV_PARSE_ERROR" as const,
          message: "Zeile hat nicht dieselbe Spaltenanzahl wie die Kopfzeile.",
        },
      ],
    };
  });

  const firstRowByCode = new Map<string, number>();
  const existingCodes = new Set(
    (request.existingItems ?? [])
      .filter(
        (item) =>
          item.organisationId === request.organisationId &&
          item.priceBookId === request.priceBookId,
      )
      .map((item) => normalizeCode(item.code)),
  );
  rows = rows.map((row) => {
    if (!row.item) return row;
    const code = normalizeCode(row.item.code);
    const duplicateOfRow = firstRowByCode.get(code);
    if (duplicateOfRow !== undefined || existingCodes.has(code)) {
      return {
        ...row,
        ...(duplicateOfRow !== undefined ? { duplicateOfRow } : {}),
        issues: [
          ...row.issues,
          {
            code: "DUPLICATE_CODE" as const,
            field: "code" as const,
            message:
              duplicateOfRow !== undefined
                ? `Positionscode ist bereits in Zeile ${duplicateOfRow} enthalten.`
                : "Positionscode existiert bereits im Preisbuch.",
          },
        ],
      };
    }
    firstRowByCode.set(code, row.rowNumber);
    return row;
  });

  const errorRowCount = rows.filter((row) => row.issues.length > 0).length;
  const partial: Omit<PriceBookImportPreview, "previewId"> = {
    version: PRICEBOOK_IMPORT_VERSION,
    organisationId: request.organisationId,
    priceBookId: request.priceBookId,
    expectedPriceBookVersion: request.expectedPriceBookVersion,
    headers,
    delimiter: parsed.meta.delimiter,
    mapping: { ...request.mapping },
    issues,
    rows,
    validRowCount: rows.length - errorRowCount,
    errorRowCount,
    canCommit: issues.length === 0 && rows.length > 0 && errorRowCount === 0,
  };
  return { ...partial, previewId: fingerprintImportPreview(partial) };
}

export function commitCsvImport(
  request: CommitImportRequest,
  store: PriceBookStore,
) {
  const { preview } = request;
  if (!preview.canCommit || !request.approvalConfirmed) {
    return {
      ok: false as const,
      code: "PREVIEW_HAS_ERRORS" as const,
      message: request.approvalConfirmed
        ? "Importvorschau enthält Fehler. Es wurde nichts gespeichert."
        : "Preispositionen müssen vor dem Import ausdrücklich freigegeben werden.",
      importedCount: 0 as const,
    };
  }
  const { previewId: ignored, ...unsignedPreview } = preview;
  void ignored;
  if (fingerprintImportPreview(unsignedPreview) !== preview.previewId) {
    return {
      ok: false as const,
      code: "STALE_PREVIEW" as const,
      message: "Importvorschau wurde verändert. Bitte erneut prüfen.",
      importedCount: 0 as const,
    };
  }

  if (preview.rows.some((row) => !row.item || row.issues.length > 0)) {
    return {
      ok: false as const,
      code: "STALE_PREVIEW" as const,
      message: "Importvorschau ist unvollständig. Bitte erneut prüfen.",
      importedCount: 0 as const,
    };
  }

  const approvedItems: CommercialPriceBookItem[] = preview.rows.map((row) => {
    const item = row.item!;
    return {
      ...item,
      active: row.requestedActive ?? true,
      approvalStatus: "APPROVED",
    };
  });
  return store.commitImport(preview, approvedItems);
}
