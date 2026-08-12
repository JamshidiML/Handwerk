import type {
  EntityId,
  IsoDateTime,
  OrganisationId,
  TaxCategory,
  Unit,
} from "@handwerk/contracts";
import type {
  CommercialPriceBookItem,
  ImportIssue,
  ManualPriceBookItemInput,
  PriceBookImportField,
} from "./types";

const UNIT_ALIASES: Readonly<Record<string, Unit>> = {
  m2: "M2",
  "m²": "M2",
  qm: "M2",
  quadratmeter: "M2",
  m: "M",
  lfm: "M",
  meter: "M",
  stk: "STK",
  stück: "STK",
  stueck: "STK",
  std: "STD",
  h: "STD",
  stunde: "STD",
  pauschale: "PAUSCHALE",
  pauschal: "PAUSCHALE",
  psch: "PAUSCHALE",
};

export const TAX_RATE_BY_CATEGORY: Readonly<Record<TaxCategory, number>> = {
  STANDARD_19: 1_900,
  REDUCED_7: 700,
  EXEMPT: 0,
};

const TAX_CATEGORY_ALIASES: Readonly<Record<string, TaxCategory>> = {
  standard_19: "STANDARD_19",
  standard: "STANDARD_19",
  "19": "STANDARD_19",
  "19%": "STANDARD_19",
  reduced_7: "REDUCED_7",
  reduziert: "REDUCED_7",
  "7": "REDUCED_7",
  "7%": "REDUCED_7",
  exempt: "EXEMPT",
  steuerfrei: "EXEMPT",
  "0": "EXEMPT",
  "0%": "EXEMPT",
};

const MAX_TEXT_LENGTH = 240;
const MAX_CATEGORY_LENGTH = 100;
const CODE_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}._/-]{0,49}$/u;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class PriceBookValidationError extends Error {
  readonly issues: readonly ImportIssue[];

  constructor(message: string, issues: readonly ImportIssue[]) {
    super(message);
    this.name = "PriceBookValidationError";
    this.issues = issues;
  }
}

export function normalizeText(value: string): string {
  return value.trim().normalize("NFC");
}

export function normalizeCode(value: string): string {
  return normalizeText(value).toLocaleUpperCase("de-DE");
}

export function normalizeLookup(value: string): string {
  return normalizeText(value).toLocaleLowerCase("de-DE");
}

export function isSpreadsheetFormula(value: string): boolean {
  const first = value.trimStart().charAt(0);
  return first === "=" || first === "+" || first === "-" || first === "@";
}

export function parseUnit(value: string): Unit | undefined {
  return UNIT_ALIASES[normalizeLookup(value)];
}

export function parseTaxCategory(value: string): TaxCategory | undefined {
  return TAX_CATEGORY_ALIASES[normalizeLookup(value)];
}

function stripGermanGrouping(value: string): {
  digits: string;
  fraction: string;
} | null {
  const compact = value.replace(/[\u00a0\u202f ]/g, "");
  if (!/^\d+(?:[.,]\d+)*$/.test(compact)) {
    return null;
  }

  if (compact.includes(",")) {
    if ((compact.match(/,/g) ?? []).length !== 1) return null;
    const [integer = "", fraction = ""] = compact.split(",");
    const groups = integer.split(".");
    if (
      groups.some((group) => !/^\d+$/.test(group)) ||
      (groups.length > 1 &&
        (groups[0]?.length === 0 ||
          groups[0]!.length > 3 ||
          groups.slice(1).some((group) => group.length !== 3)))
    ) {
      return null;
    }
    return { digits: groups.join(""), fraction };
  }

  const groups = compact.split(".");
  if (groups.length === 1) {
    return { digits: groups[0]!, fraction: "" };
  }
  if (
    groups.length > 2 &&
    groups[0]!.length <= 3 &&
    groups.slice(1).every((group) => group.length === 3)
  ) {
    return { digits: groups.join(""), fraction: "" };
  }
  if (groups.length === 2) {
    return { digits: groups[0]!, fraction: groups[1]! };
  }
  return null;
}

export interface ParsedDecimal {
  numerator: bigint;
  scale: number;
  canonical: string;
}

export function parsePositiveDecimal(
  value: string,
  maxScale = 6,
): ParsedDecimal | undefined {
  const normalized = normalizeText(value);
  if (!normalized || normalized.startsWith("+") || normalized.startsWith("-")) {
    return undefined;
  }
  const parsed = stripGermanGrouping(normalized);
  if (!parsed || parsed.fraction.length > maxScale) return undefined;

  const numerator = BigInt(`${parsed.digits}${parsed.fraction}`);
  if (numerator <= BigInt(0)) return undefined;
  const integer = BigInt(parsed.digits).toString();
  const fraction = parsed.fraction.replace(/0+$/, "");
  return {
    numerator: fraction
      ? BigInt(`${parsed.digits}${fraction}`)
      : BigInt(parsed.digits),
    scale: fraction.length,
    canonical: fraction ? `${integer}.${fraction}` : integer,
  };
}

export function parseMoneyMinor(value: string): number | undefined {
  const parsed = parsePositiveDecimal(value, 2);
  if (!parsed) return undefined;
  const minor = parsed.numerator * BigInt(10) ** BigInt(2 - parsed.scale);
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
  return Number(minor);
}

export function parseTaxRateBasisPoints(value: string): number | undefined {
  const normalized = normalizeText(value).replace(/%$/, "");
  if (normalized === "0") return 0;
  const parsed = parsePositiveDecimal(normalized, 2);
  if (!parsed) return undefined;
  const basisPoints = parsed.numerator * BigInt(10) ** BigInt(2 - parsed.scale);
  if (basisPoints > BigInt(10_000)) return undefined;
  return Number(basisPoints);
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}

export function validateDateRange(
  validFrom?: string,
  validTo?: string,
): boolean {
  return !validFrom || !validTo || validFrom <= validTo;
}

export function validateSafeText(
  value: string,
  field: PriceBookImportField,
  maxLength: number,
): ImportIssue[] {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [{ code: "MISSING_VALUE", field, message: "Wert fehlt." }];
  }
  if (isSpreadsheetFormula(normalized)) {
    return [
      {
        code: "CSV_INJECTION",
        field,
        message: "Formelähnlicher Tabelleninhalt ist nicht erlaubt.",
      },
    ];
  }
  // eslint-disable-next-line no-control-regex -- price-book text must reject C0 controls.
  const hasControlCharacter = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(
    normalized,
  );
  if (normalized.length > maxLength || hasControlCharacter) {
    return [
      {
        code: "INVALID_TEXT",
        field,
        message: "Text enthält ungültige Zeichen oder ist zu lang.",
      },
    ];
  }
  return [];
}

export function validateManualInput(
  input: ManualPriceBookItemInput,
): ImportIssue[] {
  const issues: ImportIssue[] = [];
  issues.push(...validateSafeText(input.code, "code", 50));
  if (input.code && !CODE_PATTERN.test(normalizeCode(input.code))) {
    issues.push({
      code: "INVALID_CODE",
      field: "code",
      message: "Positionscode hat ein ungültiges Format.",
    });
  }
  issues.push(
    ...validateSafeText(input.description, "description", MAX_TEXT_LENGTH),
  );
  issues.push(
    ...validateSafeText(input.category, "category", MAX_CATEGORY_LENGTH),
  );
  for (const synonym of input.synonyms ?? []) {
    issues.push(...validateSafeText(synonym, "synonyms", MAX_TEXT_LENGTH));
  }
  if (
    !Number.isSafeInteger(input.unitPriceMinor) ||
    input.unitPriceMinor <= 0
  ) {
    issues.push({
      code: "INVALID_MONEY",
      field: "unitPrice",
      message: "Preis muss positiv und in sicheren Cent angegeben sein.",
    });
  }
  const expectedTaxRate = TAX_RATE_BY_CATEGORY[input.taxCategory];
  const actualTaxRate = input.taxRateBasisPoints ?? expectedTaxRate;
  if (actualTaxRate !== expectedTaxRate) {
    issues.push({
      code: "INVALID_TAX",
      field: "taxRate",
      message: "Steuersatz passt nicht zur Steuerkategorie.",
    });
  }
  if (input.validFrom && !isValidIsoDate(input.validFrom)) {
    issues.push({
      code: "INVALID_DATE",
      field: "validFrom",
      message: "Gültig-ab muss YYYY-MM-DD entsprechen.",
    });
  }
  if (input.validTo && !isValidIsoDate(input.validTo)) {
    issues.push({
      code: "INVALID_DATE",
      field: "validTo",
      message: "Gültig-bis muss YYYY-MM-DD entsprechen.",
    });
  }
  if (!validateDateRange(input.validFrom, input.validTo)) {
    issues.push({
      code: "INVALID_DATE_RANGE",
      field: "validTo",
      message: "Gültig-bis liegt vor Gültig-ab.",
    });
  }
  return issues;
}

export function buildCommercialItem(input: {
  id: EntityId;
  organisationId: OrganisationId;
  priceBookId: EntityId;
  data: ManualPriceBookItemInput;
  approvalStatus: CommercialPriceBookItem["approvalStatus"];
  active: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  version: number;
}): CommercialPriceBookItem {
  const issues = validateManualInput(input.data);
  if (issues.length > 0) {
    throw new PriceBookValidationError("Preisposition ist ungültig.", issues);
  }
  if (input.active && input.approvalStatus !== "APPROVED") {
    throw new PriceBookValidationError(
      "Nur freigegebene Positionen dürfen aktiv sein.",
      [
        {
          code: "INVALID_ACTIVE",
          field: "active",
          message: "Entwurfsposition kann nicht aktiviert werden.",
        },
      ],
    );
  }

  const base: CommercialPriceBookItem = {
    id: input.id,
    organisationId: input.organisationId,
    priceBookId: input.priceBookId,
    code: normalizeCode(input.data.code),
    description: normalizeText(input.data.description),
    category: normalizeText(input.data.category),
    unit: input.data.unit,
    unitPrice: { currency: "EUR", minor: input.data.unitPriceMinor },
    taxCategory: input.data.taxCategory,
    taxRateBasisPoints:
      input.data.taxRateBasisPoints ??
      TAX_RATE_BY_CATEGORY[input.data.taxCategory],
    active: input.active,
    synonyms: [...new Set((input.data.synonyms ?? []).map(normalizeText))],
    approvalStatus: input.approvalStatus,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    version: input.version,
  };
  if (input.data.validFrom) base.validFrom = input.data.validFrom;
  if (input.data.validTo) base.validTo = input.data.validTo;
  return base;
}

export function stableEntityId(...parts: readonly string[]): EntityId {
  let hash = 2_166_136_261;
  for (const character of parts.join("\u001f")) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return `pb-${(hash >>> 0).toString(16).padStart(8, "0")}` as EntityId;
}

export const PRICEBOOK_TEXT_LIMITS = {
  code: 50,
  description: MAX_TEXT_LENGTH,
  category: MAX_CATEGORY_LENGTH,
} as const;
