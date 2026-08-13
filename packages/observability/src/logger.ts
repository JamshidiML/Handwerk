import type { LogLevel, RuntimeEnvironment } from "./config";
import { isCorrelationId } from "./correlation";

const redacted = "[REDACTED]";
const maximumStringLength = 160;
const allowedAttributes = new Set([
  "approvalTimeMs",
  "clarificationCount",
  "component",
  "costMinorPlaceholder",
  "dependency",
  "durationMs",
  "editCount",
  "errorCode",
  "exportKind",
  "httpStatus",
  "mappingResult",
  "method",
  "model",
  "organisationHash",
  "outcome",
  "processingStage",
  "provider",
  "requestSizeBytes",
  "retryCount",
  "revision",
  "routeTemplate",
  "schemaVersion",
  "status",
  "tokenCountPlaceholder",
]);
const severityRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

type SafeAttribute = string | number | boolean | null;

export interface LogRecord {
  timestamp: string;
  severity: LogLevel;
  event: string;
  service: string;
  environment: RuntimeEnvironment;
  correlationId: string;
  attributes: Record<string, SafeAttribute>;
}

export interface LoggerOptions {
  service: string;
  environment: RuntimeEnvironment;
  minimumLevel: LogLevel;
  correlationId: string;
  sink?: (line: string) => void;
  clock?: () => Date;
}

export interface StructuredLogger {
  debug(event: string, attributes?: Readonly<Record<string, unknown>>): void;
  info(event: string, attributes?: Readonly<Record<string, unknown>>): void;
  warn(event: string, attributes?: Readonly<Record<string, unknown>>): void;
  error(event: string, attributes?: Readonly<Record<string, unknown>>): void;
}

function safeValue(key: string, value: unknown): SafeAttribute {
  if (!allowedAttributes.has(key)) return redacted;
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number")
    return Number.isFinite(value) ? value : redacted;
  if (typeof value !== "string") return redacted;
  if (key === "organisationHash" && !/^[a-f0-9]{16}$/.test(value))
    return redacted;
  const normalized = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 ? " " : character;
  }).join("");
  return normalized.length <= maximumStringLength
    ? normalized
    : `${normalized.slice(0, maximumStringLength)}...`;
}

export function redactAttributes(
  attributes: Readonly<Record<string, unknown>> = {},
): Record<string, SafeAttribute> {
  return Object.fromEntries(
    Object.entries(attributes)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, safeValue(key, value)]),
  );
}

export function createLogger(options: LoggerOptions): StructuredLogger {
  if (!isCorrelationId(options.correlationId)) {
    throw new Error("invalid correlation ID");
  }
  if (!/^[a-z][a-z0-9-]{1,62}$/.test(options.service)) {
    throw new Error("invalid service name");
  }
  const sink = options.sink ?? console.log;
  const clock = options.clock ?? (() => new Date());

  function emit(
    severity: LogLevel,
    event: string,
    attributes: Readonly<Record<string, unknown>> = {},
  ): void {
    if (severityRank[severity] < severityRank[options.minimumLevel]) return;
    if (!/^[a-z][a-z0-9_.-]{2,80}$/.test(event))
      throw new Error("invalid log event name");
    const record: LogRecord = {
      timestamp: clock().toISOString(),
      severity,
      event,
      service: options.service,
      environment: options.environment,
      correlationId: options.correlationId,
      attributes: redactAttributes(attributes),
    };
    sink(JSON.stringify(record));
  }

  return {
    debug: (event, attributes) => emit("debug", event, attributes),
    info: (event, attributes) => emit("info", event, attributes),
    warn: (event, attributes) => emit("warn", event, attributes),
    error: (event, attributes) => emit("error", event, attributes),
  };
}
