export type DomainErrorCode =
  | "APPROVAL_REQUIRED"
  | "DELETION_NOT_ALLOWED"
  | "FORBIDDEN_OR_NOT_FOUND"
  | "INACTIVE_PRICE_BOOK_ITEM"
  | "INCOMPATIBLE_UNIT"
  | "INVALID_APPROVAL"
  | "INVALID_MONEY"
  | "INVALID_QUANTITY"
  | "INVALID_REVISION"
  | "INVALID_STATE_TRANSITION"
  | "TENANT_MISMATCH"
  | "UNRESOLVED_CLARIFICATION"
  | "VERSION_CONFLICT";

export class DomainInvariantError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainInvariantError";
    this.code = code;
  }
}

export function invariant(
  condition: unknown,
  code: DomainErrorCode,
  message: string,
): asserts condition {
  if (!condition) {
    throw new DomainInvariantError(code, message);
  }
}
