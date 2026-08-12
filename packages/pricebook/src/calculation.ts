import type { Money, Quantity } from "@handwerk/contracts";
import type { CalculatedCommercialAmounts } from "./types";
import { parsePositiveDecimal } from "./validation";

const UNIT_LABELS: Readonly<Record<Quantity["unit"], string>> = {
  M2: "m²",
  M: "m",
  STK: "Stk.",
  STD: "Std.",
  PAUSCHALE: "pauschal",
};

export class CommercialCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommercialCalculationError";
  }
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / BigInt(2)) / denominator;
}

function toSafeMinor(value: bigint, field: string): number {
  if (value < BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new CommercialCalculationError(
      `${field} überschreitet den sicheren Wertebereich.`,
    );
  }
  return Number(value);
}

function formatMinor(minor: number): string {
  const euros = Math.trunc(minor / 100);
  const cents = String(minor % 100).padStart(2, "0");
  return `${euros.toLocaleString("de-DE")},${cents} €`;
}

function formatTaxRate(basisPoints: number): string {
  const whole = Math.trunc(basisPoints / 100);
  const fraction = String(basisPoints % 100).padStart(2, "0");
  return `${whole},${fraction} %`;
}

export function calculateCommercialAmounts(
  quantity: Quantity,
  unitPrice: Money,
  taxRateBasisPoints: number,
): CalculatedCommercialAmounts {
  if (
    unitPrice.currency !== "EUR" ||
    !Number.isSafeInteger(unitPrice.minor) ||
    unitPrice.minor <= 0
  ) {
    throw new CommercialCalculationError(
      "Stückpreis muss als positive sichere EUR-Cent vorliegen.",
    );
  }
  if (
    !Number.isInteger(taxRateBasisPoints) ||
    taxRateBasisPoints < 0 ||
    taxRateBasisPoints > 10_000
  ) {
    throw new CommercialCalculationError("Steuersatz ist ungültig.");
  }
  const parsedQuantity = parsePositiveDecimal(quantity.value, 6);
  if (!parsedQuantity) {
    throw new CommercialCalculationError(
      "Menge muss positiv und dezimal darstellbar sein.",
    );
  }

  const denominator = BigInt(10) ** BigInt(parsedQuantity.scale);
  const netMinor = roundHalfUp(
    BigInt(unitPrice.minor) * parsedQuantity.numerator,
    denominator,
  );
  if (netMinor === BigInt(0)) {
    throw new CommercialCalculationError(
      "Berechneter Nettobetrag liegt unter einem Cent.",
    );
  }
  const taxMinor = roundHalfUp(
    netMinor * BigInt(taxRateBasisPoints),
    BigInt(10_000),
  );
  const grossMinor = netMinor + taxMinor;
  const net = toSafeMinor(netMinor, "Nettobetrag");
  const tax = toSafeMinor(taxMinor, "Steuerbetrag");
  const gross = toSafeMinor(grossMinor, "Bruttobetrag");

  return {
    netTotal: { currency: "EUR", minor: net },
    taxTotal: { currency: "EUR", minor: tax },
    grossTotal: { currency: "EUR", minor: gross },
    calculation:
      `${parsedQuantity.canonical.replace(".", ",")} ${UNIT_LABELS[quantity.unit]} × ` +
      `${formatMinor(unitPrice.minor)} = ${formatMinor(net)} netto; ` +
      `${formatTaxRate(taxRateBasisPoints)} MwSt. = ${formatMinor(tax)}; ` +
      `${formatMinor(gross)} brutto.`,
  };
}
