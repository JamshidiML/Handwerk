import { describe, expect, it } from "vitest";
import {
  INITIAL_UPLOAD_STATE,
  canRetryUpload,
  uploadReducer,
} from "./upload-machine";

describe("capture upload state machine", () => {
  it("moves through validation, progress and duplicate completion", () => {
    const selected = uploadReducer(INITIAL_UPLOAD_STATE, { type: "SELECT" });
    const uploading = uploadReducer(selected, { type: "VALID" });
    const progressed = uploadReducer(uploading, {
      percent: 48.6,
      type: "PROGRESS",
    });
    const completed = uploadReducer(progressed, {
      outcome: "DUPLICATE",
      type: "SUCCEED",
    });

    expect(progressed.progress).toBe(49);
    expect(completed).toMatchObject({
      outcome: "DUPLICATE",
      progress: 100,
      status: "UPLOADED",
    });
  });

  it("keeps cancellation terminal until an explicit retry", () => {
    const uploading = uploadReducer(
      uploadReducer(INITIAL_UPLOAD_STATE, { type: "SELECT" }),
      { type: "VALID" },
    );
    const cancelled = uploadReducer(uploading, { type: "CANCEL" });
    const staleCompletion = uploadReducer(cancelled, {
      outcome: "STORED",
      type: "SUCCEED",
    });
    const retry = uploadReducer(staleCompletion, { type: "RETRY" });

    expect(cancelled).toMatchObject({
      errorCode: "CANCELLED",
      status: "CANCELLED",
    });
    expect(staleCompletion).toEqual(cancelled);
    expect(canRetryUpload(cancelled)).toBe(true);
    expect(retry).toMatchObject({
      attempt: 2,
      progress: 0,
      status: "VALIDATING",
    });
  });

  it("does not retry a successful upload", () => {
    const completed = {
      attempt: 1,
      outcome: "STORED" as const,
      progress: 100,
      status: "UPLOADED" as const,
    };
    expect(uploadReducer(completed, { type: "RETRY" })).toBe(completed);
    expect(canRetryUpload(completed)).toBe(false);
  });
});
