import type {
  EntityId,
  EvidenceAuthority,
  OrganisationId,
} from "@handwerk/contracts";

export type MediaKind = "AUDIO" | "PHOTO";

export type SupportedMediaType =
  | "audio/mp4"
  | "audio/ogg"
  | "audio/wav"
  | "audio/webm"
  | "image/jpeg"
  | "image/png";

export type SupportedExtension =
  | "jpeg"
  | "jpg"
  | "m4a"
  | "mp4"
  | "oga"
  | "ogg"
  | "png"
  | "wav"
  | "webm";

export interface MediaPolicy {
  readonly maxBytes: Readonly<Record<MediaKind, number>>;
  readonly maxCount: Readonly<Record<MediaKind, number>>;
  readonly maxFilenameLength: number;
  readonly maxReadGrantSeconds: number;
}

export interface MediaUploadCandidate {
  readonly bytes: Uint8Array;
  readonly declaredMediaType: string;
  readonly filename: string;
  readonly kind: MediaKind;
}

export interface DetectedMedia {
  readonly extension: SupportedExtension;
  readonly kind: MediaKind;
  readonly mediaType: SupportedMediaType;
}

export interface ValidatedMedia extends DetectedMedia {
  readonly bytes: Uint8Array;
  readonly displayFilename: string;
}

export interface MediaUploadContext {
  readonly organisationId: OrganisationId;
  readonly requestId: string;
  readonly siteVisitId: EntityId;
}

interface IngestedMediaBase extends DetectedMedia {
  readonly checksumSha256: string;
  readonly displayFilename: string;
  readonly metadataRemoved: boolean;
  readonly objectKey: string;
  readonly originalChecksumSha256: string;
  readonly originalSizeBytes: number;
  readonly sizeBytes: number;
  readonly status: "DUPLICATE" | "STORED";
  readonly synthetic: true;
}

export interface IngestedAudioMedia extends IngestedMediaBase {
  readonly authority: "AUTHORITATIVE";
  readonly kind: "AUDIO";
}

export interface IngestedPhotoMedia extends IngestedMediaBase {
  readonly authority: "CONTEXT_ONLY";
  readonly kind: "PHOTO";
}

export type IngestedMedia = IngestedAudioMedia | IngestedPhotoMedia;

export interface PrivateObjectDescriptor {
  readonly checksumSha256: string;
  readonly contentType: SupportedMediaType;
  readonly objectKey: string;
  readonly sizeBytes: number;
}

export interface PrivateReadGrant {
  readonly expiresAt: string;
  readonly token: string;
}

export interface PrivateObjectWrite {
  readonly bytes: Uint8Array;
  readonly checksumSha256: string;
  readonly contentType: SupportedMediaType;
  readonly objectKey: string;
  readonly signal?: AbortSignal;
}

export interface PrivateObjectStorage {
  createReadGrant(
    objectKey: string,
    expiresInSeconds: number,
  ): Promise<PrivateReadGrant>;
  deletePrivate(objectKey: string): Promise<void>;
  putPrivate(input: PrivateObjectWrite): Promise<PrivateObjectDescriptor>;
  readWithGrant(token: string): Promise<Uint8Array>;
}

export interface MediaUploadProgress {
  readonly percent: number;
  readonly phase: "HASHING" | "STORING" | "VALIDATING";
}

export type MediaProgressListener = (progress: MediaUploadProgress) => void;

export type SafeMediaLogEvent =
  | {
      readonly attempt: number;
      readonly mediaKind: MediaKind;
      readonly requestId: string;
      readonly sizeBytes: number;
      readonly type: "MEDIA_UPLOAD_STARTED";
    }
  | {
      readonly attempt: number;
      readonly mediaKind: MediaKind;
      readonly outcome: "DUPLICATE" | "STORED";
      readonly requestId: string;
      readonly sizeBytes: number;
      readonly type: "MEDIA_UPLOAD_COMPLETED";
    }
  | {
      readonly attempt: number;
      readonly errorCode: MediaErrorCode;
      readonly mediaKind: MediaKind;
      readonly requestId: string;
      readonly type: "MEDIA_UPLOAD_FAILED";
    }
  | {
      readonly attempt: number;
      readonly errorCode: "STORAGE_TRANSIENT";
      readonly mediaKind: MediaKind;
      readonly requestId: string;
      readonly type: "MEDIA_UPLOAD_RETRYING";
    };

export interface SafeMediaLogger {
  log(event: SafeMediaLogEvent): void;
}

export type MediaErrorCode =
  | "CANCELLED"
  | "COUNT_LIMIT_EXCEEDED"
  | "DECLARED_TYPE_MISMATCH"
  | "EMPTY_FILE"
  | "EXTENSION_MISMATCH"
  | "FILENAME_INVALID"
  | "MALFORMED_CONTENT"
  | "SIZE_LIMIT_EXCEEDED"
  | "STORAGE_ACCESS_DENIED"
  | "STORAGE_COLLISION"
  | "STORAGE_EXPIRED"
  | "STORAGE_NOT_FOUND"
  | "STORAGE_TRANSIENT"
  | "UNSUPPORTED_CONTENT";

export class MediaError extends Error {
  readonly code: MediaErrorCode;

  constructor(code: MediaErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MediaError";
    this.code = code;
  }
}

export function authorityForMedia(kind: MediaKind): EvidenceAuthority {
  return kind === "PHOTO" ? "CONTEXT_ONLY" : "AUTHORITATIVE";
}
