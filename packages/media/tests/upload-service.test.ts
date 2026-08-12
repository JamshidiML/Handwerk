import type { EntityId, OrganisationId } from "@handwerk/contracts";
import { describe, expect, it, vi } from "vitest";
import type {
  PrivateObjectDescriptor,
  PrivateObjectStorage,
  PrivateObjectWrite,
  PrivateReadGrant,
  SafeMediaLogEvent,
} from "../src/index";
import {
  MediaError,
  MediaUploadService,
  type MediaUploadCandidate,
} from "../src/index";
import { fixtureBytes } from "./fixture";

const ORGANISATION_ID = "org-synthetic-westblick" as OrganisationId;
const SITE_VISIT_ID = "visit-synthetic-001" as EntityId;
const OBJECT_UUID = "018f1c20-7c9b-4b49-a2b0-6d2ff2df46f5";

class FakePrivateStorage implements PrivateObjectStorage {
  abortAfterWrite?: () => void;
  attemptedObjectKeys: string[] = [];
  deletedObjectKeys: string[] = [];
  puts: PrivateObjectWrite[] = [];
  transientFailures = 0;

  async createReadGrant(): Promise<PrivateReadGrant> {
    return { expiresAt: "2026-08-12T08:05:00.000Z", token: "opaque" };
  }

  async deletePrivate(objectKey: string): Promise<void> {
    this.deletedObjectKeys.push(objectKey);
  }

  async putPrivate(
    input: PrivateObjectWrite,
  ): Promise<PrivateObjectDescriptor> {
    this.attemptedObjectKeys.push(input.objectKey);
    if (input.signal?.aborted) {
      throw new MediaError("CANCELLED", "cancelled");
    }
    if (this.transientFailures > 0) {
      this.transientFailures -= 1;
      throw new MediaError("STORAGE_TRANSIENT", "temporary");
    }
    this.puts.push(input);
    this.abortAfterWrite?.();
    return {
      checksumSha256: input.checksumSha256,
      contentType: input.contentType,
      objectKey: input.objectKey,
      sizeBytes: input.bytes.byteLength,
    };
  }

  async readWithGrant(): Promise<Uint8Array> {
    return new Uint8Array();
  }
}

async function photoCandidate(
  filename = "synthetic-room-context.png",
): Promise<MediaUploadCandidate> {
  return {
    bytes: await fixtureBytes("synthetic-room-context.png.base64"),
    declaredMediaType: "image/png",
    filename,
    kind: "PHOTO",
  };
}

async function audioCandidate(
  lastSample: number,
): Promise<MediaUploadCandidate> {
  const bytes = await fixtureBytes("synthetic-voice-note.wav.base64");
  bytes[bytes.length - 1] = lastSample;
  return {
    bytes,
    declaredMediaType: "audio/wav",
    filename: "synthetic-voice-note.wav",
    kind: "AUDIO",
  };
}

function context(requestId: string) {
  return {
    organisationId: ORGANISATION_ID,
    requestId,
    siteVisitId: SITE_VISIT_ID,
  };
}

describe("media upload service", () => {
  it("stores photos as context-only and deduplicates within tenant/site scope", async () => {
    const storage = new FakePrivateStorage();
    const service = new MediaUploadService(storage, {
      createObjectKey: (kind, extension) =>
        `private/evidence/${kind.toLowerCase()}/01/${OBJECT_UUID}.${extension}`,
    });
    const candidate = await photoCandidate();

    const first = await service.ingest(candidate, context("request-first"));
    const duplicate = await service.ingest(
      candidate,
      context("request-second"),
    );

    expect(first).toMatchObject({
      authority: "CONTEXT_ONLY",
      kind: "PHOTO",
      status: "STORED",
      synthetic: true,
    });
    expect(duplicate).toMatchObject({
      authority: "CONTEXT_ONLY",
      objectKey: first.objectKey,
      status: "DUPLICATE",
    });
    expect(storage.puts).toHaveLength(1);
  });

  it("does not deduplicate across organisations", async () => {
    const storage = new FakePrivateStorage();
    let sequence = 0;
    const ids = [OBJECT_UUID, "118f1c20-7c9b-4b49-a2b0-6d2ff2df46f5"];
    const service = new MediaUploadService(storage, {
      createObjectKey: (kind, extension) => {
        const id = ids[sequence] ?? OBJECT_UUID;
        sequence += 1;
        return `private/evidence/${kind.toLowerCase()}/${id.slice(0, 2)}/${id}.${extension}`;
      },
    });
    const candidate = await photoCandidate();

    await service.ingest(candidate, context("request-a"));
    const other = await service.ingest(candidate, {
      ...context("request-b"),
      organisationId: "org-synthetic-other" as OrganisationId,
    });

    expect(other.status).toBe("STORED");
    expect(storage.puts).toHaveLength(2);
  });

  it("enforces the media count limit inside the ingest boundary", async () => {
    const storage = new FakePrivateStorage();
    let sequence = 0;
    const ids = [OBJECT_UUID, "118f1c20-7c9b-4b49-a2b0-6d2ff2df46f5"];
    const service = new MediaUploadService(storage, {
      createObjectKey: (kind, extension) => {
        const id = ids[sequence] ?? OBJECT_UUID;
        sequence += 1;
        return `private/evidence/${kind.toLowerCase()}/${id.slice(0, 2)}/${id}.${extension}`;
      },
    });

    await service.ingest(await audioCandidate(128), context("request-audio-1"));
    await expect(
      service.ingest(await audioCandidate(129), context("request-audio-2")),
    ).rejects.toMatchObject({ code: "COUNT_LIMIT_EXCEEDED" });
    expect(storage.puts).toHaveLength(1);
  });

  it("retries transient storage failures with bounded attempts", async () => {
    const storage = new FakePrivateStorage();
    storage.transientFailures = 1;
    const delay = vi.fn(async () => undefined);
    const events: SafeMediaLogEvent[] = [];
    const service = new MediaUploadService(storage, {
      createObjectKey: (kind, extension) =>
        `private/evidence/${kind.toLowerCase()}/01/${OBJECT_UUID}.${extension}`,
      delay,
      logger: { log: (event) => events.push(event) },
      maxAttempts: 2,
    });

    const result = await service.ingest(
      await photoCandidate(),
      context("request-retry"),
    );

    expect(result.status).toBe("STORED");
    expect(delay).toHaveBeenCalledOnce();
    expect(new Set(storage.attemptedObjectKeys).size).toBe(1);
    expect(events.some((event) => event.type === "MEDIA_UPLOAD_RETRYING")).toBe(
      true,
    );
  });

  it("honours cancellation before validation and never writes", async () => {
    const storage = new FakePrivateStorage();
    const service = new MediaUploadService(storage);
    const controller = new AbortController();
    controller.abort();

    await expect(
      service.ingest(await photoCandidate(), context("request-cancel"), {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "CANCELLED" });
    expect(storage.puts).toHaveLength(0);
  });

  it("removes a private object when cancellation races with storage completion", async () => {
    const storage = new FakePrivateStorage();
    const controller = new AbortController();
    storage.abortAfterWrite = () => controller.abort();
    const service = new MediaUploadService(storage, {
      createObjectKey: (kind, extension) =>
        `private/evidence/${kind.toLowerCase()}/01/${OBJECT_UUID}.${extension}`,
    });

    await expect(
      service.ingest(await photoCandidate(), context("request-race-cancel"), {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "CANCELLED" });
    expect(storage.puts).toHaveLength(1);
    expect(storage.deletedObjectKeys).toEqual([storage.puts[0]?.objectKey]);
  });

  it("keeps filenames, bytes, checksums, object keys and access paths out of logs", async () => {
    const storage = new FakePrivateStorage();
    const events: SafeMediaLogEvent[] = [];
    const service = new MediaUploadService(storage, {
      createObjectKey: (kind, extension) =>
        `private/evidence/${kind.toLowerCase()}/01/${OBJECT_UUID}.${extension}`,
      logger: { log: (event) => events.push(event) },
    });
    const secretFilename = "anna-becker-private-address.png";

    const result = await service.ingest(
      await photoCandidate(secretFilename),
      context("request-safe-log"),
    );
    const serialised = JSON.stringify(events);

    expect(serialised).not.toContain(secretFilename);
    expect(serialised).not.toContain(result.objectKey);
    expect(serialised).not.toContain(result.checksumSha256);
    expect(serialised).not.toContain("signed");
    expect(serialised).not.toContain("data:");
    expect(events.at(-1)).toMatchObject({
      outcome: "STORED",
      requestId: "request-safe-log",
      type: "MEDIA_UPLOAD_COMPLETED",
    });
  });
});
