import type { EntityId } from "@handwerk/contracts";
import type { MediaKind } from "../../../../../packages/media/src/browser";

export interface CaptureUploadResult {
  readonly evidenceAssetId?: EntityId;
  readonly status: "DUPLICATE" | "STORED";
}

export type CaptureUploadHandler = (
  file: File,
  options: {
    readonly onProgress: (percent: number) => void;
    readonly signal: AbortSignal;
  },
) => Promise<CaptureUploadResult>;

export interface TranscriptFallbackDraft {
  readonly language: "de";
  readonly text: string;
  readonly transcriptFallback: true;
}

export interface CapturedPhoto {
  readonly authority: "CONTEXT_ONLY";
  readonly file: File;
  readonly result: CaptureUploadResult;
}

export interface CapturedAudio {
  readonly authority: "AUTHORITATIVE";
  readonly file: File;
  readonly result: CaptureUploadResult;
}

export interface CapturePermissionState {
  readonly kind: Extract<MediaKind, "AUDIO">;
  readonly status: "DENIED" | "UNAVAILABLE";
}
