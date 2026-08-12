import type { EntityId, UserId } from "@handwerk/contracts";
import { describe, expect, it } from "vitest";
import { normaliseMeasurementValue, validateMeasurement } from "./measurement";

const SITE_VISIT_ID = "visit-synthetic-001" as EntityId;
const USER_ID = "user-synthetic-001" as UserId;

describe("explicit measurement validation", () => {
  it.each([
    ["52", "52"],
    ["52,0", "52"],
    ["20.250", "20.25"],
    ["0,125", "0.125"],
  ])("normalises locale-safe positive quantity %s", (input, expected) => {
    expect(normaliseMeasurementValue(input)).toBe(expected);
  });

  it.each(["", "0", "-2", "1.2345", "1,2,3", "10000000"])(
    "rejects invalid quantity %s",
    (input) => {
      expect(normaliseMeasurementValue(input)).toBeUndefined();
    },
  );

  it("emits a separate authoritative measurement only after confirmation", () => {
    const result = validateMeasurement({
      confirmed: true,
      context: "Wohnzimmer",
      label: "Wandfläche",
      siteVisitId: SITE_VISIT_ID,
      unit: "M2",
      userId: USER_ID,
      value: "52,0",
    });

    expect(result.errors).toEqual({});
    expect(result.draft).toEqual({
      authority: "AUTHORITATIVE",
      confirmedByUserId: USER_ID,
      context: "Wohnzimmer",
      label: "Wandfläche",
      quantity: { unit: "M2", value: "52" },
      siteVisitId: SITE_VISIT_ID,
    });
    expect(result.draft).not.toHaveProperty("photoEvidenceId");
  });

  it("does not emit an unconfirmed measurement", () => {
    const result = validateMeasurement({
      confirmed: false,
      context: "Wohnzimmer",
      label: "Deckenfläche",
      siteVisitId: SITE_VISIT_ID,
      unit: "M2",
      userId: USER_ID,
      value: "20",
    });

    expect(result.draft).toBeUndefined();
    expect(result.errors.confirmed).toMatch(/bestätigen/i);
  });
});
