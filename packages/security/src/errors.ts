import type { ApiError } from "@handwerk/contracts";

export type SecurityErrorCode = ApiError["code"];

export class SecurityBoundaryError extends Error {
  readonly code: SecurityErrorCode;
  readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;

  constructor(
    code: SecurityErrorCode,
    message: string,
    fieldErrors?: Readonly<Record<string, readonly string[]>>,
  ) {
    super(message);
    this.name = "SecurityBoundaryError";
    this.code = code;
    if (fieldErrors) this.fieldErrors = fieldErrors;
  }
}

export function authenticationRequired(): never {
  throw new SecurityBoundaryError(
    "AUTHENTICATION_REQUIRED",
    "Anmeldung erforderlich.",
  );
}

export function forbiddenOrNotFound(): never {
  throw new SecurityBoundaryError(
    "FORBIDDEN_OR_NOT_FOUND",
    "Die angeforderte Ressource wurde nicht gefunden.",
  );
}

export function failedSafe(
  message = "Die Aktion wurde sicher abgebrochen.",
): never {
  throw new SecurityBoundaryError("FAILED_SAFE", message);
}

export function validationFailed(
  fieldErrors: Readonly<Record<string, readonly string[]>>,
): never {
  throw new SecurityBoundaryError(
    "VALIDATION_FAILED",
    "Die Eingabe ist ungültig.",
    fieldErrors,
  );
}

export function toSafeApiError(error: unknown, requestId: string): ApiError {
  if (error instanceof SecurityBoundaryError) {
    if (error.fieldErrors) {
      const fieldErrors = Object.fromEntries(
        Object.entries(error.fieldErrors).map(([key, values]) => [
          key,
          [...values],
        ]),
      );
      return {
        code: error.code,
        message: error.message,
        requestId,
        fieldErrors,
      };
    }
    return { code: error.code, message: error.message, requestId };
  }

  return {
    code: "FAILED_SAFE",
    message: "Die Aktion wurde sicher abgebrochen.",
    requestId,
  };
}
