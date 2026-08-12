import { CONTRACT_VERSION } from "@handwerk/contracts";

import {
  ExtractionValidationError,
  parseExtractionResult,
  type ExtractionResult,
} from "./schema.js";
import {
  EXTRACTION_PROMPT_VERSION,
  EXTRACTION_SYSTEM_INSTRUCTION,
  buildUntrustedDataEnvelope,
} from "./prompt.js";
import {
  ProviderCallError,
  type ExtractionEvidence,
  type ProviderDescriptor,
  type StructuredExtractionProvider,
} from "./types.js";

export type ExtractionFailureCode =
  | "CANCELLED"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_OUTPUT"
  | "PROVIDER_ERROR"
  | "TIMEOUT";

export interface ExtractionRunMetadata {
  provider: ProviderDescriptor["kind"];
  providerName: string;
  model: string;
  promptVersion: typeof EXTRACTION_PROMPT_VERSION;
  schemaVersion: typeof CONTRACT_VERSION;
  durationMs: number;
  attemptCount: number;
  tokenCountPlaceholder: number;
  costMinorPlaceholder: number;
  outcome: "SUCCEEDED" | "FAILED_SAFE";
  failureCode?: ExtractionFailureCode;
}

export interface ExtractionExecutionSuccess {
  ok: true;
  state: "SUCCEEDED";
  data: ExtractionResult;
  metadata: ExtractionRunMetadata;
  cached: boolean;
}

export interface ExtractionExecutionFailure {
  ok: false;
  state: "FAILED_SAFE";
  failure: {
    code: ExtractionFailureCode;
    recoverable: boolean;
    message: string;
  };
  metadata: ExtractionRunMetadata;
  cached: false;
}

export type ExtractionExecutionResult =
  | ExtractionExecutionSuccess
  | ExtractionExecutionFailure;

export interface ExtractionRunRequest {
  idempotencyKey: string;
  evidence: ExtractionEvidence;
  signal?: AbortSignal;
}

export interface ExtractionRunnerOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  baseRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  now?: () => number;
  sleep?: (delayMs: number, signal?: AbortSignal) => Promise<void>;
}

interface IdempotencyRecord {
  fingerprint: string;
  promise?: Promise<ExtractionExecutionResult>;
  success?: ExtractionExecutionSuccess;
}

class AttemptTimeoutError extends Error {}
class AttemptCancelledError extends Error {}

const defaultSleep = async (
  delayMs: number,
  signal?: AbortSignal,
): Promise<void> => {
  if (signal?.aborted === true) {
    throw new AttemptCancelledError();
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (handler: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      handler();
    };
    const onAbort = (): void => {
      finish(() => reject(new AttemptCancelledError()));
    };
    const timer = setTimeout(() => finish(resolve), delayMs);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
};

const assertBoundedInteger = (
  value: number,
  name: string,
  minimum: number,
  maximum: number,
): void => {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(
      `${name} must be an integer from ${minimum} to ${maximum}`,
    );
  }
};

const fingerprintEvidence = (evidence: ExtractionEvidence): string =>
  JSON.stringify({
    fixtureId: evidence.fixtureId ?? null,
    evidenceRevision: evidence.evidenceRevision,
    transcriptSegments: evidence.transcriptSegments.map((segment) => [
      segment.sourceEntityId,
      segment.startMs,
      segment.endMs,
    ]),
    explicitMeasurements: evidence.explicitMeasurements.map(
      (measurement) => measurement.sourceEntityId,
    ),
    photoContext: evidence.photoContext.map((photo) => photo.sourceEntityId),
  });

const isAborted = (signal?: AbortSignal): boolean => signal?.aborted ?? false;

const safeFailureMessage: Record<ExtractionFailureCode, string> = {
  CANCELLED: "Extraction was cancelled and no facts were accepted.",
  IDEMPOTENCY_CONFLICT:
    "The idempotency key was already used for a different evidence revision.",
  INVALID_OUTPUT:
    "The provider output was rejected by strict validation; no facts were accepted.",
  PROVIDER_ERROR: "The provider failed; no facts were accepted.",
  TIMEOUT: "The provider timed out; no facts were accepted.",
};

export class StructuredExtractionRunner {
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly baseRetryDelayMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly now: () => number;
  private readonly sleep: (
    delayMs: number,
    signal?: AbortSignal,
  ) => Promise<void>;
  private readonly idempotency = new Map<string, IdempotencyRecord>();

  constructor(
    private readonly provider: StructuredExtractionProvider,
    options: ExtractionRunnerOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.maxAttempts = options.maxAttempts ?? 2;
    this.baseRetryDelayMs = options.baseRetryDelayMs ?? 100;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? 1_000;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;

    assertBoundedInteger(this.timeoutMs, "timeoutMs", 1, 60_000);
    assertBoundedInteger(this.maxAttempts, "maxAttempts", 1, 3);
    assertBoundedInteger(this.baseRetryDelayMs, "baseRetryDelayMs", 0, 5_000);
    assertBoundedInteger(this.maxRetryDelayMs, "maxRetryDelayMs", 0, 10_000);
    if (this.baseRetryDelayMs > this.maxRetryDelayMs) {
      throw new RangeError("baseRetryDelayMs cannot exceed maxRetryDelayMs");
    }
  }

  async run(request: ExtractionRunRequest): Promise<ExtractionExecutionResult> {
    const fingerprint = fingerprintEvidence(request.evidence);
    const existing = this.idempotency.get(request.idempotencyKey);

    if (existing !== undefined && existing.fingerprint !== fingerprint) {
      return this.failure("IDEMPOTENCY_CONFLICT", 0, 0, false);
    }

    if (existing?.success !== undefined) {
      return {
        ...structuredClone(existing.success),
        cached: true,
      };
    }

    if (existing?.promise !== undefined) {
      return structuredClone(await existing.promise);
    }

    const record: IdempotencyRecord = { fingerprint };
    const promise = this.execute(request);
    record.promise = promise;
    this.idempotency.set(request.idempotencyKey, record);

    const result = await promise;
    if (result.ok) {
      record.success = structuredClone(result);
      delete record.promise;
    } else {
      this.idempotency.delete(request.idempotencyKey);
    }

    return structuredClone(result);
  }

  private async execute(
    request: ExtractionRunRequest,
  ): Promise<ExtractionExecutionResult> {
    const startedAt = this.now();
    const dataEnvelope = buildUntrustedDataEnvelope(request.evidence);
    let attemptCount = 0;

    if (isAborted(request.signal)) {
      return this.failure(
        "CANCELLED",
        attemptCount,
        this.elapsed(startedAt),
        true,
      );
    }

    while (attemptCount < this.maxAttempts) {
      attemptCount += 1;
      try {
        const raw = await this.callWithDeadline(
          (signal) =>
            this.provider.extract({
              ...(request.evidence.fixtureId === undefined
                ? {}
                : { fixtureId: request.evidence.fixtureId }),
              idempotencyKey: request.idempotencyKey,
              signal,
              systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
              dataEnvelope,
            }),
          request.signal,
        );
        const data = parseExtractionResult(raw);

        return {
          ok: true,
          state: "SUCCEEDED",
          data,
          metadata: this.metadata(
            "SUCCEEDED",
            attemptCount,
            this.elapsed(startedAt),
          ),
          cached: false,
        };
      } catch (error) {
        if (
          error instanceof AttemptCancelledError ||
          (error instanceof DOMException &&
            error.name === "AbortError" &&
            isAborted(request.signal))
        ) {
          return this.failure(
            "CANCELLED",
            attemptCount,
            this.elapsed(startedAt),
            true,
          );
        }

        if (error instanceof ExtractionValidationError) {
          return this.failure(
            "INVALID_OUTPUT",
            attemptCount,
            this.elapsed(startedAt),
            true,
          );
        }

        const failureCode: ExtractionFailureCode =
          error instanceof AttemptTimeoutError ? "TIMEOUT" : "PROVIDER_ERROR";
        const retryable =
          error instanceof AttemptTimeoutError ||
          (error instanceof ProviderCallError && error.retryable);

        if (!retryable || attemptCount >= this.maxAttempts) {
          return this.failure(
            failureCode,
            attemptCount,
            this.elapsed(startedAt),
            true,
          );
        }

        const delayMs = Math.min(
          this.baseRetryDelayMs * 2 ** (attemptCount - 1),
          this.maxRetryDelayMs,
        );
        try {
          await this.sleep(delayMs, request.signal);
        } catch {
          return this.failure(
            "CANCELLED",
            attemptCount,
            this.elapsed(startedAt),
            true,
          );
        }
      }
    }

    return this.failure(
      "PROVIDER_ERROR",
      attemptCount,
      this.elapsed(startedAt),
      true,
    );
  }

  private async callWithDeadline<T>(
    call: (signal: AbortSignal) => Promise<T>,
    externalSignal?: AbortSignal,
  ): Promise<T> {
    if (externalSignal?.aborted === true) {
      throw new AttemptCancelledError();
    }

    const controller = new AbortController();
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = (handler: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        externalSignal?.removeEventListener("abort", onExternalAbort);
        handler();
      };
      const onExternalAbort = (): void => {
        controller.abort();
        finish(() => reject(new AttemptCancelledError()));
      };
      const timer = setTimeout(() => {
        controller.abort();
        finish(() => reject(new AttemptTimeoutError()));
      }, this.timeoutMs);

      externalSignal?.addEventListener("abort", onExternalAbort, {
        once: true,
      });
      void Promise.resolve()
        .then(() => call(controller.signal))
        .then(
          (value) => finish(() => resolve(value)),
          (error: unknown) => finish(() => reject(error)),
        );
    });
  }

  private elapsed(startedAt: number): number {
    return Math.max(0, Math.round(this.now() - startedAt));
  }

  private metadata(
    outcome: ExtractionRunMetadata["outcome"],
    attemptCount: number,
    durationMs: number,
    failureCode?: ExtractionFailureCode,
  ): ExtractionRunMetadata {
    return {
      provider: this.provider.descriptor.kind,
      providerName: this.provider.descriptor.name,
      model: this.provider.descriptor.model,
      promptVersion: EXTRACTION_PROMPT_VERSION,
      schemaVersion: CONTRACT_VERSION,
      durationMs,
      attemptCount,
      tokenCountPlaceholder: 0,
      costMinorPlaceholder: 0,
      outcome,
      ...(failureCode === undefined ? {} : { failureCode }),
    };
  }

  private failure(
    code: ExtractionFailureCode,
    attemptCount: number,
    durationMs: number,
    recoverable: boolean,
  ): ExtractionExecutionFailure {
    return {
      ok: false,
      state: "FAILED_SAFE",
      failure: {
        code,
        recoverable,
        message: safeFailureMessage[code],
      },
      metadata: this.metadata("FAILED_SAFE", attemptCount, durationMs, code),
      cached: false,
    };
  }
}
