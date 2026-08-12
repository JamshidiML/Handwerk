import { describe, expect, it } from "vitest";
import {
  assertSafeObjectKey,
  createSafeObjectKey,
  MediaError,
} from "../src/index";

const UUID = "018f1c20-7c9b-4b49-a2b0-6d2ff2df46f5";

describe("safe object keys", () => {
  it("uses only an opaque random identifier and detected extension", () => {
    const key = createSafeObjectKey("PHOTO", "png", UUID);
    expect(key).toBe(
      "private/evidence/photo/01/018f1c20-7c9b-4b49-a2b0-6d2ff2df46f5.png",
    );
    expect(key).not.toMatch(/customer|project|filename|westblick/i);
  });

  it.each([
    "../private/evidence/photo/file.png",
    "private/evidence/photo/01/customer.png",
    "private/evidence/photo/01/018f1c20-7c9b-4b49-a2b0-6d2ff2df46f5.png/../x",
  ])("rejects traversal and non-canonical key %s", (key) => {
    expect(() => assertSafeObjectKey(key)).toThrowError(MediaError);
  });

  it("rejects predictable or malformed identifiers", () => {
    expect(() => createSafeObjectKey("AUDIO", "wav", "visit-001")).toThrowError(
      MediaError,
    );
  });
});
