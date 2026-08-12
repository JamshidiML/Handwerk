import type { MediaErrorCode } from "../../../../../packages/media/src/types";

export type UploadStatus =
  | "CANCELLED"
  | "FAILED"
  | "IDLE"
  | "UPLOADED"
  | "UPLOADING"
  | "VALIDATING";

export interface UploadState {
  readonly attempt: number;
  readonly errorCode?: MediaErrorCode;
  readonly outcome?: "DUPLICATE" | "STORED";
  readonly progress: number;
  readonly status: UploadStatus;
}

export type UploadEvent =
  | { readonly type: "CANCEL" }
  | { readonly errorCode: MediaErrorCode; readonly type: "FAIL" }
  | { readonly percent: number; readonly type: "PROGRESS" }
  | { readonly type: "RETRY" }
  | { readonly type: "SELECT" }
  | {
      readonly outcome: "DUPLICATE" | "STORED";
      readonly type: "SUCCEED";
    }
  | { readonly type: "VALID" };

export const INITIAL_UPLOAD_STATE: UploadState = {
  attempt: 0,
  progress: 0,
  status: "IDLE",
};

function clampedProgress(percent: number): number {
  return Math.max(0, Math.min(100, Math.round(percent)));
}

export function uploadReducer(
  state: UploadState,
  event: UploadEvent,
): UploadState {
  switch (event.type) {
    case "SELECT":
      return { attempt: 1, progress: 0, status: "VALIDATING" };
    case "VALID":
      if (state.status !== "VALIDATING") return state;
      return { ...state, progress: 1, status: "UPLOADING" };
    case "PROGRESS":
      if (state.status !== "UPLOADING") return state;
      return { ...state, progress: clampedProgress(event.percent) };
    case "SUCCEED":
      if (state.status !== "UPLOADING") return state;
      return {
        ...state,
        outcome: event.outcome,
        progress: 100,
        status: "UPLOADED",
      };
    case "FAIL":
      if (state.status !== "UPLOADING" && state.status !== "VALIDATING") {
        return state;
      }
      return { ...state, errorCode: event.errorCode, status: "FAILED" };
    case "CANCEL":
      if (state.status !== "UPLOADING" && state.status !== "VALIDATING") {
        return state;
      }
      return {
        ...state,
        errorCode: "CANCELLED",
        status: "CANCELLED",
      };
    case "RETRY":
      if (state.status !== "FAILED" && state.status !== "CANCELLED") {
        return state;
      }
      return {
        attempt: state.attempt + 1,
        progress: 0,
        status: "VALIDATING",
      };
  }
}

export function canRetryUpload(state: UploadState): boolean {
  return state.status === "FAILED" || state.status === "CANCELLED";
}
