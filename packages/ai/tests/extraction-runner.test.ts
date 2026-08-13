import { describe, expect, it, vi } from "vitest";

import {
  CANONICAL_EXTRACTION_RESULT,
  ProviderCallError,
  StructuredExtractionRunner,
  createDeterministicFakeProvider,
  type StructuredExtractionProvider,
} from "../src/index.js";
import { canonicalEvidence } from "./test-data.js";

const descriptor = {
  kind: "DETERMINISTIC_FAKE" as const,
  name: "synthetic-test-provider",
  model: "synthetic-test-v1",
};

describe("structured extraction runner", () => {
  it("is deterministic and replays successful idempotent calls", async () => {
    const provider = createDeterministicFakeProvider().extraction;
    const extractSpy = vi.spyOn(provider, "extract");
    const runner = new StructuredExtractionRunner(provider, { maxAttempts: 1 });

    const first = await runner.run({
      idempotencyKey: "canonical-idempotency-key",
      evidence: canonicalEvidence(),
    });
    const replay = await runner.run({
      idempotencyKey: "canonical-idempotency-key",
      evidence: canonicalEvidence(),
    });
    const independent = await runner.run({
      idempotencyKey: "canonical-independent-key",
      evidence: canonicalEvidence(),
    });

    expect(first.ok).toBe(true);
    expect(replay.ok).toBe(true);
    expect(independent.ok).toBe(true);
    if (first.ok && replay.ok && independent.ok) {
      expect(first.data).toEqual(replay.data);
      expect(first.data).toEqual(independent.data);
      expect(replay.cached).toBe(true);
    }
    expect(extractSpy).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent calls with the same idempotency key", async () => {
    let resolveProvider: ((value: unknown) => void) | undefined;
    const extract = vi.fn<StructuredExtractionProvider["extract"]>(
      async () =>
        new Promise<unknown>((resolve) => {
          resolveProvider = resolve;
        }),
    );
    const runner = new StructuredExtractionRunner(
      { descriptor, extract },
      { maxAttempts: 1 },
    );
    const request = {
      idempotencyKey: "concurrent-idempotency-key",
      evidence: canonicalEvidence(),
    };

    const first = runner.run(request);
    const second = runner.run(request);
    await vi.waitFor(() => expect(extract).toHaveBeenCalledTimes(1));
    resolveProvider?.(CANONICAL_EXTRACTION_RESULT);

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toEqual(secondResult);
    expect(firstResult.ok).toBe(true);
    expect(extract).toHaveBeenCalledTimes(1);
  });

  it("retries a bounded transient failure and then succeeds", async () => {
    const extract = vi
      .fn<StructuredExtractionProvider["extract"]>()
      .mockRejectedValueOnce(new ProviderCallError({ retryable: true }))
      .mockResolvedValueOnce(CANONICAL_EXTRACTION_RESULT);
    const provider: StructuredExtractionProvider = { descriptor, extract };
    const runner = new StructuredExtractionRunner(provider, {
      maxAttempts: 2,
      baseRetryDelayMs: 1,
      sleep: async () => undefined,
    });

    const result = await runner.run({
      idempotencyKey: "transient-provider-error",
      evidence: canonicalEvidence(),
    });

    expect(result.ok).toBe(true);
    expect(result.metadata.attemptCount).toBe(2);
    expect(extract).toHaveBeenCalledTimes(2);
  });

  it("times out with a recoverable fail-safe result after bounded retries", async () => {
    const extract = vi.fn<StructuredExtractionProvider["extract"]>(
      async (request) =>
        new Promise<never>((_resolve, reject) => {
          request.signal.addEventListener(
            "abort",
            () => reject(new DOMException("cancelled", "AbortError")),
            { once: true },
          );
        }),
    );
    const runner = new StructuredExtractionRunner(
      { descriptor, extract },
      {
        timeoutMs: 5,
        maxAttempts: 2,
        baseRetryDelayMs: 0,
        maxRetryDelayMs: 0,
      },
    );

    const result = await runner.run({
      idempotencyKey: "timeout-provider",
      evidence: canonicalEvidence(),
    });

    expect(result).toMatchObject({
      ok: false,
      state: "FAILED_SAFE",
      failure: { code: "TIMEOUT", recoverable: true },
      metadata: { outcome: "FAILED_SAFE", attemptCount: 2 },
    });
    expect(extract).toHaveBeenCalledTimes(2);
  });

  it("honours caller cancellation without retrying", async () => {
    const extract = vi.fn<StructuredExtractionProvider["extract"]>(
      async () => new Promise<never>(() => undefined),
    );
    const runner = new StructuredExtractionRunner(
      { descriptor, extract },
      { timeoutMs: 100, maxAttempts: 3 },
    );
    const controller = new AbortController();
    const pending = runner.run({
      idempotencyKey: "cancelled-provider",
      evidence: canonicalEvidence(),
      signal: controller.signal,
    });
    controller.abort();

    const result = await pending;
    expect(result).toMatchObject({
      ok: false,
      state: "FAILED_SAFE",
      failure: { code: "CANCELLED", recoverable: true },
      metadata: { attemptCount: 1 },
    });
    expect(extract).toHaveBeenCalledTimes(1);
  });

  it("fails an idempotency-key conflict before another provider call", async () => {
    const provider = createDeterministicFakeProvider().extraction;
    const extractSpy = vi.spyOn(provider, "extract");
    const runner = new StructuredExtractionRunner(provider, { maxAttempts: 1 });
    const firstEvidence = canonicalEvidence();
    const revisedEvidence = canonicalEvidence();
    revisedEvidence.evidenceRevision = "synthetic-revision-2";

    await runner.run({
      idempotencyKey: "reused-key",
      evidence: firstEvidence,
    });
    const conflict = await runner.run({
      idempotencyKey: "reused-key",
      evidence: revisedEvidence,
    });

    expect(conflict).toMatchObject({
      ok: false,
      failure: { code: "IDEMPOTENCY_CONFLICT", recoverable: false },
      metadata: { attemptCount: 0 },
    });
    expect(extractSpy).toHaveBeenCalledTimes(1);
  });

  it("fails closed on invalid output and omits sensitive provider content from metadata", async () => {
    const marker = "synthetic-sensitive-transcript-marker";
    const provider: StructuredExtractionProvider = {
      descriptor,
      extract: vi.fn(async () => ({
        contractVersion: "handwerk.vertical-slice.v1",
        facts: [],
        missingFields: [],
        rawTranscript: marker,
      })),
    };
    const runner = new StructuredExtractionRunner(provider, { maxAttempts: 3 });

    const result = await runner.run({
      idempotencyKey: "invalid-output",
      evidence: canonicalEvidence("invalid-output", marker),
    });

    expect(result).toMatchObject({
      ok: false,
      state: "FAILED_SAFE",
      failure: { code: "INVALID_OUTPUT" },
      metadata: { attemptCount: 1, tokenCountPlaceholder: 0 },
    });
    expect(JSON.stringify(result)).not.toContain(marker);
  });
});
