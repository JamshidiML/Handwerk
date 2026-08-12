import { describe, expect, it } from "vitest";
import {
  MEDIA_POLICY,
  MediaError,
  minimiseMediaMetadata,
  sanitiseDisplayFilename,
  validateBrowserFileMetadata,
  validateMediaCount,
  validateMediaUpload,
} from "../src/index";
import { fixtureBytes } from "./fixture";

async function syntheticPng() {
  return fixtureBytes("synthetic-room-context.png.base64");
}

async function syntheticWav() {
  return fixtureBytes("synthetic-voice-note.wav.base64");
}

function expectMediaError(code: MediaError["code"], operation: () => unknown) {
  try {
    operation();
    throw new Error("Expected operation to throw.");
  } catch (error) {
    expect(error).toBeInstanceOf(MediaError);
    expect((error as MediaError).code).toBe(code);
  }
}

describe("media validation", () => {
  it("accepts synthetic PNG and WAV content only when MIME and extension agree", async () => {
    const photo = validateMediaUpload({
      bytes: await syntheticPng(),
      declaredMediaType: "image/png",
      filename: "synthetic-room-context.png",
      kind: "PHOTO",
    });
    const audio = validateMediaUpload({
      bytes: await syntheticWav(),
      declaredMediaType: "audio/x-wav",
      filename: "synthetic-voice-note.wav",
      kind: "AUDIO",
    });

    expect(photo).toMatchObject({
      extension: "png",
      kind: "PHOTO",
      mediaType: "image/png",
    });
    expect(audio).toMatchObject({
      extension: "wav",
      kind: "AUDIO",
      mediaType: "audio/wav",
    });
  });

  it("fails closed for malformed, MIME-mismatched and misleading files", async () => {
    const png = await syntheticPng();
    expectMediaError("UNSUPPORTED_CONTENT", () =>
      validateMediaUpload({
        bytes: new Uint8Array([60, 115, 99, 114, 105, 112, 116, 62]),
        declaredMediaType: "image/png",
        filename: "synthetic.png",
        kind: "PHOTO",
      }),
    );
    expectMediaError("DECLARED_TYPE_MISMATCH", () =>
      validateMediaUpload({
        bytes: png,
        declaredMediaType: "audio/wav",
        filename: "synthetic.png",
        kind: "PHOTO",
      }),
    );
    expectMediaError("EXTENSION_MISMATCH", () =>
      validateMediaUpload({
        bytes: png,
        declaredMediaType: "image/png",
        filename: "synthetic.jpg",
        kind: "PHOTO",
      }),
    );
  });

  it("rejects unsafe filenames, oversized metadata and excess counts", () => {
    expectMediaError("FILENAME_INVALID", () =>
      sanitiseDisplayFilename("../customer-address.png"),
    );
    expectMediaError("FILENAME_INVALID", () =>
      sanitiseDisplayFilename("photo\0.png"),
    );
    expectMediaError("SIZE_LIMIT_EXCEEDED", () =>
      validateBrowserFileMetadata(
        {
          name: "synthetic-room-context.png",
          size: MEDIA_POLICY.maxBytes.PHOTO + 1,
          type: "image/png",
        },
        "PHOTO",
      ),
    );
    expectMediaError("COUNT_LIMIT_EXCEEDED", () =>
      validateMediaCount("PHOTO", MEDIA_POLICY.maxCount.PHOTO + 1),
    );
  });

  it("removes PNG textual metadata while preserving image chunks", async () => {
    const png = await syntheticPng();
    const iendOffset = png.length - 12;
    const textChunk = new Uint8Array([
      0, 0, 0, 4, 116, 69, 88, 116, 116, 101, 115, 116, 0, 0, 0, 0,
    ]);
    const withMetadata = new Uint8Array(png.length + textChunk.length);
    withMetadata.set(png.slice(0, iendOffset), 0);
    withMetadata.set(textChunk, iendOffset);
    withMetadata.set(png.slice(iendOffset), iendOffset + textChunk.length);

    const validated = validateMediaUpload({
      bytes: withMetadata,
      declaredMediaType: "image/png",
      filename: "synthetic-room-context.png",
      kind: "PHOTO",
    });
    const minimised = minimiseMediaMetadata(validated);

    expect(minimised.metadataRemoved).toBe(true);
    expect(minimised.bytes).toEqual(png);
  });

  it("rejects structurally malformed image and audio containers", async () => {
    expectMediaError("MALFORMED_CONTENT", () =>
      validateMediaUpload({
        bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]),
        declaredMediaType: "image/png",
        filename: "synthetic.png",
        kind: "PHOTO",
      }),
    );
    const wav = await syntheticWav();
    expectMediaError("MALFORMED_CONTENT", () =>
      validateMediaUpload({
        bytes: wav.slice(0, 20),
        declaredMediaType: "audio/wav",
        filename: "synthetic.wav",
        kind: "AUDIO",
      }),
    );
  });
});
