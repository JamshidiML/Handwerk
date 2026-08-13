import { minimiseMediaMetadata, validateMediaUpload } from "./content";
import { sha256 } from "./checksum";
import { createSafeObjectKey } from "./object-key";
import { MEDIA_POLICY } from "./policy";
import type {
  IngestedMedia,
  MediaProgressListener,
  MediaUploadCandidate,
  MediaUploadContext,
  PrivateObjectStorage,
  SafeMediaLogger,
} from "./types";
import { MediaError, authorityForMedia } from "./types";

const NOOP_LOGGER: SafeMediaLogger = { log: () => undefined };

export interface MediaUploadServiceOptions {
  readonly createObjectKey?: typeof createSafeObjectKey;
  readonly delay?: (
    milliseconds: number,
    signal?: AbortSignal,
  ) => Promise<void>;
  readonly logger?: SafeMediaLogger;
  readonly maxAttempts?: number;
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new MediaError("CANCELLED", "The media upload was cancelled.");
  }
}

function defaultDelay(
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    throwIfCancelled(signal);
    const timeout = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new MediaError("CANCELLED", "The media upload was cancelled."));
      },
      { once: true },
    );
  });
}

function errorCode(error: unknown): MediaError["code"] {
  return error instanceof MediaError ? error.code : "STORAGE_TRANSIENT";
}

export class MediaUploadService {
  readonly #createObjectKey: typeof createSafeObjectKey;
  readonly #dedupe = new Map<string, IngestedMedia>();
  readonly #delay: NonNullable<MediaUploadServiceOptions["delay"]>;
  readonly #logger: SafeMediaLogger;
  readonly #maxAttempts: number;
  readonly #scopeLocks = new Map<string, Promise<void>>();
  readonly #storage: PrivateObjectStorage;
  readonly #storedCounts = new Map<string, number>();

  constructor(
    storage: PrivateObjectStorage,
    options: MediaUploadServiceOptions = {},
  ) {
    this.#storage = storage;
    this.#createObjectKey = options.createObjectKey ?? createSafeObjectKey;
    this.#delay = options.delay ?? defaultDelay;
    this.#logger = options.logger ?? NOOP_LOGGER;
    this.#maxAttempts = options.maxAttempts ?? 3;
    if (!Number.isSafeInteger(this.#maxAttempts) || this.#maxAttempts < 1) {
      throw new TypeError("maxAttempts must be a positive integer.");
    }
  }

  async ingest(
    candidate: MediaUploadCandidate,
    context: MediaUploadContext,
    options: {
      readonly onProgress?: MediaProgressListener;
      readonly signal?: AbortSignal;
    } = {},
  ): Promise<IngestedMedia> {
    const scopeKey = [
      context.organisationId,
      context.siteVisitId,
      candidate.kind,
    ].join(":");
    const previous = this.#scopeLocks.get(scopeKey) ?? Promise.resolve();
    let release: (() => void) | undefined;
    const lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => lock);
    this.#scopeLocks.set(scopeKey, queued);

    await previous;
    try {
      return await this.#ingestWithRetry(candidate, context, options);
    } finally {
      release?.();
      if (this.#scopeLocks.get(scopeKey) === queued) {
        this.#scopeLocks.delete(scopeKey);
      }
    }
  }

  async #ingestWithRetry(
    candidate: MediaUploadCandidate,
    context: MediaUploadContext,
    options: {
      readonly onProgress?: MediaProgressListener;
      readonly signal?: AbortSignal;
    },
  ): Promise<IngestedMedia> {
    let attempt = 1;
    let retryObjectKey: string | undefined;
    while (true) {
      try {
        return await this.#ingestOnce(candidate, context, attempt, options, {
          get: (kind, extension) => {
            retryObjectKey ??= this.#createObjectKey(kind, extension);
            return retryObjectKey;
          },
        });
      } catch (error) {
        const code = errorCode(error);
        this.#logger.log({
          attempt,
          errorCode: code,
          mediaKind: candidate.kind,
          requestId: context.requestId,
          type: "MEDIA_UPLOAD_FAILED",
        });
        if (code !== "STORAGE_TRANSIENT" || attempt >= this.#maxAttempts) {
          if (error instanceof MediaError) throw error;
          throw new MediaError(
            "STORAGE_TRANSIENT",
            "Private evidence storage is temporarily unavailable.",
            { cause: error },
          );
        }

        this.#logger.log({
          attempt,
          errorCode: "STORAGE_TRANSIENT",
          mediaKind: candidate.kind,
          requestId: context.requestId,
          type: "MEDIA_UPLOAD_RETRYING",
        });
        await this.#delay(50 * 2 ** (attempt - 1), options.signal);
        attempt += 1;
      }
    }
  }

  async #ingestOnce(
    candidate: MediaUploadCandidate,
    context: MediaUploadContext,
    attempt: number,
    options: {
      readonly onProgress?: MediaProgressListener;
      readonly signal?: AbortSignal;
    },
    objectKey: {
      readonly get: typeof createSafeObjectKey;
    },
  ): Promise<IngestedMedia> {
    throwIfCancelled(options.signal);
    this.#logger.log({
      attempt,
      mediaKind: candidate.kind,
      requestId: context.requestId,
      sizeBytes: candidate.bytes.byteLength,
      type: "MEDIA_UPLOAD_STARTED",
    });
    options.onProgress?.({ percent: 10, phase: "VALIDATING" });
    const validated = validateMediaUpload(candidate);
    throwIfCancelled(options.signal);

    options.onProgress?.({ percent: 35, phase: "HASHING" });
    const originalChecksumSha256 = sha256(validated.bytes);
    const minimised = minimiseMediaMetadata(validated);
    const checksumSha256 = sha256(minimised.bytes);
    const dedupeKey = [
      context.organisationId,
      context.siteVisitId,
      validated.kind,
      checksumSha256,
    ].join(":");
    const existing = this.#dedupe.get(dedupeKey);
    if (existing) {
      const duplicate = { ...existing, status: "DUPLICATE" as const };
      this.#logger.log({
        attempt,
        mediaKind: candidate.kind,
        outcome: "DUPLICATE",
        requestId: context.requestId,
        sizeBytes: duplicate.sizeBytes,
        type: "MEDIA_UPLOAD_COMPLETED",
      });
      options.onProgress?.({ percent: 100, phase: "STORING" });
      return duplicate;
    }

    const countKey = [
      context.organisationId,
      context.siteVisitId,
      validated.kind,
    ].join(":");
    const storedCount = this.#storedCounts.get(countKey) ?? 0;
    if (storedCount >= MEDIA_POLICY.maxCount[validated.kind]) {
      throw new MediaError(
        "COUNT_LIMIT_EXCEEDED",
        `The site visit already has the maximum number of ${validated.kind.toLowerCase()} files.`,
      );
    }

    throwIfCancelled(options.signal);
    options.onProgress?.({ percent: 65, phase: "STORING" });
    const privateObjectKey = objectKey.get(validated.kind, validated.extension);
    this.#storedCounts.set(countKey, storedCount + 1);
    try {
      await this.#storage.putPrivate({
        bytes: minimised.bytes,
        checksumSha256,
        contentType: validated.mediaType,
        objectKey: privateObjectKey,
        ...(options.signal ? { signal: options.signal } : {}),
      });
    } catch (error) {
      this.#storedCounts.set(countKey, storedCount);
      throw error;
    }
    if (options.signal?.aborted) {
      await this.#storage
        .deletePrivate(privateObjectKey)
        .catch(() => undefined);
      this.#storedCounts.set(countKey, storedCount);
      throw new MediaError("CANCELLED", "The media upload was cancelled.");
    }

    const authority = authorityForMedia(validated.kind);
    const result: IngestedMedia =
      validated.kind === "PHOTO"
        ? {
            authority: "CONTEXT_ONLY",
            checksumSha256,
            displayFilename: validated.displayFilename,
            extension: validated.extension,
            kind: "PHOTO",
            mediaType: validated.mediaType,
            metadataRemoved: minimised.metadataRemoved,
            objectKey: privateObjectKey,
            originalChecksumSha256,
            originalSizeBytes: validated.bytes.byteLength,
            sizeBytes: minimised.bytes.byteLength,
            status: "STORED",
            synthetic: true,
          }
        : {
            authority: authority as "AUTHORITATIVE",
            checksumSha256,
            displayFilename: validated.displayFilename,
            extension: validated.extension,
            kind: "AUDIO",
            mediaType: validated.mediaType,
            metadataRemoved: minimised.metadataRemoved,
            objectKey: privateObjectKey,
            originalChecksumSha256,
            originalSizeBytes: validated.bytes.byteLength,
            sizeBytes: minimised.bytes.byteLength,
            status: "STORED",
            synthetic: true,
          };
    this.#dedupe.set(dedupeKey, result);
    options.onProgress?.({ percent: 100, phase: "STORING" });
    this.#logger.log({
      attempt,
      mediaKind: candidate.kind,
      outcome: "STORED",
      requestId: context.requestId,
      sizeBytes: result.sizeBytes,
      type: "MEDIA_UPLOAD_COMPLETED",
    });
    return result;
  }
}
