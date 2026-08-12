import { describe, expect, it } from "vitest";

import {
  assertCompatibleUnits,
  calculateLineAmounts,
  calculateOfferTotals,
  canonicalQuantity,
  DomainInvariantError,
  money,
  parseDecimalQuantity,
  sumMoney,
} from "../src/index";
import { draft, revision } from "./fixtures";

describe("precise commercial arithmetic", () => {
  it("stores EUR money only as non-negative safe integer minor units", () => {
    expect(money(1_234)).toEqual({ currency: "EUR", minor: 1_234 });
    expect(() => money(1.5)).toThrowError(DomainInvariantError);
    expect(() => money(-1)).toThrowError(/non-negative safe integer/);
    expect(() => money(Number.MAX_SAFE_INTEGER + 1)).toThrowError(
      /safe integer/,
    );
  });

  it("normalizes decimal strings without converting through binary floating point", () => {
    expect(canonicalQuantity({ value: "00052.5000", unit: "M2" })).toEqual({
      value: "52.5",
      unit: "M2",
    });
    expect(parseDecimalQuantity("0.000001").coefficient).toBe(1n);
  });

  it.each(["", "1,5", "1e3", ".5", "-2", "1.0000001", "1234567890123"])(
    "rejects non-canonical or unsupported quantity %s",
    (value) => {
      expect(() => parseDecimalQuantity(value)).toThrowError(
        DomainInvariantError,
      );
    },
  );

  it("rejects zero priced quantity", () => {
    expect(() =>
      calculateLineAmounts(
        { currency: "EUR", minor: 100 },
        { value: "0", unit: "M2" },
        1_900,
      ),
    ).toThrowError(/greater than zero/);
  });

  it("rounds a half cent up at line level", () => {
    expect(
      calculateLineAmounts(
        { currency: "EUR", minor: 1 },
        { value: "2.5", unit: "M2" },
        0,
      ),
    ).toEqual({
      netTotal: { currency: "EUR", minor: 3 },
      taxTotal: { currency: "EUR", minor: 0 },
      grossTotal: { currency: "EUR", minor: 3 },
    });
  });

  it("rounds net first and then tax using integer basis points", () => {
    expect(
      calculateLineAmounts(
        { currency: "EUR", minor: 1_999 },
        { value: "3.333", unit: "M2" },
        1_900,
      ),
    ).toEqual({
      netTotal: { currency: "EUR", minor: 6_663 },
      taxTotal: { currency: "EUR", minor: 1_266 },
      grossTotal: { currency: "EUR", minor: 7_929 },
    });
  });

  it("rejects fractional and out-of-range tax basis points", () => {
    expect(() =>
      calculateLineAmounts(
        { currency: "EUR", minor: 100 },
        { value: "1", unit: "M2" },
        1_900.5,
      ),
    ).toThrowError(/basis points/);
    expect(() =>
      calculateLineAmounts(
        { currency: "EUR", minor: 100 },
        { value: "1", unit: "M2" },
        10_001,
      ),
    ).toThrowError(/basis points/);
  });

  it("fails closed when a calculated amount exceeds the safe range", () => {
    expect(() =>
      calculateLineAmounts(
        { currency: "EUR", minor: Number.MAX_SAFE_INTEGER },
        { value: "2", unit: "STK" },
        0,
      ),
    ).toThrowError(/safe-integer range/);
  });

  it("adds integer minor units exactly", () => {
    expect(sumMoney([money(1), money(2), money(3)])).toEqual(money(6));
  });

  it("sums already-rounded line totals for the offer", () => {
    const current = revision(draft());
    expect(calculateOfferTotals(current.lines)).toEqual({
      netTotal: current.netTotal,
      taxTotal: current.taxTotal,
      grossTotal: current.grossTotal,
    });
  });

  it("accepts exact unit matches and rejects implicit conversions", () => {
    expect(() => assertCompatibleUnits("M2", "M2")).not.toThrow();
    expect(() => assertCompatibleUnits("M", "M2")).toThrowError(/incompatible/);
  });
});
