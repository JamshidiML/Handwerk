"use client";

import type { EntityId, Unit, UserId } from "@handwerk/contracts";
import { Plus } from "lucide-react";
import { useId, useState } from "react";
import styles from "./Capture.module.css";
import {
  validateMeasurement,
  type ExplicitMeasurementDraft,
} from "./measurement";

const UNITS: ReadonlyArray<{ readonly label: string; readonly value: Unit }> = [
  { label: "m²", value: "M2" },
  { label: "m", value: "M" },
  { label: "Stk.", value: "STK" },
  { label: "Std.", value: "STD" },
  { label: "Pauschal", value: "PAUSCHALE" },
];

export interface MeasurementEntryProps {
  readonly onAdd: (draft: ExplicitMeasurementDraft) => void;
  readonly siteVisitId: EntityId;
  readonly userId: UserId;
}

export function MeasurementEntry({
  onAdd,
  siteVisitId,
  userId,
}: MeasurementEntryProps) {
  const formId = useId();
  const [label, setLabel] = useState("");
  const [context, setContext] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<Unit>("M2");
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<
    Readonly<
      Partial<Record<"confirmed" | "context" | "label" | "value", string>>
    >
  >({});

  function addMeasurement() {
    const result = validateMeasurement({
      confirmed,
      context,
      label,
      siteVisitId,
      unit,
      userId,
      value,
    });
    setErrors(result.errors);
    if (!result.draft) return;

    onAdd(result.draft);
    setLabel("");
    setContext("");
    setValue("");
    setUnit("M2");
    setConfirmed(false);
  }

  return (
    <section className={styles.section} aria-labelledby={`${formId}-title`}>
      <div className={styles.sectionHeading}>
        <h2 id={`${formId}-title`}>Messwerte</h2>
        <span className={styles.authorityBadge}>Bestätigte Quelle</span>
      </div>

      <div className={styles.measurementGrid}>
        <div className={styles.field}>
          <label htmlFor={`${formId}-label`}>Bezeichnung</label>
          <input
            aria-describedby={
              errors.label ? `${formId}-label-error` : undefined
            }
            aria-invalid={Boolean(errors.label)}
            id={`${formId}-label`}
            maxLength={80}
            onChange={(event) => setLabel(event.currentTarget.value)}
            placeholder="z. B. Wandfläche"
            value={label}
          />
          {errors.label ? (
            <span className={styles.fieldError} id={`${formId}-label-error`}>
              {errors.label}
            </span>
          ) : null}
        </div>

        <div className={styles.field}>
          <label htmlFor={`${formId}-context`}>Raum / Bereich</label>
          <input
            aria-describedby={
              errors.context ? `${formId}-context-error` : undefined
            }
            aria-invalid={Boolean(errors.context)}
            id={`${formId}-context`}
            maxLength={120}
            onChange={(event) => setContext(event.currentTarget.value)}
            placeholder="z. B. Wohnzimmer"
            value={context}
          />
          {errors.context ? (
            <span className={styles.fieldError} id={`${formId}-context-error`}>
              {errors.context}
            </span>
          ) : null}
        </div>

        <div className={styles.quantityRow}>
          <div className={styles.field}>
            <label htmlFor={`${formId}-value`}>Wert</label>
            <input
              aria-describedby={
                errors.value ? `${formId}-value-error` : undefined
              }
              aria-invalid={Boolean(errors.value)}
              id={`${formId}-value`}
              inputMode="decimal"
              onChange={(event) => setValue(event.currentTarget.value)}
              placeholder="52"
              value={value}
            />
            {errors.value ? (
              <span className={styles.fieldError} id={`${formId}-value-error`}>
                {errors.value}
              </span>
            ) : null}
          </div>
          <div className={styles.field}>
            <label htmlFor={`${formId}-unit`}>Einheit</label>
            <select
              id={`${formId}-unit`}
              onChange={(event) => setUnit(event.currentTarget.value as Unit)}
              value={unit}
            >
              {UNITS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <label className={styles.confirmation}>
        <input
          checked={confirmed}
          onChange={(event) => setConfirmed(event.currentTarget.checked)}
          type="checkbox"
        />
        <span>Ich habe diesen Messwert vor Ort geprüft.</span>
      </label>
      {errors.confirmed ? (
        <p className={styles.fieldError} role="alert">
          {errors.confirmed}
        </p>
      ) : null}

      <button
        className={styles.commandButton}
        onClick={addMeasurement}
        type="button"
      >
        <Plus aria-hidden="true" size={18} />
        Messwert hinzufügen
      </button>
    </section>
  );
}
