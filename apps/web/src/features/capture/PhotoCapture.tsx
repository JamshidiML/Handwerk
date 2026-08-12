"use client";

import { Camera, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  MEDIA_POLICY,
  MediaError,
  validateBrowserMediaFile,
  validateMediaCount,
} from "@handwerk/media/browser";
import { germanMediaError, mediaErrorCode } from "./media-errors";
import styles from "./Capture.module.css";
import {
  INITIAL_UPLOAD_STATE,
  canRetryUpload,
  uploadReducer,
  type UploadState,
} from "./upload-machine";
import type {
  CapturedPhoto,
  CaptureUploadHandler,
  CaptureUploadResult,
} from "./types";

interface PhotoQueueItem {
  readonly abortController?: AbortController;
  readonly file: File;
  readonly id: string;
  readonly previewUrl?: string;
  readonly result?: CaptureUploadResult;
  readonly state: UploadState;
}

export interface PhotoCaptureProps {
  readonly initialCount?: number;
  readonly onPhotoCaptured?: (photo: CapturedPhoto) => void;
  readonly onUpload: CaptureUploadHandler;
}

function clientId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `photo-${Date.now()}`;
}

function statusText(item: PhotoQueueItem): string {
  switch (item.state.status) {
    case "VALIDATING":
      return "Datei wird geprüft";
    case "UPLOADING":
      return `Upload ${item.state.progress} %`;
    case "UPLOADED":
      return item.state.outcome === "DUPLICATE"
        ? "Bereits vorhanden"
        : "Privat gespeichert";
    case "FAILED":
      return germanMediaError(
        new MediaError(item.state.errorCode ?? "STORAGE_TRANSIENT", "failed"),
      );
    case "CANCELLED":
      return "Upload abgebrochen";
    case "IDLE":
      return "Bereit";
  }
}

export function PhotoCapture({
  initialCount = 0,
  onPhotoCaptured,
  onUpload,
}: PhotoCaptureProps) {
  const inputId = useId();
  const [items, setItems] = useState<PhotoQueueItem[]>([]);
  const [selectionError, setSelectionError] = useState<string>();
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(
    () => () => {
      for (const item of itemsRef.current) {
        item.abortController?.abort();
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    },
    [],
  );

  function updateItem(
    id: string,
    transform: (item: PhotoQueueItem) => PhotoQueueItem,
  ) {
    setItems((current) =>
      current.map((item) => (item.id === id ? transform(item) : item)),
    );
  }

  async function upload(item: PhotoQueueItem) {
    const abortController = new AbortController();
    updateItem(item.id, (current) => ({ ...current, abortController }));

    try {
      await validateBrowserMediaFile(item.file, "PHOTO");
      const previewUrl = item.previewUrl ?? URL.createObjectURL(item.file);
      updateItem(item.id, (current) => ({
        ...current,
        abortController,
        previewUrl,
        state: uploadReducer(current.state, { type: "VALID" }),
      }));
      const result = await onUpload(item.file, {
        onProgress: (percent) =>
          updateItem(item.id, (current) => ({
            ...current,
            state: uploadReducer(current.state, {
              percent,
              type: "PROGRESS",
            }),
          })),
        signal: abortController.signal,
      });
      if (abortController.signal.aborted) {
        throw new MediaError("CANCELLED", "Upload cancelled");
      }
      updateItem(item.id, (current) => ({
        ...current,
        abortController: undefined,
        result,
        state: uploadReducer(current.state, {
          outcome: result.status,
          type: "SUCCEED",
        }),
      }));
      onPhotoCaptured?.({ authority: "CONTEXT_ONLY", file: item.file, result });
    } catch (error) {
      const code = mediaErrorCode(error);
      updateItem(item.id, (current) => ({
        ...current,
        abortController: undefined,
        state: uploadReducer(
          current.state,
          code === "CANCELLED"
            ? { type: "CANCEL" }
            : { errorCode: code, type: "FAIL" },
        ),
      }));
    }
  }

  function selectFiles(files: FileList | null) {
    if (!files?.length) return;
    try {
      validateMediaCount("PHOTO", initialCount + items.length + files.length);
      setSelectionError(undefined);
    } catch (error) {
      setSelectionError(germanMediaError(error));
      return;
    }

    const selected = Array.from(files).map<PhotoQueueItem>((file) => ({
      file,
      id: clientId(),
      state: uploadReducer(INITIAL_UPLOAD_STATE, { type: "SELECT" }),
    }));
    setItems((current) => [...current, ...selected]);
    for (const item of selected) void upload(item);
  }

  function cancel(item: PhotoQueueItem) {
    item.abortController?.abort();
    updateItem(item.id, (current) => ({
      ...current,
      state: uploadReducer(current.state, { type: "CANCEL" }),
    }));
  }

  function retry(item: PhotoQueueItem) {
    const retried = {
      ...item,
      state: uploadReducer(item.state, { type: "RETRY" }),
    };
    updateItem(item.id, () => retried);
    void upload(retried);
  }

  function remove(item: PhotoQueueItem) {
    item.abortController?.abort();
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    setItems((current) =>
      current.filter((candidate) => candidate.id !== item.id),
    );
  }

  return (
    <section className={styles.section} aria-labelledby={`${inputId}-title`}>
      <div className={styles.sectionHeading}>
        <div>
          <h2 id={`${inputId}-title`}>Fotos</h2>
          <span className={styles.contextBadge}>Nur Kontext</span>
        </div>
        <span className={styles.counter} aria-label="Anzahl Fotos">
          {initialCount + items.length}/{MEDIA_POLICY.maxCount.PHOTO}
        </span>
      </div>

      <input
        accept="image/jpeg,image/png"
        capture="environment"
        className={styles.visuallyHidden}
        id={inputId}
        multiple
        onChange={(event) => {
          selectFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
        type="file"
      />
      <label className={styles.commandButton} htmlFor={inputId}>
        <Camera aria-hidden="true" size={18} />
        Fotos aufnehmen oder auswählen
      </label>
      {selectionError ? (
        <p className={styles.error} role="alert">
          {selectionError}
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className={styles.photoGrid} aria-label="Foto-Uploads">
          {items.map((item) => (
            <li className={styles.photoItem} key={item.id}>
              <div className={styles.previewFrame}>
                {item.previewUrl ? (
                  // The preview is local-only and revoked when removed or unmounted.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={`Vorschau ${item.file.name}`}
                    src={item.previewUrl}
                  />
                ) : (
                  <Camera aria-hidden="true" size={24} />
                )}
              </div>
              <div className={styles.itemBody}>
                <strong title={item.file.name}>{item.file.name}</strong>
                <span aria-live="polite">{statusText(item)}</span>
                {item.state.status === "UPLOADING" ? (
                  <progress max="100" value={item.state.progress}>
                    {item.state.progress} %
                  </progress>
                ) : null}
              </div>
              <div className={styles.iconActions}>
                {item.state.status === "UPLOADING" ||
                item.state.status === "VALIDATING" ? (
                  <button
                    aria-label={`Upload ${item.file.name} abbrechen`}
                    className={styles.iconButton}
                    onClick={() => cancel(item)}
                    title="Upload abbrechen"
                    type="button"
                  >
                    <X aria-hidden="true" size={18} />
                  </button>
                ) : null}
                {canRetryUpload(item.state) ? (
                  <button
                    aria-label={`Upload ${item.file.name} wiederholen`}
                    className={styles.iconButton}
                    onClick={() => retry(item)}
                    title="Upload wiederholen"
                    type="button"
                  >
                    <RefreshCw aria-hidden="true" size={18} />
                  </button>
                ) : null}
                <button
                  aria-label={`${item.file.name} entfernen`}
                  className={styles.iconButton}
                  onClick={() => remove(item)}
                  title="Entfernen"
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={18} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <p className={styles.authorityNote}>
        Fotos dokumentieren sichtbaren Kontext. Maße werden ausschließlich als
        bestätigte Messwerte erfasst.
      </p>
    </section>
  );
}
