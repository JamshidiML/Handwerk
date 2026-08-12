import { randomUUID } from "node:crypto";
import { access, mkdir, open, readFile, unlink } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { sha256 } from "./checksum";
import { MEDIA_POLICY } from "./policy";
import type {
  PrivateObjectDescriptor,
  PrivateObjectStorage,
  PrivateObjectWrite,
  PrivateReadGrant,
} from "./types";
import { MediaError } from "./types";
import { assertSafeObjectKey } from "./object-key";

interface StoredGrant {
  readonly expiresAtMs: number;
  readonly objectKey: string;
}

export interface LocalPrivateStorageOptions {
  readonly clock?: () => number;
  readonly tokenFactory?: () => string;
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new MediaError("CANCELLED", "The media upload was cancelled.");
  }
}

function mapFileError(error: unknown): MediaError {
  if (error instanceof MediaError) return error;
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  if (code === "EEXIST") {
    return new MediaError(
      "STORAGE_COLLISION",
      "The generated private object key already exists.",
      { cause: error },
    );
  }
  if (code === "ENOENT") {
    return new MediaError(
      "STORAGE_NOT_FOUND",
      "The private evidence object was not found.",
      { cause: error },
    );
  }
  if (code === "EACCES" || code === "EPERM") {
    return new MediaError(
      "STORAGE_ACCESS_DENIED",
      "Private evidence storage denied the operation.",
      { cause: error },
    );
  }
  return new MediaError(
    "STORAGE_TRANSIENT",
    "Private evidence storage is temporarily unavailable.",
    { cause: error },
  );
}

export class LocalPrivateObjectStorage implements PrivateObjectStorage {
  readonly #clock: () => number;
  readonly #grants = new Map<string, StoredGrant>();
  readonly #root: string;
  readonly #tokenFactory: () => string;

  constructor(rootDirectory: string, options: LocalPrivateStorageOptions = {}) {
    this.#root = resolve(rootDirectory);
    this.#clock = options.clock ?? Date.now;
    this.#tokenFactory = options.tokenFactory ?? randomUUID;
  }

  async createReadGrant(
    objectKey: string,
    expiresInSeconds: number,
  ): Promise<PrivateReadGrant> {
    assertSafeObjectKey(objectKey);
    if (
      !Number.isSafeInteger(expiresInSeconds) ||
      expiresInSeconds < 1 ||
      expiresInSeconds > MEDIA_POLICY.maxReadGrantSeconds
    ) {
      throw new MediaError(
        "STORAGE_ACCESS_DENIED",
        "Private read grants must be short lived.",
      );
    }

    try {
      await access(this.#pathFor(objectKey));
    } catch (error) {
      throw mapFileError(error);
    }

    const expiresAtMs = this.#clock() + expiresInSeconds * 1_000;
    const token = `media_${this.#tokenFactory()}`;
    this.#grants.set(token, { expiresAtMs, objectKey });
    return { expiresAt: new Date(expiresAtMs).toISOString(), token };
  }

  async deletePrivate(objectKey: string): Promise<void> {
    assertSafeObjectKey(objectKey);
    try {
      await unlink(this.#pathFor(objectKey));
    } catch (error) {
      throw mapFileError(error);
    }
  }

  async putPrivate(
    input: PrivateObjectWrite,
  ): Promise<PrivateObjectDescriptor> {
    assertSafeObjectKey(input.objectKey);
    throwIfCancelled(input.signal);

    const targetPath = this.#pathFor(input.objectKey);
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    let created = false;
    try {
      await mkdir(dirname(targetPath), { mode: 0o700, recursive: true });
      throwIfCancelled(input.signal);
      handle = await open(targetPath, "wx", 0o600);
      created = true;
      await handle.writeFile(input.bytes);
      await handle.sync();
      throwIfCancelled(input.signal);
      return {
        checksumSha256: input.checksumSha256,
        contentType: input.contentType,
        objectKey: input.objectKey,
        sizeBytes: input.bytes.byteLength,
      };
    } catch (error) {
      if (created) await unlink(targetPath).catch(() => undefined);
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "";
      if (code === "EEXIST") {
        try {
          const existing = new Uint8Array(await readFile(targetPath));
          if (
            existing.byteLength === input.bytes.byteLength &&
            sha256(existing) === input.checksumSha256
          ) {
            return {
              checksumSha256: input.checksumSha256,
              contentType: input.contentType,
              objectKey: input.objectKey,
              sizeBytes: existing.byteLength,
            };
          }
        } catch (readError) {
          throw mapFileError(readError);
        }
      }
      throw mapFileError(error);
    } finally {
      await handle?.close();
    }
  }

  async readWithGrant(token: string): Promise<Uint8Array> {
    const grant = this.#grants.get(token);
    if (!grant) {
      throw new MediaError(
        "STORAGE_ACCESS_DENIED",
        "The private media access grant is invalid.",
      );
    }
    if (grant.expiresAtMs <= this.#clock()) {
      this.#grants.delete(token);
      throw new MediaError(
        "STORAGE_EXPIRED",
        "The private media access grant has expired.",
      );
    }

    try {
      return new Uint8Array(await readFile(this.#pathFor(grant.objectKey)));
    } catch (error) {
      throw mapFileError(error);
    }
  }

  #pathFor(objectKey: string): string {
    assertSafeObjectKey(objectKey);
    const target = resolve(this.#root, objectKey);
    if (!target.startsWith(`${this.#root}${sep}`)) {
      throw new MediaError(
        "STORAGE_ACCESS_DENIED",
        "The private object key escapes the storage root.",
      );
    }
    return target;
  }
}
