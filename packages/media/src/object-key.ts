import { randomUUID } from "node:crypto";
import type { MediaKind, SupportedExtension } from "./types";
import { MediaError } from "./types";

const SAFE_OBJECT_KEY =
  /^private\/evidence\/(audio|photo)\/[0-9a-f]{2}\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpeg|jpg|m4a|mp4|oga|ogg|png|wav|webm)$/;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function assertSafeObjectKey(objectKey: string): void {
  if (!SAFE_OBJECT_KEY.test(objectKey)) {
    throw new MediaError(
      "STORAGE_ACCESS_DENIED",
      "The private object key is outside the evidence namespace.",
    );
  }
}

export function createSafeObjectKey(
  kind: MediaKind,
  extension: SupportedExtension,
  id: string = randomUUID(),
): string {
  const normalisedId = id.toLowerCase();
  if (!UUID_V4.test(normalisedId)) {
    throw new MediaError(
      "STORAGE_ACCESS_DENIED",
      "Object identifiers must be opaque UUID v4 values.",
    );
  }

  const namespace = kind.toLowerCase();
  const objectKey = `private/evidence/${namespace}/${normalisedId.slice(0, 2)}/${normalisedId}.${extension}`;
  assertSafeObjectKey(objectKey);
  return objectKey;
}
