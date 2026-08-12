import { createHmac, randomUUID } from "node:crypto";

export const CORRELATION_HEADER = "x-correlation-id";
const validCorrelationId = /^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;

export type HeaderSource =
  | Headers
  | Readonly<Record<string, string | string[] | undefined>>;

function headerValue(headers: HeaderSource, name: string): string | undefined {
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  const entry = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(entry) ? entry[0] : entry;
}

export function correlationIdFrom(headers?: HeaderSource): string {
  const candidate = headers
    ? headerValue(headers, CORRELATION_HEADER)?.trim()
    : undefined;
  return candidate && validCorrelationId.test(candidate)
    ? candidate
    : randomUUID();
}

export function isCorrelationId(value: string): boolean {
  return validCorrelationId.test(value);
}

export function privacyHash(identifier: string, secretSalt: string): string {
  if (secretSalt.length < 16) {
    throw new Error("privacy hash salt must contain at least 16 characters");
  }
  return createHmac("sha256", secretSalt)
    .update(identifier)
    .digest("hex")
    .slice(0, 16);
}
