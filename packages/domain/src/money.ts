import type { Money, OfferLine, Quantity, Unit } from "@handwerk/contracts";

import { invariant } from "./errors";

const DECIMAL_PATTERN = /^(\d+)(?:\.(\d+))?$/;
const MAX_QUANTITY_INTEGER_DIGITS = 12;
const MAX_QUANTITY_SCALE = 6;
const BASIS_POINT_DENOMINATOR = 10_000n;

interface ParsedDecimal {
  coefficient: bigint;
  denominator: bigint;
  normalized: string;
  scale: number;
}

function toSafeMinor(value: bigint): number {
  invariant(
    value >= BigInt(Number.MIN_SAFE_INTEGER) &&
      value <= BigInt(Number.MAX_SAFE_INTEGER),
    "INVALID_MONEY",
    "The calculated money amount exceeds the supported safe-integer range.",
  );
  return Number(value);
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  invariant(
    numerator >= 0n && denominator > 0n,
    "INVALID_MONEY",
    "Commercial rounding only supports non-negative values.",
  );

  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

export function parseDecimalQuantity(value: string): ParsedDecimal {
  invariant(
    typeof value === "string" && value.length > 0,
    "INVALID_QUANTITY",
    "Quantity must be a non-empty decimal string.",
  );

  const match = DECIMAL_PATTERN.exec(value);
  invariant(
    match !== null,
    "INVALID_QUANTITY",
    "Quantity must use canonical decimal notation with a dot separator.",
  );

  const integerPart = match[1] ?? "";
  const fractionalPart = match[2] ?? "";
  invariant(
    integerPart.length <= MAX_QUANTITY_INTEGER_DIGITS,
    "INVALID_QUANTITY",
    `Quantity supports at most ${MAX_QUANTITY_INTEGER_DIGITS} integer digits.`,
  );
  invariant(
    fractionalPart.length <= MAX_QUANTITY_SCALE,
    "INVALID_QUANTITY",
    `Quantity supports at most ${MAX_QUANTITY_SCALE} decimal places.`,
  );

  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "");
  const normalizedFraction = fractionalPart.replace(/0+$/, "");
  const normalized =
    normalizedFraction.length > 0
      ? `${normalizedInteger}.${normalizedFraction}`
      : normalizedInteger;
  const scale = fractionalPart.length;
  const denominator = 10n ** BigInt(scale);
  const coefficient = BigInt(`${integerPart}${fractionalPart}`);

  return { coefficient, denominator, normalized, scale };
}

export function canonicalQuantity(quantity: Quantity): Quantity {
  const parsed = parseDecimalQuantity(quantity.value);
  return { value: parsed.normalized, unit: quantity.unit };
}

export function assertPositiveQuantity(quantity: Quantity): void {
  const parsed = parseDecimalQuantity(quantity.value);
  invariant(
    parsed.coefficient > 0n,
    "INVALID_QUANTITY",
    "A priced quantity must be greater than zero.",
  );
}

export function assertCompatibleUnits(
  quantityUnit: Unit,
  priceBookUnit: Unit,
): void {
  invariant(
    quantityUnit === priceBookUnit,
    "INCOMPATIBLE_UNIT",
    `Quantity unit ${quantityUnit} is incompatible with price-book unit ${priceBookUnit}.`,
  );
}

export function money(minor: number): Money {
  invariant(
    Number.isSafeInteger(minor) && minor >= 0,
    "INVALID_MONEY",
    "EUR minor units must be a non-negative safe integer.",
  );
  return { currency: "EUR", minor };
}

export function assertMoney(value: Money): void {
  invariant(
    value.currency === "EUR" &&
      Number.isSafeInteger(value.minor) &&
      value.minor >= 0,
    "INVALID_MONEY",
    "Money must contain non-negative integer EUR minor units.",
  );
}

export interface LineAmounts {
  netTotal: Money;
  taxTotal: Money;
  grossTotal: Money;
}

export function calculateLineAmounts(
  unitPrice: Money,
  quantity: Quantity,
  taxRateBasisPoints: number,
): LineAmounts {
  assertMoney(unitPrice);
  assertPositiveQuantity(quantity);
  invariant(
    Number.isInteger(taxRateBasisPoints) &&
      taxRateBasisPoints >= 0 &&
      taxRateBasisPoints <= 10_000,
    "INVALID_MONEY",
    "Tax rate must be an integer between 0 and 10,000 basis points.",
  );

  const parsed = parseDecimalQuantity(quantity.value);
  const netMinor = roundHalfUp(
    BigInt(unitPrice.minor) * parsed.coefficient,
    parsed.denominator,
  );
  const taxMinor = roundHalfUp(
    netMinor * BigInt(taxRateBasisPoints),
    BASIS_POINT_DENOMINATOR,
  );

  return {
    netTotal: money(toSafeMinor(netMinor)),
    taxTotal: money(toSafeMinor(taxMinor)),
    grossTotal: money(toSafeMinor(netMinor + taxMinor)),
  };
}

export function sumMoney(values: readonly Money[]): Money {
  const total = values.reduce((sum, value) => {
    assertMoney(value);
    return sum + BigInt(value.minor);
  }, 0n);
  return money(toSafeMinor(total));
}

export function calculateOfferTotals(lines: readonly OfferLine[]): LineAmounts {
  return {
    netTotal: sumMoney(lines.map((line) => line.netTotal)),
    taxTotal: sumMoney(lines.map((line) => line.taxTotal)),
    grossTotal: sumMoney(lines.map((line) => line.grossTotal)),
  };
}
