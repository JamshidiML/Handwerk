import { MediaError } from "../../../../../packages/media/src/browser";
import type { MediaErrorCode } from "../../../../../packages/media/src/types";

const GERMAN_MEDIA_ERRORS: Readonly<Record<MediaErrorCode, string>> = {
  CANCELLED: "Upload abgebrochen.",
  COUNT_LIMIT_EXCEEDED: "Zu viele Dateien ausgewählt.",
  DECLARED_TYPE_MISMATCH: "Dateityp und Dateiinhalt stimmen nicht überein.",
  EMPTY_FILE: "Die Datei ist leer.",
  EXTENSION_MISMATCH: "Dateiendung und Dateiinhalt stimmen nicht überein.",
  FILENAME_INVALID: "Der Dateiname ist ungültig.",
  MALFORMED_CONTENT: "Die Datei ist beschädigt oder unvollständig.",
  SIZE_LIMIT_EXCEEDED: "Die Datei überschreitet die zulässige Größe.",
  STORAGE_ACCESS_DENIED: "Kein Zugriff auf den privaten Speicher.",
  STORAGE_COLLISION: "Der Upload konnte nicht eindeutig gespeichert werden.",
  STORAGE_EXPIRED: "Der private Zugriff ist abgelaufen.",
  STORAGE_NOT_FOUND: "Die gespeicherte Datei wurde nicht gefunden.",
  STORAGE_TRANSIENT: "Der Upload ist vorübergehend nicht verfügbar.",
  UNSUPPORTED_CONTENT: "Dieses Dateiformat wird nicht unterstützt.",
};

export function mediaErrorCode(error: unknown): MediaErrorCode {
  if (error instanceof MediaError) return error.code;
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  ) {
    return "CANCELLED";
  }
  return "STORAGE_TRANSIENT";
}

export function germanMediaError(error: unknown): string {
  return GERMAN_MEDIA_ERRORS[mediaErrorCode(error)];
}
