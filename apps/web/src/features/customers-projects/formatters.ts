import type { Money, Quantity, Unit } from "@handwerk/contracts";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Berlin",
});

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

const longDateFormatter = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Berlin",
});

const integerFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 0,
  useGrouping: true,
});

const unitLabels: Record<Unit, string> = {
  M2: "m²",
  M: "m",
  STK: "Stk.",
  STD: "Std.",
  PAUSCHALE: "pauschal",
};

export function formatDate(value: string | Date) {
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: string | Date) {
  return `${dateTimeFormatter.format(new Date(value))} Uhr`;
}

export function formatLongDate(value: string | Date) {
  const formatted = longDateFormatter.format(new Date(value));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatMoney({ currency, minor }: Money) {
  const sign = minor < 0 ? "-" : "";
  const absoluteMinor = Math.abs(minor);
  const euros = Math.trunc(absoluteMinor / 100);
  const cents = String(absoluteMinor % 100).padStart(2, "0");
  const symbol = currency === "EUR" ? "€" : currency;
  return `${sign}${integerFormatter.format(euros)},${cents} ${symbol}`;
}

export function formatDecimal(value: string) {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return value;
  const [, sign, integer, fraction] = match;
  const grouped = integerFormatter.format(BigInt(integer));
  return `${sign}${grouped}${fraction ? `,${fraction}` : ""}`;
}

export function formatQuantity(quantity: Quantity) {
  return `${formatDecimal(quantity.value)} ${unitLabels[quantity.unit]}`;
}

export function formatUnit(unit: Unit) {
  return unitLabels[unit];
}
