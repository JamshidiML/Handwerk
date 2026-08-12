import { MEDIA_POLICY } from "./policy";
import type {
  DetectedMedia,
  MediaKind,
  MediaUploadCandidate,
  SupportedExtension,
  SupportedMediaType,
  ValidatedMedia,
} from "./types";
import { MediaError } from "./types";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;
const PNG_REMOVABLE_CHUNKS = new Set(["eXIf", "iTXt", "tEXt", "tIME", "zTXt"]);

const MEDIA_FORMATS: ReadonlyArray<{
  readonly declaredTypes: readonly string[];
  readonly extensions: readonly SupportedExtension[];
  readonly kind: MediaKind;
  readonly mediaType: SupportedMediaType;
  readonly matches: (bytes: Uint8Array) => boolean;
}> = [
  {
    declaredTypes: ["image/png"],
    extensions: ["png"],
    kind: "PHOTO",
    mediaType: "image/png",
    matches: (bytes) => startsWith(bytes, PNG_SIGNATURE),
  },
  {
    declaredTypes: ["image/jpeg", "image/jpg"],
    extensions: ["jpg", "jpeg"],
    kind: "PHOTO",
    mediaType: "image/jpeg",
    matches: (bytes) =>
      bytes.length >= 4 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff,
  },
  {
    declaredTypes: ["audio/wav", "audio/wave", "audio/x-wav"],
    extensions: ["wav"],
    kind: "AUDIO",
    mediaType: "audio/wav",
    matches: (bytes) => asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WAVE"),
  },
  {
    declaredTypes: ["audio/webm", "video/webm"],
    extensions: ["webm"],
    kind: "AUDIO",
    mediaType: "audio/webm",
    matches: (bytes) => startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]),
  },
  {
    declaredTypes: ["audio/ogg", "application/ogg"],
    extensions: ["ogg", "oga"],
    kind: "AUDIO",
    mediaType: "audio/ogg",
    matches: (bytes) => asciiAt(bytes, 0, "OggS"),
  },
  {
    declaredTypes: ["audio/mp4", "audio/x-m4a", "video/mp4"],
    extensions: ["m4a", "mp4"],
    kind: "AUDIO",
    mediaType: "audio/mp4",
    matches: (bytes) => asciiAt(bytes, 4, "ftyp"),
  },
];

function startsWith(bytes: Uint8Array, expected: readonly number[]): boolean {
  return (
    bytes.length >= expected.length &&
    expected.every((value, index) => bytes[index] === value)
  );
}

function asciiAt(bytes: Uint8Array, offset: number, value: string): boolean {
  if (bytes.length < offset + value.length) return false;

  for (let index = 0; index < value.length; index += 1) {
    if (bytes[offset + index] !== value.charCodeAt(index)) return false;
  }

  return true;
}

function normaliseDeclaredMediaType(value: string): string {
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function extensionOf(filename: string): string {
  const separator = filename.lastIndexOf(".");
  return separator > 0 ? filename.slice(separator + 1).toLowerCase() : "";
}

export function sanitiseDisplayFilename(filename: string): string {
  const normalised = filename.normalize("NFKC").trim();
  // eslint-disable-next-line no-control-regex -- reject control characters and path separators.
  const hasUnsafeCharacter = /[\0-\x1f\x7f/\\]/.test(normalised);
  if (
    normalised.length === 0 ||
    normalised.length > MEDIA_POLICY.maxFilenameLength ||
    normalised === "." ||
    normalised === ".." ||
    hasUnsafeCharacter
  ) {
    throw new MediaError(
      "FILENAME_INVALID",
      "The upload filename is empty, unsafe, or too long.",
    );
  }

  return normalised.replace(/\s+/g, " ");
}

export function detectMediaContent(bytes: Uint8Array): DetectedMedia {
  const format = MEDIA_FORMATS.find((candidate) => candidate.matches(bytes));
  if (!format) {
    throw new MediaError(
      "UNSUPPORTED_CONTENT",
      "The file content is not a supported audio or photo format.",
    );
  }

  return {
    extension: format.extensions[0] as SupportedExtension,
    kind: format.kind,
    mediaType: format.mediaType,
  };
}

export function validateMediaUpload(
  candidate: MediaUploadCandidate,
): ValidatedMedia {
  if (candidate.bytes.byteLength === 0) {
    throw new MediaError("EMPTY_FILE", "Empty uploads are not accepted.");
  }
  if (candidate.bytes.byteLength > MEDIA_POLICY.maxBytes[candidate.kind]) {
    throw new MediaError(
      "SIZE_LIMIT_EXCEEDED",
      `The ${candidate.kind.toLowerCase()} upload exceeds its size limit.`,
    );
  }

  const displayFilename = sanitiseDisplayFilename(candidate.filename);
  const detected = detectMediaContent(candidate.bytes);
  if (detected.kind !== candidate.kind) {
    throw new MediaError(
      "DECLARED_TYPE_MISMATCH",
      "The selected evidence kind does not match the file content.",
    );
  }

  const format = MEDIA_FORMATS.find(
    (entry) =>
      entry.kind === detected.kind && entry.mediaType === detected.mediaType,
  );
  if (!format) {
    throw new MediaError("UNSUPPORTED_CONTENT", "Unsupported media format.");
  }

  const declaredType = normaliseDeclaredMediaType(candidate.declaredMediaType);
  if (!format.declaredTypes.includes(declaredType)) {
    throw new MediaError(
      "DECLARED_TYPE_MISMATCH",
      "The declared MIME type does not match the file content.",
    );
  }

  if (
    !format.extensions.includes(
      extensionOf(displayFilename) as SupportedExtension,
    )
  ) {
    throw new MediaError(
      "EXTENSION_MISMATCH",
      "The filename extension does not match the file content.",
    );
  }

  assertStructurallyValid(detected, candidate.bytes);

  return { ...detected, bytes: candidate.bytes, displayFilename };
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

function readUint32LittleEndian(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

function assertWavStructure(bytes: Uint8Array): void {
  if (
    bytes.length < 44 ||
    readUint32LittleEndian(bytes, 4) + 8 !== bytes.length
  ) {
    throw new MediaError("MALFORMED_CONTENT", "Invalid WAV container length.");
  }

  let offset = 12;
  let foundFormat = false;
  let foundData = false;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) {
      throw new MediaError("MALFORMED_CONTENT", "Truncated WAV chunk.");
    }
    const chunkType = String.fromCharCode(
      bytes[offset] ?? 0,
      bytes[offset + 1] ?? 0,
      bytes[offset + 2] ?? 0,
      bytes[offset + 3] ?? 0,
    );
    const chunkLength = readUint32LittleEndian(bytes, offset + 4);
    const chunkEnd = offset + 8 + chunkLength;
    if (chunkEnd > bytes.length) {
      throw new MediaError("MALFORMED_CONTENT", "Invalid WAV chunk length.");
    }
    if (chunkType === "fmt " && chunkLength >= 16) foundFormat = true;
    if (chunkType === "data" && chunkLength > 0) foundData = true;
    offset = chunkEnd + (chunkLength % 2);
  }
  if (offset !== bytes.length || !foundFormat || !foundData) {
    throw new MediaError(
      "MALFORMED_CONTENT",
      "WAV content requires format and non-empty data chunks.",
    );
  }
}

function assertOggStructure(bytes: Uint8Array): void {
  const segmentCount = bytes[26];
  if (
    bytes.length < 27 ||
    bytes[4] !== 0 ||
    segmentCount === undefined ||
    bytes.length < 27 + segmentCount
  ) {
    throw new MediaError("MALFORMED_CONTENT", "Invalid Ogg page header.");
  }
}

function assertMp4Structure(bytes: Uint8Array): void {
  const firstBoxLength = readUint32(bytes, 0);
  if (
    bytes.length < 12 ||
    firstBoxLength < 12 ||
    firstBoxLength > bytes.length
  ) {
    throw new MediaError("MALFORMED_CONTENT", "Invalid MP4 file-type box.");
  }
}

function assertStructurallyValid(
  media: DetectedMedia,
  bytes: Uint8Array,
): void {
  switch (media.mediaType) {
    case "image/png":
      stripPngMetadata(bytes);
      return;
    case "image/jpeg":
      stripJpegMetadata(bytes);
      return;
    case "audio/wav":
      assertWavStructure(bytes);
      return;
    case "audio/ogg":
      assertOggStructure(bytes);
      return;
    case "audio/mp4":
      assertMp4Structure(bytes);
      return;
    case "audio/webm":
      if (bytes.length < 8) {
        throw new MediaError("MALFORMED_CONTENT", "Truncated WebM header.");
      }
  }
}

function stripPngMetadata(bytes: Uint8Array): {
  bytes: Uint8Array;
  removed: boolean;
} {
  if (!startsWith(bytes, PNG_SIGNATURE)) {
    throw new MediaError("MALFORMED_CONTENT", "Invalid PNG signature.");
  }

  const chunks: Uint8Array[] = [bytes.slice(0, PNG_SIGNATURE.length)];
  let offset: number = PNG_SIGNATURE.length;
  let foundEnd = false;
  let foundHeader = false;
  let foundImageData = false;
  let removed = false;

  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) {
      throw new MediaError("MALFORMED_CONTENT", "Truncated PNG chunk.");
    }

    const dataLength = readUint32(bytes, offset);
    const chunkEnd = offset + 12 + dataLength;
    if (chunkEnd > bytes.length) {
      throw new MediaError("MALFORMED_CONTENT", "Invalid PNG chunk length.");
    }

    const chunkType = String.fromCharCode(
      bytes[offset + 4] ?? 0,
      bytes[offset + 5] ?? 0,
      bytes[offset + 6] ?? 0,
      bytes[offset + 7] ?? 0,
    );
    if (
      offset === PNG_SIGNATURE.length &&
      (chunkType !== "IHDR" || dataLength !== 13)
    ) {
      throw new MediaError("MALFORMED_CONTENT", "PNG must start with IHDR.");
    }
    if (chunkType === "IHDR") foundHeader = true;
    if (chunkType === "IDAT" && dataLength > 0) foundImageData = true;
    if (PNG_REMOVABLE_CHUNKS.has(chunkType)) {
      removed = true;
    } else {
      chunks.push(bytes.slice(offset, chunkEnd));
    }

    offset = chunkEnd;
    if (chunkType === "IEND") {
      foundEnd = true;
      break;
    }
  }

  if (!foundHeader || !foundImageData || !foundEnd || offset !== bytes.length) {
    throw new MediaError(
      "MALFORMED_CONTENT",
      "PNG content has no clean terminal chunk.",
    );
  }

  return { bytes: concatenate(chunks), removed };
}

function stripJpegMetadata(bytes: Uint8Array): {
  bytes: Uint8Array;
  removed: boolean;
} {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new MediaError("MALFORMED_CONTENT", "Invalid JPEG header.");
  }

  const segments: Uint8Array[] = [bytes.slice(0, 2)];
  let offset = 2;
  let foundImageData = false;
  let removed = false;

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff || offset + 1 >= bytes.length) {
      throw new MediaError("MALFORMED_CONTENT", "Invalid JPEG segment.");
    }

    let markerOffset = offset + 1;
    while (bytes[markerOffset] === 0xff) markerOffset += 1;
    const marker = bytes[markerOffset];
    if (marker === undefined) {
      throw new MediaError("MALFORMED_CONTENT", "Truncated JPEG marker.");
    }

    if (marker === 0xd9) {
      segments.push(bytes.slice(offset, markerOffset + 1));
      offset = markerOffset + 1;
      break;
    }
    if (marker === 0xda) {
      const segmentLength =
        ((bytes[markerOffset + 1] ?? 0) << 8) | (bytes[markerOffset + 2] ?? 0);
      if (
        segmentLength < 2 ||
        markerOffset + 1 + segmentLength > bytes.length
      ) {
        throw new MediaError("MALFORMED_CONTENT", "Invalid JPEG scan header.");
      }
      if (bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) {
        throw new MediaError("MALFORMED_CONTENT", "JPEG has no end marker.");
      }
      segments.push(bytes.slice(offset));
      foundImageData = true;
      offset = bytes.length;
      break;
    }

    const standalone = marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
    if (standalone) {
      segments.push(bytes.slice(offset, markerOffset + 1));
      offset = markerOffset + 1;
      continue;
    }

    const segmentLength =
      ((bytes[markerOffset + 1] ?? 0) << 8) | (bytes[markerOffset + 2] ?? 0);
    const segmentEnd = markerOffset + 1 + segmentLength;
    if (segmentLength < 2 || segmentEnd > bytes.length) {
      throw new MediaError("MALFORMED_CONTENT", "Invalid JPEG segment length.");
    }

    if (marker === 0xe1 || marker === 0xed || marker === 0xfe) {
      removed = true;
    } else {
      segments.push(bytes.slice(offset, segmentEnd));
    }
    offset = segmentEnd;
  }

  if (!foundImageData || offset !== bytes.length) {
    throw new MediaError(
      "MALFORMED_CONTENT",
      "Trailing JPEG content rejected.",
    );
  }

  return { bytes: concatenate(segments), removed };
}

function concatenate(chunks: readonly Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

export function minimiseMediaMetadata(media: ValidatedMedia): {
  readonly bytes: Uint8Array;
  readonly metadataRemoved: boolean;
} {
  if (media.mediaType === "image/png") {
    const result = stripPngMetadata(media.bytes);
    return { bytes: result.bytes, metadataRemoved: result.removed };
  }
  if (media.mediaType === "image/jpeg") {
    const result = stripJpegMetadata(media.bytes);
    return { bytes: result.bytes, metadataRemoved: result.removed };
  }

  return { bytes: media.bytes, metadataRemoved: false };
}

export function validateMediaCount(kind: MediaKind, count: number): void {
  if (
    !Number.isSafeInteger(count) ||
    count < 0 ||
    count > MEDIA_POLICY.maxCount[kind]
  ) {
    throw new MediaError(
      "COUNT_LIMIT_EXCEEDED",
      `Too many ${kind.toLowerCase()} files were selected.`,
    );
  }
}
