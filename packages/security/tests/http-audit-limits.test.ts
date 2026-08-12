import { describe, expect, it } from "vitest";

import {
  AuditService,
  InMemoryFixedWindowRateLimiter,
  SECURITY_LIMITS,
  assertBoundedJson,
  assertRequestSize,
  buildSafeDownloadHeaders,
  buildSecurityHeaders,
  createCsrfCookie,
  createSessionCookie,
  enforceRateLimit,
  sanitizeAuditMetadata,
  sanitizeFilename,
  sanitizeLogFields,
} from "../src/index";
import {
  NOW,
  PROJECT_A,
  RAW_TRANSCRIPT,
  createAggregate,
  createContext,
  MemoryAuditStore,
} from "./helpers";

const TOKEN = "safe_token_abcdefghijklmnopqrstuvwxyz123456789";

describe("HTTP security posture", () => {
  it("sets hardened production headers", () => {
    const headers = buildSecurityHeaders("production");
    expect(headers["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(headers["Content-Security-Policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers["Strict-Transport-Security"]).toContain("max-age=31536000");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Cache-Control"]).toContain("no-store");
  });

  it("creates bounded HttpOnly session and strict CSRF cookies", () => {
    expect(
      createSessionCookie(TOKEN, { secure: true, maxAgeSeconds: 3_600 }),
    ).toContain("HttpOnly");
    expect(
      createSessionCookie(TOKEN, { secure: true, maxAgeSeconds: 3_600 }),
    ).toContain("SameSite=Lax");
    expect(
      createCsrfCookie(TOKEN, { secure: true, maxAgeSeconds: 3_600 }),
    ).not.toContain("HttpOnly");
    expect(
      createCsrfCookie(TOKEN, { secure: true, maxAgeSeconds: 3_600 }),
    ).toContain("SameSite=Strict");
  });

  it("neutralizes traversal, CRLF, and header injection in download filenames", () => {
    const malicious = "../../bericht\r\nContent-Type:text/html?.json";
    const safe = sanitizeFilename(malicious);
    const headers = buildSafeDownloadHeaders({
      filename: malicious,
      mediaType: "application/json",
      sizeBytes: 42,
    });
    expect(safe).not.toMatch(/[\\/\r\n?]/);
    expect(headers["Content-Disposition"]).not.toMatch(/[\r\n]/);
    expect(headers["Content-Disposition"]).toContain("attachment");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });
});

describe("audit allowlist and log redaction", () => {
  it("drops raw transcript, address, signed URL, and injection-shaped values", async () => {
    const sanitized = sanitizeAuditMetadata("EXTRACTION_COMPLETED", {
      outcome: "SUCCEEDED",
      factCount: 4,
      transcript: RAW_TRANSCRIPT,
      address: "Geheimstraße 7",
      signedUrl: "https://storage.invalid/token",
      provider: RAW_TRANSCRIPT,
    });
    expect(sanitized).toEqual({ outcome: "SUCCEEDED", factCount: 4 });
    expect(JSON.stringify(sanitized)).not.toContain(RAW_TRANSCRIPT);

    const logs = sanitizeLogFields({
      requestId: "request-123",
      outcome: "SUCCEEDED",
      transcript: RAW_TRANSCRIPT,
      error: new Error(RAW_TRANSCRIPT),
      address: "Geheimstraße 7",
    });
    expect(logs).toEqual({ requestId: "request-123", outcome: "SUCCEEDED" });

    const store = new MemoryAuditStore();
    const service = new AuditService({
      store,
      now: () => NOW,
      createId: () => "audit-created-1",
    });
    await service.record({
      context: createContext(),
      project: createAggregate().project,
      type: "DATA_EXPORT_REQUESTED",
      metadata: {
        projectId: PROJECT_A,
        format: "JSON",
        sizeBytes: 100,
        rawPayload: RAW_TRANSCRIPT,
      },
    });
    expect(JSON.stringify(store.events)).not.toContain(RAW_TRANSCRIPT);
  });
});

describe("abuse controls and payload bounds", () => {
  it("enforces byte limits", () => {
    expect(
      captureError(() =>
        assertRequestSize("UPLOAD", SECURITY_LIMITS.UPLOAD.maxBytes + 1),
      ),
    ).toMatchObject({
      code: "VALIDATION_FAILED",
      fieldErrors: {
        sizeBytes: ["Die Anfrage überschreitet das Größenlimit."],
      },
    });
    expect(() =>
      assertRequestSize("UPLOAD", SECURITY_LIMITS.UPLOAD.maxBytes),
    ).not.toThrow();
  });

  it("rate-limits by action, tenant, actor, and session", () => {
    const limiter = new InMemoryFixedWindowRateLimiter();
    const context = createContext();
    const policy = SECURITY_LIMITS.DELETION;
    for (let index = 0; index < policy.maxRequests; index += 1) {
      expect(() =>
        enforceRateLimit("DELETION", context, limiter, 1_000),
      ).not.toThrow();
    }
    expect(() =>
      enforceRateLimit("DELETION", context, limiter, 1_000),
    ).toThrowError(/Zu viele Anfragen/);
  });

  it("rejects deeply nested or oversized untrusted payloads", () => {
    expect(
      captureError(() =>
        assertBoundedJson(
          { level: { level: { level: RAW_TRANSCRIPT } } },
          {
            maxDepth: 2,
            maxKeys: 10,
            maxArrayLength: 10,
            maxStringLength: 100,
          },
        ),
      ),
    ).toMatchObject({
      code: "VALIDATION_FAILED",
      fieldErrors: { request: ["Die Eingabe ist zu tief verschachtelt."] },
    });
    expect(
      captureError(() =>
        assertBoundedJson([1, 2, 3], {
          maxDepth: 2,
          maxKeys: 10,
          maxArrayLength: 2,
          maxStringLength: 100,
        }),
      ),
    ).toMatchObject({
      code: "VALIDATION_FAILED",
      fieldErrors: { request: ["Die Liste enthält zu viele Einträge."] },
    });
  });
});

function captureError(operation: () => void): unknown {
  try {
    operation();
  } catch (error) {
    return error;
  }
  throw new Error("Expected operation to fail");
}
