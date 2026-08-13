import { describe, expect, it } from "vitest";
import { createMetrics } from "../src/metrics";

describe("privacy-preserving metrics", () => {
  it("records fixed low-cardinality dimensions in local mode", () => {
    const metrics = createMetrics("local");
    metrics.record({
      name: "processing.duration_ms",
      value: 245,
      labels: { stage: "extraction", outcome: "success" },
    });
    metrics.record({
      name: "mapping.result_total",
      value: 1,
      labels: { result: "supported" },
    });

    expect(metrics.snapshot()).toHaveLength(2);
  });

  it("drops all points in disabled mode", () => {
    const metrics = createMetrics("disabled");
    metrics.record({ name: "clarification.count", value: 2, labels: {} });
    expect(metrics.snapshot()).toEqual([]);
  });

  it("rejects customer-controlled labels and invalid values", () => {
    const metrics = createMetrics("local");
    expect(() =>
      metrics.record({
        name: "mapping.result_total",
        value: 1,
        labels: { result: "supported", customer: "Beispielkundin 01" },
      }),
    ).toThrow("invalid label keys");
    expect(() =>
      metrics.record({
        name: "draft.edit_total",
        value: -1,
        labels: { field: "quantity" },
      }),
    ).toThrow("finite non-negative");
  });
});
