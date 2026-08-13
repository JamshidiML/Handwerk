import type { TelemetryMode } from "./config";

export type MetricName =
  | "processing.duration_ms"
  | "mapping.result_total"
  | "clarification.count"
  | "approval.time_ms"
  | "draft.edit_total"
  | "export.outcome_total"
  | "ai.cost_placeholder_minor";

export interface MetricPoint {
  name: MetricName;
  value: number;
  labels: Readonly<Record<string, string>>;
}

const definitions: Record<
  MetricName,
  Readonly<Record<string, readonly string[]>>
> = {
  "processing.duration_ms": {
    stage: ["transcription", "extraction", "mapping", "export"],
    outcome: ["success", "failed_safe", "cancelled"],
  },
  "mapping.result_total": {
    result: ["supported", "unmatched", "needs_clarification", "rejected"],
  },
  "clarification.count": {},
  "approval.time_ms": {},
  "draft.edit_total": {
    field: ["quantity", "description", "position", "other_commercial"],
  },
  "export.outcome_total": {
    kind: ["pdf", "csv", "project_data"],
    outcome: ["success", "blocked", "failed"],
  },
  "ai.cost_placeholder_minor": {
    provider: ["deterministic_fake", "live_flagged"],
  },
};

function validatePoint(point: MetricPoint): void {
  if (!Number.isFinite(point.value) || point.value < 0) {
    throw new Error(
      `metric ${point.name} requires a finite non-negative value`,
    );
  }
  const allowedLabels = definitions[point.name];
  const expected = Object.keys(allowedLabels).sort();
  const actual = Object.keys(point.labels).sort();
  if (expected.join("|") !== actual.join("|")) {
    throw new Error(`metric ${point.name} has invalid label keys`);
  }
  for (const [key, value] of Object.entries(point.labels)) {
    if (!allowedLabels[key]?.includes(value)) {
      throw new Error(`metric ${point.name} has invalid ${key} label`);
    }
  }
}

export interface Metrics {
  record(point: MetricPoint): void;
  snapshot(): readonly MetricPoint[];
}

export function createMetrics(mode: TelemetryMode): Metrics {
  const points: MetricPoint[] = [];
  return {
    record(point) {
      validatePoint(point);
      if (mode === "local") {
        points.push({
          name: point.name,
          value: point.value,
          labels: { ...point.labels },
        });
      }
    },
    snapshot() {
      return mode === "local"
        ? points.map((point) => ({ ...point, labels: { ...point.labels } }))
        : [];
    },
  };
}
