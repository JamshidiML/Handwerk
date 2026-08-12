import {
  detectMediaContent,
  sanitiseDisplayFilename,
  validateMediaCount,
  validateMediaUpload,
} from "./content";
import { MEDIA_POLICY } from "./policy";
import type {
  DetectedMedia,
  MediaKind,
  MediaUploadCandidate,
  ValidatedMedia,
} from "./types";
import { MediaError } from "./types";

export interface BrowserMediaFile {
  arrayBuffer(): Promise<ArrayBuffer>;
  readonly name: string;
  readonly size: number;
  readonly type: string;
}

export function validateBrowserFileMetadata(
  file: Pick<BrowserMediaFile, "name" | "size" | "type">,
  kind: MediaKind,
): void {
  sanitiseDisplayFilename(file.name);
  if (file.size <= 0) {
    throw new MediaError("EMPTY_FILE", "Empty uploads are not accepted.");
  }
  if (file.size > MEDIA_POLICY.maxBytes[kind]) {
    throw new MediaError(
      "SIZE_LIMIT_EXCEEDED",
      `The ${kind.toLowerCase()} upload exceeds its size limit.`,
    );
  }
  if (!file.type.trim()) {
    throw new MediaError(
      "DECLARED_TYPE_MISMATCH",
      "The browser did not declare a media type for this file.",
    );
  }
}

export async function validateBrowserMediaFile(
  file: BrowserMediaFile,
  kind: MediaKind,
): Promise<ValidatedMedia> {
  validateBrowserFileMetadata(file, kind);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const candidate: MediaUploadCandidate = {
    bytes,
    declaredMediaType: file.type,
    filename: file.name,
    kind,
  };
  return validateMediaUpload(candidate);
}

export { MEDIA_POLICY, MediaError, detectMediaContent, validateMediaCount };
export type { DetectedMedia, MediaKind, ValidatedMedia };
