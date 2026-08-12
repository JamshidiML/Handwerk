import type { TenantAuthorizationContext } from "./context";
import { SecurityBoundaryError, validationFailed } from "./errors";

export type LimitedAction =
  | "UPLOAD"
  | "EXTRACTION"
  | "OFFER_EXPORT"
  | "PROJECT_DATA_EXPORT"
  | "DELETION";

export interface ActionLimitPolicy {
  maxBytes: number;
  maxRequests: number;
  windowMs: number;
}

export const SECURITY_LIMITS: Readonly<
  Record<LimitedAction, ActionLimitPolicy>
> = {
  UPLOAD: { maxBytes: 20 * 1024 * 1024, maxRequests: 20, windowMs: 60_000 },
  EXTRACTION: { maxBytes: 256 * 1024, maxRequests: 10, windowMs: 60_000 },
  OFFER_EXPORT: {
    maxBytes: 10 * 1024 * 1024,
    maxRequests: 10,
    windowMs: 60_000,
  },
  PROJECT_DATA_EXPORT: {
    maxBytes: 10 * 1024 * 1024,
    maxRequests: 5,
    windowMs: 15 * 60_000,
  },
  DELETION: { maxBytes: 16 * 1024, maxRequests: 5, windowMs: 15 * 60_000 },
};

export function assertRequestSize(
  action: LimitedAction,
  sizeBytes: number,
): void {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
    validationFailed({ sizeBytes: ["Ungültige Anfragegröße."] });
  }
  if (sizeBytes > SECURITY_LIMITS[action].maxBytes) {
    validationFailed({
      sizeBytes: ["Die Anfrage überschreitet das Größenlimit."],
    });
  }
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

export interface RateLimiter {
  consume(
    key: string,
    policy: ActionLimitPolicy,
    nowEpochMs?: number,
  ): RateLimitDecision;
}

interface WindowState {
  count: number;
  resetsAt: number;
}

export class InMemoryFixedWindowRateLimiter implements RateLimiter {
  readonly #windows = new Map<string, WindowState>();

  consume(
    key: string,
    policy: ActionLimitPolicy,
    nowEpochMs = Date.now(),
  ): RateLimitDecision {
    const current = this.#windows.get(key);
    const window =
      !current || current.resetsAt <= nowEpochMs
        ? { count: 0, resetsAt: nowEpochMs + policy.windowMs }
        : current;
    window.count += 1;
    this.#windows.set(key, window);

    const allowed = window.count <= policy.maxRequests;
    return {
      allowed,
      retryAfterSeconds: allowed
        ? 0
        : Math.max(1, Math.ceil((window.resetsAt - nowEpochMs) / 1_000)),
      remaining: Math.max(0, policy.maxRequests - window.count),
    };
  }
}

export function enforceRateLimit(
  action: LimitedAction,
  context: TenantAuthorizationContext,
  limiter: RateLimiter,
  nowEpochMs?: number,
): RateLimitDecision {
  const policy = SECURITY_LIMITS[action];
  const key = [
    action,
    context.organisationId,
    context.actorUserId,
    context.sessionId,
  ].join(":");
  const decision = limiter.consume(key, policy, nowEpochMs);
  if (!decision.allowed) {
    throw new SecurityBoundaryError(
      "FAILED_SAFE",
      `Zu viele Anfragen. Bitte in ${decision.retryAfterSeconds} Sekunden erneut versuchen.`,
    );
  }
  return decision;
}
