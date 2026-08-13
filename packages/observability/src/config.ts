export type RuntimeEnvironment = "development" | "test" | "production";
export type LogLevel = "debug" | "info" | "warn" | "error";
export type TelemetryMode = "disabled" | "local";
export type AiProvider = "deterministic_fake" | "live_flagged";

export interface RuntimeConfig {
  environment: RuntimeEnvironment;
  demoMode: boolean;
  aiProvider: AiProvider;
  liveAiEnabled: boolean;
  logLevel: LogLevel;
  telemetryMode: TelemetryMode;
  port: number;
  databaseUrl: URL;
  objectStorage: {
    endpoint: URL;
    region: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
  };
}

export interface ConfigIssue {
  variable: string;
  reason: string;
}

export class ConfigValidationError extends Error {
  readonly issues: readonly ConfigIssue[];

  constructor(issues: readonly ConfigIssue[]) {
    super(
      `Invalid environment configuration: ${issues.map((issue) => issue.variable).join(", ")}`,
    );
    this.name = "ConfigValidationError";
    this.issues = issues;
  }
}

function required(
  env: NodeJS.ProcessEnv,
  variable: string,
  issues: ConfigIssue[],
): string {
  const value = env[variable]?.trim();
  if (!value) issues.push({ variable, reason: "is required" });
  return value ?? "";
}

function oneOf<T extends string>(
  env: NodeJS.ProcessEnv,
  variable: string,
  allowed: readonly T[],
  issues: ConfigIssue[],
): T {
  const value = required(env, variable, issues);
  if (!allowed.includes(value as T)) {
    issues.push({ variable, reason: `must be one of ${allowed.join(", ")}` });
  }
  return value as T;
}

function booleanValue(
  env: NodeJS.ProcessEnv,
  variable: string,
  issues: ConfigIssue[],
): boolean {
  const value = required(env, variable, issues);
  if (value !== "true" && value !== "false") {
    issues.push({ variable, reason: "must be true or false" });
  }
  return value === "true";
}

function urlValue(
  env: NodeJS.ProcessEnv,
  variable: string,
  issues: ConfigIssue[],
): URL {
  const value = required(env, variable, issues);
  try {
    return new URL(value);
  } catch {
    issues.push({ variable, reason: "must be an absolute URL" });
    return new URL("http://invalid.local");
  }
}

function portValue(env: NodeJS.ProcessEnv, issues: ConfigIssue[]): number {
  const raw = required(env, "PORT", issues);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    issues.push({
      variable: "PORT",
      reason: "must be an integer from 1 to 65535",
    });
  }
  return value;
}

function isLoopback(hostname: string): boolean {
  return (
    hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1"
  );
}

function looksLikePlaceholder(value: string): boolean {
  return /(?:change-me|development-only|example|placeholder)/i.test(value);
}

export function loadRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  const issues: ConfigIssue[] = [];
  const environment = oneOf(
    env,
    "HANDWERK_ENV",
    ["development", "test", "production"],
    issues,
  );
  const demoMode = booleanValue(env, "DEMO_MODE", issues);
  const aiProvider = oneOf(
    env,
    "AI_PROVIDER",
    ["deterministic_fake", "live_flagged"],
    issues,
  );
  const liveAiEnabled = booleanValue(env, "ENABLE_LIVE_AI", issues);
  const logLevel = oneOf(
    env,
    "LOG_LEVEL",
    ["debug", "info", "warn", "error"],
    issues,
  );
  const telemetryMode = oneOf(
    env,
    "TELEMETRY_MODE",
    ["disabled", "local"],
    issues,
  );
  const port = portValue(env, issues);
  const databaseUrl = urlValue(env, "DATABASE_URL", issues);
  const endpoint = urlValue(env, "OBJECT_STORAGE_ENDPOINT", issues);
  const region = required(env, "OBJECT_STORAGE_REGION", issues);
  const bucket = required(env, "OBJECT_STORAGE_BUCKET", issues);
  const accessKey = required(env, "OBJECT_STORAGE_ACCESS_KEY", issues);
  const secretKey = required(env, "OBJECT_STORAGE_SECRET_KEY", issues);

  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
    issues.push({ variable: "DATABASE_URL", reason: "must use PostgreSQL" });
  }
  if (environment === "production" && demoMode) {
    issues.push({
      variable: "DEMO_MODE",
      reason: "must be false in production",
    });
  }
  if (aiProvider === "live_flagged" && !liveAiEnabled) {
    issues.push({
      variable: "ENABLE_LIVE_AI",
      reason: "must explicitly enable live_flagged AI",
    });
  }
  if (environment === "production" && endpoint.protocol !== "https:") {
    issues.push({
      variable: "OBJECT_STORAGE_ENDPOINT",
      reason: "must use HTTPS in production",
    });
  }
  if (
    environment !== "production" &&
    endpoint.protocol === "http:" &&
    !isLoopback(endpoint.hostname)
  ) {
    issues.push({
      variable: "OBJECT_STORAGE_ENDPOINT",
      reason: "plain HTTP is restricted to loopback",
    });
  }
  if (
    environment === "production" &&
    [databaseUrl.password, accessKey, secretKey].some(looksLikePlaceholder)
  ) {
    issues.push({
      variable: "production credentials",
      reason: "must not use local placeholders",
    });
  }

  if (issues.length > 0) throw new ConfigValidationError(issues);

  return Object.freeze({
    environment,
    demoMode,
    aiProvider,
    liveAiEnabled,
    logLevel,
    telemetryMode,
    port,
    databaseUrl,
    objectStorage: Object.freeze({
      endpoint,
      region,
      bucket,
      accessKey,
      secretKey,
    }),
  });
}
