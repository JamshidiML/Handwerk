export type HealthStatus = "up" | "down";

export interface HealthCheckResult {
  status: HealthStatus;
  reasonCode?: string;
}

export interface HealthCheck {
  name: string;
  check(signal: AbortSignal): Promise<HealthCheckResult>;
}

export interface ReadinessResult {
  status: "ready" | "not_ready";
  checks: Array<{
    name: string;
    status: HealthStatus;
    durationMs: number;
    reasonCode?: string;
  }>;
}

export interface LivenessResult {
  status: "alive";
}

async function runCheck(
  check: HealthCheck,
  timeoutMs: number,
): Promise<ReadinessResult["checks"][number]> {
  const started = performance.now();
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      check.check(controller.signal),
      new Promise<HealthCheckResult>((resolve) => {
        timeout = setTimeout(() => {
          controller.abort();
          resolve({ status: "down", reasonCode: "timeout" });
        }, timeoutMs);
      }),
    ]);
    return {
      name: check.name,
      status: result.status,
      durationMs: Math.round(performance.now() - started),
      ...(result.reasonCode ? { reasonCode: result.reasonCode } : {}),
    };
  } catch {
    return {
      name: check.name,
      status: "down",
      durationMs: Math.round(performance.now() - started),
      reasonCode: "check_failed",
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export class HealthService {
  readonly #checks: readonly HealthCheck[];
  readonly #timeoutMs: number;

  constructor(checks: readonly HealthCheck[], timeoutMs = 2_000) {
    if (timeoutMs < 10 || timeoutMs > 30_000)
      throw new Error("invalid health-check timeout");
    if (new Set(checks.map((check) => check.name)).size !== checks.length) {
      throw new Error("health-check names must be unique");
    }
    this.#checks = checks;
    this.#timeoutMs = timeoutMs;
  }

  liveness(): LivenessResult {
    return { status: "alive" };
  }

  async readiness(): Promise<ReadinessResult> {
    const checks = await Promise.all(
      this.#checks.map((check) => runCheck(check, this.#timeoutMs)),
    );
    return {
      status: checks.every((check) => check.status === "up")
        ? "ready"
        : "not_ready",
      checks,
    };
  }
}
