import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "./configuration";
import { validationFailed } from "./errors";
import { sanitizeFilename, validateOpaqueToken } from "./validation";

export type HeaderSource =
  | Headers
  | Readonly<Record<string, string | undefined>>;

const DOWNLOAD_MEDIA_TYPES = new Set([
  "application/json",
  "application/pdf",
  "text/csv; charset=utf-8",
]);
const DOWNLOAD_EXTENSIONS: Readonly<Record<string, string>> = {
  "application/json": ".json",
  "application/pdf": ".pdf",
  "text/csv; charset=utf-8": ".csv",
};

export function readHeader(
  headers: HeaderSource,
  name: string,
): string | undefined {
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  const sought = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === sought) return value;
  }
  return undefined;
}

export function parseCookieHeader(
  value: string | undefined,
): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!value) return cookies;
  if (value.length > 8_192) {
    validationFailed({ cookie: ["Der Cookie-Header ist zu groß."] });
  }

  const pairs = value.split(";");
  if (pairs.length > 40) {
    validationFailed({ cookie: ["Es wurden zu viele Cookies übermittelt."] });
  }

  for (const pair of pairs) {
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    const name = pair.slice(0, separator).trim();
    const cookieValue = pair.slice(separator + 1).trim();
    if (name.length > 128 || cookieValue.length > 512) {
      validationFailed({ cookie: ["Ein Cookie ist zu groß."] });
    }
    cookies.set(name, cookieValue);
  }
  return cookies;
}

export function createSessionCookie(
  sessionId: string,
  options: { secure: boolean; maxAgeSeconds: number },
): string {
  validateOpaqueToken(sessionId, "sessionId");
  if (!options.secure) {
    validationFailed({
      cookie: ["__Host-Cookies erfordern das Secure-Attribut."],
    });
  }
  return serializeCookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: options.secure,
    maxAgeSeconds: options.maxAgeSeconds,
    sameSite: "Lax",
  });
}

export function createCsrfCookie(
  token: string,
  options: { secure: boolean; maxAgeSeconds: number },
): string {
  validateOpaqueToken(token, "csrfToken");
  if (!options.secure) {
    validationFailed({
      cookie: ["__Host-Cookies erfordern das Secure-Attribut."],
    });
  }
  return serializeCookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: options.secure,
    maxAgeSeconds: options.maxAgeSeconds,
    sameSite: "Strict",
  });
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    httpOnly: boolean;
    secure: boolean;
    maxAgeSeconds: number;
    sameSite: "Lax" | "Strict";
  },
): string {
  const attributes = [
    `${name}=${value}`,
    "Path=/",
    `Max-Age=${options.maxAgeSeconds}`,
    `SameSite=${options.sameSite}`,
  ];
  if (options.httpOnly) attributes.push("HttpOnly");
  if (options.secure) attributes.push("Secure");
  return attributes.join("; ");
}

export function buildSecurityHeaders(
  environment: "development" | "test" | "production",
): Readonly<Record<string, string>> {
  const scriptPolicy =
    environment === "production" ? "'self'" : "'self' 'unsafe-eval'";
  const headers: Record<string, string> = {
    "Cache-Control": "no-store, max-age=0",
    "Content-Security-Policy": [
      "default-src 'self'",
      `script-src ${scriptPolicy}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data:",
      "media-src 'self' blob:",
      "connect-src 'self'",
      "font-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join("; "),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy":
      "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
  if (environment === "production") {
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains";
  }
  return headers;
}

export function buildSafeDownloadHeaders(input: {
  filename: string;
  mediaType: string;
  sizeBytes: number;
}): Readonly<Record<string, string>> {
  if (!DOWNLOAD_MEDIA_TYPES.has(input.mediaType)) {
    validationFailed({ mediaType: ["Nicht erlaubter Download-Inhaltstyp."] });
  }
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 0) {
    validationFailed({ sizeBytes: ["Ungültige Download-Größe."] });
  }

  const extension = DOWNLOAD_EXTENSIONS[input.mediaType];
  if (!extension) {
    validationFailed({ mediaType: ["Nicht erlaubter Download-Inhaltstyp."] });
  }
  const sanitized = sanitizeFilename(input.filename, "handwerk-download");
  const withoutExtension = sanitized.replace(/\.[A-Za-z0-9]{1,10}$/, "");
  const filename = `${withoutExtension}${extension}`;
  return {
    "Cache-Control": "no-store, private",
    "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Content-Length": String(input.sizeBytes),
    "Content-Type": input.mediaType,
    "X-Content-Type-Options": "nosniff",
  };
}
