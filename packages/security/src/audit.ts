import type {
  AuditEvent,
  AuditEventType,
  EntityId,
  IsoDateTime,
  Project,
} from "@handwerk/contracts";

import {
  assertTenantResource,
  type TenantAuthorizationContext,
} from "./context";
import { expectRecord, validateEntityId } from "./validation";

const AUDIT_METADATA_KEYS: Readonly<Record<AuditEventType, readonly string[]>> =
  {
    CAPTURE_CREATED: ["assetId", "assetKind", "sizeBytes", "outcome"],
    EXTRACTION_COMPLETED: [
      "extractionRunId",
      "outcome",
      "durationMs",
      "factCount",
      "provider",
    ],
    MAPPING_COMPLETED: [
      "mappingRunId",
      "outcome",
      "supportedCount",
      "unmatchedCount",
    ],
    CLARIFICATION_ANSWERED: ["questionId", "answerType", "outcome"],
    DRAFT_EDITED: ["draftId", "revision", "changedFieldCount"],
    DRAFT_APPROVED: ["draftId", "revision", "approvalId"],
    APPROVAL_INVALIDATED: ["draftId", "revision", "reasonCode"],
    EXPORT_CREATED: ["artifactId", "kind", "revision", "sizeBytes"],
    DATA_EXPORT_REQUESTED: ["projectId", "format", "sizeBytes", "outcome"],
    DELETION_REQUESTED: ["deletionRequestId", "status", "outcome"],
    DEMO_DATA_DELETED: ["deletionRequestId", "status", "outcome"],
  };

const LOG_FIELD_ALLOWLIST = new Set([
  "requestId",
  "correlationId",
  "event",
  "outcome",
  "durationMs",
  "count",
  "code",
  "method",
  "routeTemplate",
  "status",
]);
const SAFE_LOG_TOKEN = /^[A-Za-z0-9_.:/-]{1,160}$/;

export interface AuditStore {
  append(event: AuditEvent): Promise<void>;
}

export interface AuditServiceDependencies {
  store: AuditStore;
  now: () => IsoDateTime;
  createId: () => string;
}

export class AuditService {
  readonly #dependencies: AuditServiceDependencies;

  constructor(dependencies: AuditServiceDependencies) {
    this.#dependencies = dependencies;
  }

  async record(input: {
    context: TenantAuthorizationContext;
    project: Pick<Project, "id" | "organisationId">;
    type: AuditEventType;
    metadata?: unknown;
    correlationId?: string;
  }): Promise<AuditEvent> {
    assertTenantResource(input.context, input.project);
    const now = this.#dependencies.now();
    const event: AuditEvent = {
      id: validateEntityId(this.#dependencies.createId(), "auditEventId"),
      organisationId: input.context.organisationId,
      projectId: input.project.id,
      actorUserId: input.context.actorUserId,
      type: input.type,
      occurredAt: now,
      metadata: sanitizeAuditMetadata(input.type, input.metadata),
      correlationId: input.correlationId ?? input.context.requestId,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    await this.#dependencies.store.append(event);
    return event;
  }
}

export function sanitizeAuditMetadata(
  type: AuditEventType,
  metadata: unknown,
): Record<string, string | number | boolean | null> {
  if (metadata === undefined) return {};
  const record = expectRecord(metadata, "metadata");
  const allowed = new Set(AUDIT_METADATA_KEYS[type]);
  const sanitized: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(record)) {
    if (!allowed.has(key)) continue;
    const safeValue = sanitizePrimitive(value);
    if (safeValue !== undefined) sanitized[key] = safeValue;
  }
  return sanitized;
}

export function sanitizeLogFields(
  fields: unknown,
): Record<string, string | number | boolean | null> {
  const record = expectRecord(fields, "logFields");
  const sanitized: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!LOG_FIELD_ALLOWLIST.has(key)) continue;
    const safeValue = sanitizePrimitive(value);
    if (safeValue !== undefined) sanitized[key] = safeValue;
  }
  return sanitized;
}

function sanitizePrimitive(
  value: unknown,
): string | number | boolean | null | undefined {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  }
  if (typeof value === "string" && SAFE_LOG_TOKEN.test(value)) return value;
  return undefined;
}

export function isAuditEventId(value: string): value is EntityId {
  try {
    validateEntityId(value);
    return true;
  } catch {
    return false;
  }
}
