import type { Money, OfferLine, Quantity, Unit } from "@handwerk/contracts";

const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.(\d{1,3}))?$/;
const MAX_QUANTITY_SCALED = 1_000_000_000n;

interface ParsedDecimal {
  normalized: string;
  unscaled: bigint;
  scale: bigint;
}

function parseDecimal(value: string): ParsedDecimal {
  const trimmed = value.trim();
  const match = DECIMAL_PATTERN.exec(trimmed);
  if (!match) {
    throw new RangeError(
      "Die Menge muss eine positive Dezimalzahl mit höchstens drei Nachkommastellen sein.",
    );
  }

  const [whole = "0", fraction = ""] = trimmed.split(".");
  const scale = 10n ** BigInt(fraction.length);
  const unscaled = BigInt(whole) * scale + BigInt(fraction || "0");
  if (unscaled <= 0n || unscaled * (1000n / scale) > MAX_QUANTITY_SCALED) {
    throw new RangeError("Die Menge muss zwischen 0,001 und 1.000.000 liegen.");
  }

  const normalizedFraction = fraction.replace(/0+$/, "");
  return {
    normalized: normalizedFraction
      ? `${BigInt(whole)}.${normalizedFraction}`
      : `${BigInt(whole)}`,
    unscaled,
    scale,
  };
}

export function normalizeQuantityValue(value: string, unit: Unit): string {
  const parsed = parseDecimal(value);
  if (unit === "STK" && parsed.unscaled % parsed.scale !== 0n) {
    throw new RangeError("Stückmengen müssen ganzzahlig sein.");
  }
  if (unit === "PAUSCHALE" && parsed.normalized !== "1") {
    throw new RangeError("Eine Pauschalposition muss die Menge 1 haben.");
  }
  return parsed.normalized;
}

function asSafeMinor(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(
      "Der berechnete Geldbetrag liegt außerhalb des sicheren Bereichs.",
    );
  }
  return Number(value);
}

function assertMinor(minor: number): void {
  if (!Number.isSafeInteger(minor) || minor < 0) {
    throw new RangeError(
      "Geldbeträge müssen nicht-negative, sichere Ganzzahlen in Cent sein.",
    );
  }
}

export function roundRatioHalfUp(
  numerator: bigint,
  denominator: bigint,
): bigint {
  if (numerator < 0n || denominator <= 0n) {
    throw new RangeError(
      "Nur nicht-negative Beträge mit positivem Divisor sind zulässig.",
    );
  }
  return (numerator * 2n + denominator) / (denominator * 2n);
}

export function calculateLineAmounts(
  quantity: Quantity,
  unitPrice: Money,
  taxRateBasisPoints: number,
): Pick<OfferLine, "netTotal" | "taxTotal" | "grossTotal" | "calculation"> {
  assertMinor(unitPrice.minor);
  if (
    !Number.isSafeInteger(taxRateBasisPoints) ||
    taxRateBasisPoints < 0 ||
    taxRateBasisPoints > 10_000
  ) {
    throw new RangeError(
      "Der Steuersatz muss in ganzzahligen Basispunkten zwischen 0 und 10.000 liegen.",
    );
  }

  const normalized = normalizeQuantityValue(quantity.value, quantity.unit);
  const parsed = parseDecimal(normalized);
  const netMinor = asSafeMinor(
    roundRatioHalfUp(BigInt(unitPrice.minor) * parsed.unscaled, parsed.scale),
  );
  const taxMinor = asSafeMinor(
    roundRatioHalfUp(BigInt(netMinor) * BigInt(taxRateBasisPoints), 10_000n),
  );
  const grossMinor = asSafeMinor(BigInt(netMinor) + BigInt(taxMinor));

  return {
    netTotal: { currency: "EUR", minor: netMinor },
    taxTotal: { currency: "EUR", minor: taxMinor },
    grossTotal: { currency: "EUR", minor: grossMinor },
    calculation: `${normalized} ${quantity.unit} × ${formatMinor(unitPrice.minor)} EUR`,
  };
}

export function formatMinor(minor: number): string {
  assertMinor(minor);
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}

export function sumSafeMinor(values: readonly number[]): number {
  const total = values.reduce((sum, value) => {
    assertMinor(value);
    return sum + BigInt(value);
  }, 0n);
  return asSafeMinor(total);
}
