import type { EntityId } from "@handwerk/contracts";

import { validationFailed } from "./errors";

const ENTITY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;
// eslint-disable-next-line no-control-regex -- request validation removes C0 controls.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;
const PATH_SEPARATORS = /[/\\]+/g;
const UNSAFE_FILENAME_CHARACTERS = /[^A-Za-z0-9._-]+/g;

export type UnknownRecord = Record<string, unknown>;

export function expectRecord(value: unknown, field = "request"): UnknownRecord {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    validationFailed({ [field]: ["Ein Objekt wird erwartet."] });
  }
  return value as UnknownRecord;
}

export function assertAllowedKeys(
  value: UnknownRecord,
  allowedKeys: readonly string[],
): void {
  const allowed = new Set(allowedKeys);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    validationFailed({
      request: ["Nicht erlaubte Felder wurden übermittelt."],
    });
  }
}

export function readRequiredString(
  value: UnknownRecord,
  field: string,
  options: { minLength?: number; maxLength?: number } = {},
): string {
  const candidate = value[field];
  const minLength = options.minLength ?? 1;
  const maxLength = options.maxLength ?? 200;
  if (
    typeof candidate !== "string" ||
    candidate.length < minLength ||
    candidate.length > maxLength ||
    CONTROL_CHARACTERS.test(candidate)
  ) {
    CONTROL_CHARACTERS.lastIndex = 0;
    validationFailed({ [field]: ["Ungültiger Textwert."] });
  }
  CONTROL_CHARACTERS.lastIndex = 0;
  return candidate;
}

export function readRequiredBoolean(
  value: UnknownRecord,
  field: string,
): boolean {
  const candidate = value[field];
  if (typeof candidate !== "boolean") {
    validationFailed({ [field]: ["Ein Wahrheitswert wird erwartet."] });
  }
  return candidate;
}

export function validateEntityId(value: string, field = "id"): EntityId {
  if (!ENTITY_ID_PATTERN.test(value)) {
    validationFailed({ [field]: ["Ungültige Kennung."] });
  }
  return value as EntityId;
}

export function validateOpaqueToken(value: string, field: string): string {
  if (!TOKEN_PATTERN.test(value)) {
    validationFailed({ [field]: ["Ungültiges Sicherheitstoken."] });
  }
  return value;
}

export function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

export function sanitizeFilename(
  value: string,
  fallback = "download",
  maxLength = 120,
): string {
  const leaf = value
    .normalize("NFKC")
    .replace(CONTROL_CHARACTERS, "")
    .replace(PATH_SEPARATORS, "-")
    .replace(UNSAFE_FILENAME_CHARACTERS, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);

  if (!leaf || leaf === "." || leaf === "..") return fallback;
  return leaf;
}

export function assertBoundedJson(
  value: unknown,
  limits: {
    maxDepth: number;
    maxKeys: number;
    maxArrayLength: number;
    maxStringLength: number;
  },
): void {
  let keysSeen = 0;

  const visit = (candidate: unknown, depth: number): void => {
    if (depth > limits.maxDepth) {
      validationFailed({ request: ["Die Eingabe ist zu tief verschachtelt."] });
    }
    if (typeof candidate === "string") {
      if (candidate.length > limits.maxStringLength) {
        validationFailed({ request: ["Ein Textwert ist zu lang."] });
      }
      return;
    }
    if (
      candidate === null ||
      typeof candidate === "number" ||
      typeof candidate === "boolean"
    ) {
      return;
    }
    if (Array.isArray(candidate)) {
      if (candidate.length > limits.maxArrayLength) {
        validationFailed({ request: ["Die Liste enthält zu viele Einträge."] });
      }
      for (const item of candidate) visit(item, depth + 1);
      return;
    }
    const record = expectRecord(candidate);
    keysSeen += Object.keys(record).length;
    if (keysSeen > limits.maxKeys) {
      validationFailed({ request: ["Die Eingabe enthält zu viele Felder."] });
    }
    for (const item of Object.values(record)) visit(item, depth + 1);
  };

  visit(value, 0);
}
