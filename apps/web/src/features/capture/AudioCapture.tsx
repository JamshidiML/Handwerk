"use client";

import { Mic, RefreshCw, Square, Upload, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  MediaError,
  validateBrowserMediaFile,
} from "../../../../../packages/media/src/browser";
import { germanMediaError, mediaErrorCode } from "./media-errors";
import styles from "./Capture.module.css";
import {
  INITIAL_UPLOAD_STATE,
  canRetryUpload,
  uploadReducer,
  type UploadState,
} from "./upload-machine";
import type {
  CapturedAudio,
  CapturePermissionState,
  CaptureUploadHandler,
  TranscriptFallbackDraft,
} from "./types";

type RecorderState =
  | "CHECKING"
  | "DENIED"
  | "IDLE"
  | "RECORDING"
  | "REQUESTING"
  | "UNAVAILABLE";

export interface AudioCaptureProps {
  readonly onAudioCaptured?: (audio: CapturedAudio) => void;
  readonly onPermissionState?: (state: CapturePermissionState) => void;
  readonly onTranscriptFallback: (draft: TranscriptFallbackDraft) => void;
  readonly onUpload: CaptureUploadHandler;
}

const RECORDING_TYPES = ["audio/webm", "audio/mp4"] as const;

function supportedRecordingType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

function extensionForMediaType(mediaType: string): "m4a" | "webm" {
  return mediaType.startsWith("audio/mp4") ? "m4a" : "webm";
}

export function AudioCapture({
  onAudioCaptured,
  onPermissionState,
  onTranscriptFallback,
  onUpload,
}: AudioCaptureProps) {
  const fileInputId = useId();
  const fallbackId = useId();
  const [recorderState, setRecorderState] = useState<RecorderState>("CHECKING");
  const [uploadState, setUploadState] =
    useState<UploadState>(INITIAL_UPLOAD_STATE);
  const [lastFile, setLastFile] = useState<File>();
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [fallbackError, setFallbackError] = useState<string>();
  const [uploadError, setUploadError] = useState<string>();
  const abortRef = useRef<AbortController | undefined>(undefined);
  const chunksRef = useRef<Blob[]>([]);
  const discardRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | undefined>(undefined);
  const streamRef = useRef<MediaStream | undefined>(undefined);

  useEffect(() => {
    const capabilityCheck = window.setTimeout(() => {
      const available =
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        Boolean(supportedRecordingType());
      setRecorderState(available ? "IDLE" : "UNAVAILABLE");
      if (!available) {
        setFallbackOpen(true);
        onPermissionState?.({ kind: "AUDIO", status: "UNAVAILABLE" });
      }
    }, 0);
    return () => {
      window.clearTimeout(capabilityCheck);
      abortRef.current?.abort();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [onPermissionState]);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
  }

  async function uploadFile(file: File, retry = false) {
    const nextState = retry
      ? uploadReducer(uploadState, { type: "RETRY" })
      : uploadReducer(INITIAL_UPLOAD_STATE, { type: "SELECT" });
    setLastFile(file);
    setUploadError(undefined);
    setUploadState(nextState);
    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      await validateBrowserMediaFile(file, "AUDIO");
      setUploadState((current) => uploadReducer(current, { type: "VALID" }));
      const result = await onUpload(file, {
        onProgress: (percent) =>
          setUploadState((current) =>
            uploadReducer(current, { percent, type: "PROGRESS" }),
          ),
        signal: abortController.signal,
      });
      if (abortController.signal.aborted) {
        throw new MediaError("CANCELLED", "Upload cancelled");
      }
      setUploadState((current) =>
        uploadReducer(current, { outcome: result.status, type: "SUCCEED" }),
      );
      onAudioCaptured?.({ authority: "AUTHORITATIVE", file, result });
    } catch (error) {
      const code = mediaErrorCode(error);
      setUploadError(germanMediaError(error));
      setUploadState((current) =>
        uploadReducer(
          current,
          code === "CANCELLED"
            ? { type: "CANCEL" }
            : { errorCode: code, type: "FAIL" },
        ),
      );
    } finally {
      abortRef.current = undefined;
    }
  }

  async function startRecording() {
    const mediaType = supportedRecordingType();
    if (!navigator.mediaDevices?.getUserMedia || !mediaType) {
      setRecorderState("UNAVAILABLE");
      setFallbackOpen(true);
      onPermissionState?.({ kind: "AUDIO", status: "UNAVAILABLE" });
      return;
    }

    setRecorderState("REQUESTING");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      discardRef.current = false;
      const recorder = new MediaRecorder(stream, { mimeType: mediaType });
      recorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });
      recorder.addEventListener(
        "stop",
        () => {
          stopTracks();
          setRecorderState("IDLE");
          if (discardRef.current) {
            chunksRef.current = [];
            return;
          }
          const blob = new Blob(chunksRef.current, { type: mediaType });
          const file = new File(
            [blob],
            `baustellen-notiz.${extensionForMediaType(mediaType)}`,
            { type: mediaType },
          );
          void uploadFile(file);
        },
        { once: true },
      );
      recorder.start(500);
      setRecorderState("RECORDING");
    } catch (error) {
      stopTracks();
      const denied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError");
      setRecorderState(denied ? "DENIED" : "UNAVAILABLE");
      setFallbackOpen(true);
      onPermissionState?.({
        kind: "AUDIO",
        status: denied ? "DENIED" : "UNAVAILABLE",
      });
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function cancelRecordingOrUpload() {
    if (recorderRef.current?.state === "recording") {
      discardRef.current = true;
      recorderRef.current.stop();
      return;
    }
    abortRef.current?.abort();
    setUploadState((current) => uploadReducer(current, { type: "CANCEL" }));
  }

  function submitFallback() {
    const text = transcript.trim();
    if (text.length < 3 || text.length > 5_000) {
      setFallbackError("Transkript mit 3 bis 5.000 Zeichen eingeben.");
      return;
    }
    setFallbackError(undefined);
    onTranscriptFallback({ language: "de", text, transcriptFallback: true });
  }

  const busy =
    recorderState === "REQUESTING" ||
    uploadState.status === "VALIDATING" ||
    uploadState.status === "UPLOADING";

  return (
    <section
      className={styles.section}
      aria-labelledby={`${fileInputId}-title`}
    >
      <div className={styles.sectionHeading}>
        <h2 id={`${fileInputId}-title`}>Sprachnotiz</h2>
        <span className={styles.secureBadge}>Privat</span>
      </div>

      <div className={styles.commandRow}>
        {recorderState === "RECORDING" ? (
          <button
            className={styles.dangerButton}
            onClick={stopRecording}
            type="button"
          >
            <Square aria-hidden="true" size={17} />
            Aufnahme beenden
          </button>
        ) : (
          <button
            className={styles.commandButton}
            disabled={
              busy ||
              recorderState === "UNAVAILABLE" ||
              recorderState === "DENIED"
            }
            onClick={() => void startRecording()}
            type="button"
          >
            <Mic aria-hidden="true" size={18} />
            Aufnahme starten
          </button>
        )}

        <input
          accept="audio/mp4,audio/ogg,audio/wav,audio/webm"
          className={styles.visuallyHidden}
          id={fileInputId}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void uploadFile(file);
            event.currentTarget.value = "";
          }}
          type="file"
        />
        <label className={styles.secondaryButton} htmlFor={fileInputId}>
          <Upload aria-hidden="true" size={18} />
          Audiodatei
        </label>
      </div>

      {recorderState === "RECORDING" ? (
        <p className={styles.recordingStatus} role="status">
          <span aria-hidden="true" /> Aufnahme läuft
        </p>
      ) : null}
      {recorderState === "REQUESTING" ? (
        <p className={styles.muted} role="status">
          Mikrofonfreigabe wird geprüft ...
        </p>
      ) : null}
      {recorderState === "DENIED" ? (
        <p className={styles.error} role="alert">
          Mikrofonzugriff wurde nicht erlaubt.
        </p>
      ) : null}
      {recorderState === "UNAVAILABLE" ? (
        <p className={styles.error} role="status">
          Aufnahme ist auf diesem Gerät nicht verfügbar.
        </p>
      ) : null}

      {uploadState.status === "UPLOADING" ||
      uploadState.status === "VALIDATING" ? (
        <div className={styles.uploadStatus} aria-live="polite">
          <span>
            {uploadState.status === "VALIDATING"
              ? "Audiodatei wird geprüft"
              : `Upload ${uploadState.progress} %`}
          </span>
          <progress max="100" value={uploadState.progress} />
          <button
            aria-label="Audio-Upload abbrechen"
            className={styles.iconButton}
            onClick={cancelRecordingOrUpload}
            title="Upload abbrechen"
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
      ) : null}
      {uploadState.status === "UPLOADED" ? (
        <p className={styles.success} role="status">
          {uploadState.outcome === "DUPLICATE"
            ? "Sprachnotiz war bereits vorhanden."
            : "Sprachnotiz privat gespeichert."}
        </p>
      ) : null}
      {uploadError ? (
        <div className={styles.inlineError} role="alert">
          <span>{uploadError}</span>
          {canRetryUpload(uploadState) && lastFile ? (
            <button
              className={styles.textButton}
              onClick={() => void uploadFile(lastFile, true)}
              type="button"
            >
              <RefreshCw aria-hidden="true" size={16} />
              Erneut versuchen
            </button>
          ) : null}
        </div>
      ) : null}

      <button
        aria-expanded={fallbackOpen}
        className={styles.textButton}
        onClick={() => setFallbackOpen((open) => !open)}
        type="button"
      >
        Transkript-Ersatz manuell eingeben
      </button>

      {fallbackOpen ? (
        <div className={styles.fallbackBlock}>
          <label htmlFor={fallbackId}>
            Transkript-Ersatz (manuelle Eingabe)
          </label>
          <textarea
            id={fallbackId}
            maxLength={5_000}
            onChange={(event) => setTranscript(event.currentTarget.value)}
            rows={5}
            value={transcript}
          />
          <div className={styles.fieldFooter}>
            <span>{transcript.length}/5.000</span>
            <button
              className={styles.secondaryButton}
              onClick={submitFallback}
              type="button"
            >
              Transkript übernehmen
            </button>
          </div>
          {fallbackError ? (
            <p className={styles.error} role="alert">
              {fallbackError}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
