import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createSafeObjectKey,
  LocalPrivateObjectStorage,
  MediaError,
  sha256,
} from "../src/index";

const roots: string[] = [];
const UUID = "018f1c20-7c9b-4b49-a2b0-6d2ff2df46f5";

async function storageRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "handwerk-synthetic-media-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("local private object storage", () => {
  it("stores private bytes with restrictive permissions and opaque access", async () => {
    const root = await storageRoot();
    const storage = new LocalPrivateObjectStorage(root, {
      tokenFactory: () => "opaque-token",
    });
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const objectKey = createSafeObjectKey("PHOTO", "png", UUID);
    await storage.putPrivate({
      bytes,
      checksumSha256: sha256(bytes),
      contentType: "image/png",
      objectKey,
    });

    const storedPath = join(root, objectKey);
    expect(new Uint8Array(await readFile(storedPath))).toEqual(bytes);
    expect((await stat(storedPath)).mode & 0o777).toBe(0o600);

    const grant = await storage.createReadGrant(objectKey, 30);
    expect(grant.token).toBe("media_opaque-token");
    expect(grant.token).not.toContain(objectKey);
    expect(await storage.readWithGrant(grant.token)).toEqual(bytes);
  });

  it("expires grants and caps their lifetime", async () => {
    const root = await storageRoot();
    let now = Date.parse("2026-08-12T08:00:00.000Z");
    const storage = new LocalPrivateObjectStorage(root, { clock: () => now });
    const bytes = new Uint8Array([1]);
    const objectKey = createSafeObjectKey("AUDIO", "wav", UUID);
    await storage.putPrivate({
      bytes,
      checksumSha256: sha256(bytes),
      contentType: "audio/wav",
      objectKey,
    });
    const grant = await storage.createReadGrant(objectKey, 1);
    now += 1_001;

    await expect(storage.readWithGrant(grant.token)).rejects.toMatchObject({
      code: "STORAGE_EXPIRED",
    });
    await expect(storage.createReadGrant(objectKey, 301)).rejects.toMatchObject(
      {
        code: "STORAGE_ACCESS_DENIED",
      },
    );
  });

  it("rejects traversal before touching the filesystem", async () => {
    const storage = new LocalPrivateObjectStorage(await storageRoot());
    await expect(
      storage.putPrivate({
        bytes: new Uint8Array([1]),
        checksumSha256: "unused",
        contentType: "image/png",
        objectKey: "../public/customer.png",
      }),
    ).rejects.toBeInstanceOf(MediaError);
  });

  it("is idempotent for identical bytes and fails closed on a true collision", async () => {
    const storage = new LocalPrivateObjectStorage(await storageRoot());
    const bytes = new Uint8Array([1]);
    const objectKey = createSafeObjectKey("PHOTO", "png", UUID);
    const input = {
      bytes,
      checksumSha256: sha256(bytes),
      contentType: "image/png" as const,
      objectKey,
    };
    await storage.putPrivate(input);
    await expect(storage.putPrivate(input)).resolves.toMatchObject({
      checksumSha256: input.checksumSha256,
      objectKey,
    });
    await expect(
      storage.putPrivate({
        ...input,
        bytes: new Uint8Array([2]),
        checksumSha256: sha256(new Uint8Array([2])),
      }),
    ).rejects.toMatchObject({
      code: "STORAGE_COLLISION",
    });
  });
});
