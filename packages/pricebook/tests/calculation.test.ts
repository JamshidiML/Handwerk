import { describe, expect, it } from "vitest";
import {
  CommercialCalculationError,
  calculateCommercialAmounts,
  parseMoneyMinor,
  parsePositiveDecimal,
} from "../src";

describe("integer-minor commercial calculations", () => {
  it("calculates the canonical wall line with stable German explanation", () => {
    const amounts = calculateCommercialAmounts(
      { value: "52", unit: "M2" },
      { currency: "EUR", minor: 850 },
      1_900,
    );

    expect(amounts.netTotal.minor).toBe(44_200);
    expect(amounts.taxTotal.minor).toBe(8_398);
    expect(amounts.grossTotal.minor).toBe(52_598);
    expect(amounts.calculation).toBe(
      "52 m² × 8,50 € = 442,00 € netto; 19,00 % MwSt. = 83,98 €; 525,98 € brutto.",
    );
  });

  it("parses German decimal formats without binary floating point", () => {
    expect(parseMoneyMinor("1.234,56")).toBe(123_456);
    expect(parseMoneyMinor("8,50")).toBe(850);
    expect(parsePositiveDecimal("1,005")?.canonical).toBe("1.005");
  });

  it("rounds exact half-cent edges half-up", () => {
    const amounts = calculateCommercialAmounts(
      { value: "0.5", unit: "STK" },
      { currency: "EUR", minor: 1 },
      0,
    );
    expect(amounts.netTotal.minor).toBe(1);

    const quantityEdge = calculateCommercialAmounts(
      { value: "1.005", unit: "M2" },
      { currency: "EUR", minor: 100 },
      0,
    );
    expect(quantityEdge.netTotal.minor).toBe(101);
  });

  it.each(["0", "0,00", "-1", "+1"])("rejects invalid quantity %s", (value) => {
    expect(() =>
      calculateCommercialAmounts(
        { value, unit: "M2" },
        { currency: "EUR", minor: 100 },
        1_900,
      ),
    ).toThrow(CommercialCalculationError);
  });

  it("rejects unsafe large totals and sub-cent lines", () => {
    expect(() =>
      calculateCommercialAmounts(
        { value: "9007199254740991", unit: "M2" },
        { currency: "EUR", minor: 2 },
        0,
      ),
    ).toThrow("sicheren Wertebereich");
    expect(() =>
      calculateCommercialAmounts(
        { value: "0.000001", unit: "M2" },
        { currency: "EUR", minor: 1 },
        0,
      ),
    ).toThrow("unter einem Cent");
  });
});
