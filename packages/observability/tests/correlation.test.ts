import { describe, expect, it } from "vitest";
import {
  correlationIdFrom,
  isCorrelationId,
  privacyHash,
} from "../src/correlation";

describe("correlation IDs", () => {
  it("keeps a constrained caller-supplied ID", () => {
    expect(correlationIdFrom({ "x-correlation-id": "request-12345678" })).toBe(
      "request-12345678",
    );
  });

  it("replaces invalid IDs", () => {
    const id = correlationIdFrom({
      "x-correlation-id": "contains customer@example.test",
    });
    expect(id).not.toContain("customer");
    expect(isCorrelationId(id)).toBe(true);
  });

  it("creates stable non-reversible identifier hashes", () => {
    const salt = "synthetic-test-salt-value";
    expect(privacyHash("org-westblick", salt)).toMatch(/^[a-f0-9]{16}$/);
    expect(privacyHash("org-westblick", salt)).toBe(
      privacyHash("org-westblick", salt),
    );
    expect(privacyHash("org-other", salt)).not.toBe(
      privacyHash("org-westblick", salt),
    );
  });
});
