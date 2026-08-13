import type { EntityId, Measurement, Unit, UserId } from "@handwerk/contracts";

export type ExplicitMeasurementDraft = Pick<
  Measurement,
  | "authority"
  | "confirmedByUserId"
  | "context"
  | "label"
  | "quantity"
  | "siteVisitId"
>;

export interface MeasurementFormValues {
  readonly confirmed: boolean;
  readonly context: string;
  readonly label: string;
  readonly siteVisitId: EntityId;
  readonly unit: Unit;
  readonly userId: UserId;
  readonly value: string;
}

export interface MeasurementValidationResult {
  readonly draft?: ExplicitMeasurementDraft;
  readonly errors: Readonly<
    Partial<Record<"confirmed" | "context" | "label" | "value", string>>
  >;
}

export function normaliseMeasurementValue(value: string): string | undefined {
  const normalised = value.trim().replace(",", ".");
  if (!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,3})?$/.test(normalised)) {
    return undefined;
  }

  const [whole = "0", fraction] = normalised.split(".");
  if (whole === "0" && (!fraction || /^0+$/.test(fraction))) return undefined;
  const trimmedFraction = fraction?.replace(/0+$/, "");
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

export function validateMeasurement(
  values: MeasurementFormValues,
): MeasurementValidationResult {
  const errors: Partial<
    Record<"confirmed" | "context" | "label" | "value", string>
  > = {};
  const label = values.label.trim();
  const context = values.context.trim();
  const value = normaliseMeasurementValue(values.value);

  if (label.length < 2 || label.length > 80) {
    errors.label = "Bezeichnung mit 2 bis 80 Zeichen eingeben.";
  }
  if (context.length < 2 || context.length > 120) {
    errors.context = "Raum oder Bereich mit 2 bis 120 Zeichen eingeben.";
  }
  if (!value) {
    errors.value =
      "Positive Zahl mit höchstens drei Nachkommastellen eingeben.";
  }
  if (!values.confirmed) {
    errors.confirmed = "Messwert vor dem Hinzufügen bestätigen.";
  }

  if (Object.keys(errors).length > 0 || !value) return { errors };
  return {
    draft: {
      authority: "AUTHORITATIVE",
      confirmedByUserId: values.userId,
      context,
      label,
      quantity: { unit: values.unit, value },
      siteVisitId: values.siteVisitId,
    },
    errors,
  };
}
