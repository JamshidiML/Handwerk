import type {
  AuditEvent,
  ClarificationQuestion,
  Customer,
  DeletionRequest,
  EntityId,
  EvidenceAsset,
  HumanApproval,
  IsoDateTime,
  Measurement,
  OfferDraft,
  OfferDraftRevision,
  OrganisationId,
  PhotoEvidence,
  Project,
  SiteVisit,
  TranscriptSegment,
  VoiceNote,
} from "@handwerk/contracts";

import { AuditService, sanitizeAuditMetadata } from "./audit";
import {
  assertCapability,
  assertTenantResource,
  type TenantAuthorizationContext,
} from "./context";
import { failedSafe, forbiddenOrNotFound, validationFailed } from "./errors";
import { buildSafeDownloadHeaders } from "./http-security";
import {
  assertRequestSize,
  enforceRateLimit,
  type RateLimiter,
} from "./limits";
import {
  assertAllowedKeys,
  constantTimeEqual,
  expectRecord,
  readRequiredBoolean,
  readRequiredString,
  validateEntityId,
} from "./validation";

export const DELETION_CONFIRMATION_PHRASE = "PROJEKT LÖSCHEN";

export interface ProjectDataAggregate {
  project: Project;
  customer: Customer;
  siteVisits: readonly SiteVisit[];
  evidence: readonly EvidenceAsset[];
  voiceNotes: readonly VoiceNote[];
  transcript: readonly TranscriptSegment[];
  photos: readonly PhotoEvidence[];
  measurements: readonly Measurement[];
  questions: readonly ClarificationQuestion[];
  draft?: OfferDraft;
  revision?: OfferDraftRevision;
  approval?: HumanApproval;
  audit: readonly AuditEvent[];
}

export interface PrivacyStore {
  loadProjectDataForOrganisation(
    projectId: EntityId,
    organisationId: OrganisationId,
  ): Promise<ProjectDataAggregate | null>;
  createDeletionRequest(request: DeletionRequest): Promise<void>;
  findDeletionRequestForOrganisation(
    requestId: EntityId,
    organisationId: OrganisationId,
  ): Promise<DeletionRequest | null>;
  completeDemoDeletion(input: {
    projectId: EntityId;
    organisationId: OrganisationId;
    deletionRequestId: EntityId;
    completedAt: IsoDateTime;
  }): Promise<DeletionRequest>;
}

export interface ProjectDataDownload {
  body: Uint8Array;
  checksumSha256: string;
  filename: string;
  headers: Readonly<Record<string, string>>;
  mediaType: "application/json";
  sizeBytes: number;
}

export interface PrivacyServiceDependencies {
  store: PrivacyStore;
  audit: AuditService;
  rateLimiter: RateLimiter;
  now: () => IsoDateTime;
  createId: () => string;
}

export class ProjectPrivacyService {
  readonly #dependencies: PrivacyServiceDependencies;

  constructor(dependencies: PrivacyServiceDependencies) {
    this.#dependencies = dependencies;
  }

  async exportProjectData(
    context: TenantAuthorizationContext,
    input: unknown,
  ): Promise<ProjectDataDownload> {
    assertCapability(context, "PROJECT_EXPORT");
    enforceRateLimit(
      "PROJECT_DATA_EXPORT",
      context,
      this.#dependencies.rateLimiter,
    );
    const { projectId } = parseProjectInput(input);
    const aggregate = await this.#loadAggregate(context, projectId);
    const exportDocument = createAllowlistedExport(
      aggregate,
      this.#dependencies.now(),
    );
    const body = new TextEncoder().encode(
      `${JSON.stringify(exportDocument, null, 2)}\n`,
    );
    assertRequestSize("PROJECT_DATA_EXPORT", body.byteLength);
    const filename = `handwerk-projektdaten-${projectId}.json`;
    const checksumSha256 = await sha256Hex(body);

    await this.#dependencies.audit.record({
      context,
      project: aggregate.project,
      type: "DATA_EXPORT_REQUESTED",
      metadata: {
        projectId,
        format: "JSON",
        sizeBytes: body.byteLength,
        outcome: "SUCCEEDED",
      },
    });

    return {
      body,
      checksumSha256,
      filename,
      headers: buildSafeDownloadHeaders({
        filename,
        mediaType: "application/json",
        sizeBytes: body.byteLength,
      }),
      mediaType: "application/json",
      sizeBytes: body.byteLength,
    };
  }

  async requestProjectDeletion(
    context: TenantAuthorizationContext,
    input: unknown,
  ): Promise<DeletionRequest> {
    assertCapability(context, "PROJECT_DELETION_REQUEST");
    enforceRateLimit("DELETION", context, this.#dependencies.rateLimiter);
    const parsed = parseDeletionRequestInput(input);
    const aggregate = await this.#loadAggregate(context, parsed.projectId);
    const now = this.#dependencies.now();
    const request: DeletionRequest = {
      id: validateEntityId(this.#dependencies.createId(), "deletionRequestId"),
      organisationId: context.organisationId,
      projectId: aggregate.project.id,
      requestedByUserId: context.actorUserId,
      status: "CONFIRMED",
      consequenceAcknowledged: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    await this.#dependencies.store.createDeletionRequest(request);
    await this.#dependencies.audit.record({
      context,
      project: aggregate.project,
      type: "DELETION_REQUESTED",
      metadata: {
        deletionRequestId: request.id,
        status: request.status,
        outcome: "SUCCEEDED",
      },
    });
    return request;
  }

  async completeDemoProjectDeletion(
    context: TenantAuthorizationContext,
    input: unknown,
  ): Promise<DeletionRequest> {
    assertCapability(context, "PROJECT_DEMO_DELETE");
    if (!context.demoMode) {
      failedSafe("Direktes Löschen ist ausschließlich im Demo-Modus erlaubt.");
    }
    enforceRateLimit("DELETION", context, this.#dependencies.rateLimiter);
    const parsed = parseDemoDeletionInput(input);
    const aggregate = await this.#loadAggregate(context, parsed.projectId);
    const request =
      await this.#dependencies.store.findDeletionRequestForOrganisation(
        parsed.deletionRequestId,
        context.organisationId,
      );
    assertTenantResource(context, request);
    if (
      request.projectId !== aggregate.project.id ||
      request.requestedByUserId !== context.actorUserId ||
      request.status !== "CONFIRMED" ||
      !request.consequenceAcknowledged
    ) {
      forbiddenOrNotFound();
    }

    const completed = await this.#dependencies.store.completeDemoDeletion({
      projectId: aggregate.project.id,
      organisationId: context.organisationId,
      deletionRequestId: request.id,
      completedAt: this.#dependencies.now(),
    });
    assertTenantResource(context, completed);
    if (completed.status !== "COMPLETED") {
      failedSafe("Der Demo-Löschvorgang wurde nicht vollständig bestätigt.");
    }
    await this.#dependencies.audit.record({
      context,
      project: aggregate.project,
      type: "DEMO_DATA_DELETED",
      metadata: {
        deletionRequestId: completed.id,
        status: completed.status,
        outcome: "SUCCEEDED",
      },
    });
    return completed;
  }

  async #loadAggregate(
    context: TenantAuthorizationContext,
    projectId: EntityId,
  ): Promise<ProjectDataAggregate> {
    const aggregate =
      await this.#dependencies.store.loadProjectDataForOrganisation(
        projectId,
        context.organisationId,
      );
    if (!aggregate) forbiddenOrNotFound();
    assertAggregateScope(context, aggregate);
    return aggregate;
  }
}

function parseProjectInput(input: unknown): { projectId: EntityId } {
  const record = expectRecord(input);
  assertAllowedKeys(record, ["projectId"]);
  return {
    projectId: validateEntityId(
      readRequiredString(record, "projectId", { maxLength: 128 }),
    ),
  };
}

function parseDeletionRequestInput(input: unknown): { projectId: EntityId } {
  const record = expectRecord(input);
  assertAllowedKeys(record, [
    "projectId",
    "consequenceAcknowledged",
    "confirmationPhrase",
  ]);
  const consequenceAcknowledged = readRequiredBoolean(
    record,
    "consequenceAcknowledged",
  );
  const confirmationPhrase = readRequiredString(record, "confirmationPhrase", {
    maxLength: 40,
  });
  if (
    !consequenceAcknowledged ||
    !constantTimeEqual(confirmationPhrase, DELETION_CONFIRMATION_PHRASE)
  ) {
    validationFailed({
      confirmationPhrase: ["Die Löschbestätigung stimmt nicht überein."],
    });
  }
  return {
    projectId: validateEntityId(
      readRequiredString(record, "projectId", { maxLength: 128 }),
    ),
  };
}

function parseDemoDeletionInput(input: unknown): {
  projectId: EntityId;
  deletionRequestId: EntityId;
} {
  const record = expectRecord(input);
  assertAllowedKeys(record, [
    "projectId",
    "deletionRequestId",
    "confirmationPhrase",
  ]);
  const confirmationPhrase = readRequiredString(record, "confirmationPhrase", {
    maxLength: 40,
  });
  if (!constantTimeEqual(confirmationPhrase, DELETION_CONFIRMATION_PHRASE)) {
    validationFailed({
      confirmationPhrase: ["Die Löschbestätigung stimmt nicht überein."],
    });
  }
  return {
    projectId: validateEntityId(
      readRequiredString(record, "projectId", { maxLength: 128 }),
    ),
    deletionRequestId: validateEntityId(
      readRequiredString(record, "deletionRequestId", { maxLength: 128 }),
      "deletionRequestId",
    ),
  };
}

function assertAggregateScope(
  context: TenantAuthorizationContext,
  aggregate: ProjectDataAggregate,
): void {
  assertTenantResource(context, aggregate.project);
  assertTenantResource(context, aggregate.customer);
  if (aggregate.customer.id !== aggregate.project.customerId)
    forbiddenOrNotFound();

  for (const collection of [
    aggregate.siteVisits,
    aggregate.evidence,
    aggregate.voiceNotes,
    aggregate.transcript,
    aggregate.photos,
    aggregate.measurements,
    aggregate.questions,
    aggregate.audit,
  ]) {
    for (const item of collection) assertTenantResource(context, item);
  }
  if (aggregate.draft) {
    assertTenantResource(context, aggregate.draft);
    if (aggregate.draft.projectId !== aggregate.project.id)
      forbiddenOrNotFound();
  }
  if (aggregate.revision) {
    assertTenantResource(context, aggregate.revision);
    if (
      !aggregate.draft ||
      aggregate.revision.offerDraftId !== aggregate.draft.id
    ) {
      forbiddenOrNotFound();
    }
    for (const line of aggregate.revision.lines) {
      if (line.organisationId !== context.organisationId) forbiddenOrNotFound();
      assertCitationsScoped(context, line.citations);
    }
    for (const item of [
      ...aggregate.revision.excludedItems,
      ...aggregate.revision.unmatchedItems,
    ]) {
      assertCitationsScoped(context, item.citations);
    }
  }
  if (aggregate.approval) {
    assertTenantResource(context, aggregate.approval);
    if (
      !aggregate.draft ||
      aggregate.approval.offerDraftId !== aggregate.draft.id
    ) {
      forbiddenOrNotFound();
    }
  }

  const visitIds = new Set(aggregate.siteVisits.map((visit) => visit.id));
  const evidenceById = new Map(
    aggregate.evidence.map((evidence) => [evidence.id, evidence]),
  );
  const voiceNotesById = new Map(
    aggregate.voiceNotes.map((voiceNote) => [voiceNote.id, voiceNote]),
  );
  for (const visit of aggregate.siteVisits) {
    if (visit.projectId !== aggregate.project.id) forbiddenOrNotFound();
  }
  for (const evidence of aggregate.evidence) {
    if (!visitIds.has(evidence.siteVisitId)) forbiddenOrNotFound();
  }
  for (const voiceNote of aggregate.voiceNotes) {
    if (!visitIds.has(voiceNote.siteVisitId)) forbiddenOrNotFound();
    if (voiceNote.evidenceAssetId) {
      const evidence = evidenceById.get(voiceNote.evidenceAssetId);
      if (
        !evidence ||
        evidence.kind !== "AUDIO" ||
        evidence.siteVisitId !== voiceNote.siteVisitId
      ) {
        forbiddenOrNotFound();
      }
    }
  }
  for (const transcript of aggregate.transcript) {
    if (!voiceNotesById.has(transcript.voiceNoteId)) forbiddenOrNotFound();
  }
  for (const photo of aggregate.photos) {
    const evidence = evidenceById.get(photo.evidenceAssetId);
    if (!evidence || evidence.kind !== "PHOTO") forbiddenOrNotFound();
  }
  for (const measurement of aggregate.measurements) {
    if (!visitIds.has(measurement.siteVisitId)) forbiddenOrNotFound();
  }
  for (const question of aggregate.questions) {
    if (question.projectId !== aggregate.project.id) forbiddenOrNotFound();
    assertCitationsScoped(context, question.sourceContext);
  }
  for (const event of aggregate.audit) {
    if (event.projectId !== aggregate.project.id) forbiddenOrNotFound();
  }
}

function assertCitationsScoped(
  context: TenantAuthorizationContext,
  citations: readonly { organisationId: OrganisationId }[],
): void {
  for (const citation of citations) {
    if (citation.organisationId !== context.organisationId) {
      forbiddenOrNotFound();
    }
  }
}

function createAllowlistedExport(
  aggregate: ProjectDataAggregate,
  exportedAt: IsoDateTime,
): unknown {
  return {
    schemaVersion: "handwerk.project-data-export.v1",
    exportedAt,
    project: {
      id: aggregate.project.id,
      name: aggregate.project.name,
      locationLabel: aggregate.project.locationLabel,
      synthetic: aggregate.project.synthetic,
      createdAt: aggregate.project.createdAt,
      updatedAt: aggregate.project.updatedAt,
    },
    customer: {
      id: aggregate.customer.id,
      displayName: aggregate.customer.displayName,
      synthetic: aggregate.customer.synthetic,
    },
    siteVisits: aggregate.siteVisits.map((visit) => ({
      id: visit.id,
      status: visit.status,
      startedAt: visit.startedAt,
      completedAt: visit.completedAt,
    })),
    evidence: aggregate.evidence.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      filename: asset.filename,
      mediaType: asset.mediaType,
      sizeBytes: asset.sizeBytes,
      checksumSha256: asset.checksumSha256,
      authority: asset.authority,
      synthetic: asset.synthetic,
    })),
    transcript: aggregate.transcript.map((segment) => ({
      id: segment.id,
      startMs: segment.startMs,
      endMs: segment.endMs,
      text: segment.text,
      language: segment.language,
      humanEdited: segment.humanEdited,
    })),
    photos: aggregate.photos.map((photo) => ({
      id: photo.id,
      evidenceAssetId: photo.evidenceAssetId,
      caption: photo.caption,
      authority: photo.authority,
    })),
    measurements: aggregate.measurements.map((measurement) => ({
      id: measurement.id,
      label: measurement.label,
      context: measurement.context,
      quantity: measurement.quantity,
      authority: measurement.authority,
    })),
    questions: aggregate.questions.map((question) => ({
      id: question.id,
      key: question.key,
      prompt: question.prompt,
      rationale: question.rationale,
      severity: question.severity,
      blocking: question.blocking,
      status: question.status,
    })),
    draft: aggregate.draft,
    revision: aggregate.revision,
    approval: aggregate.approval,
    audit: aggregate.audit.map((event) => ({
      id: event.id,
      type: event.type,
      occurredAt: event.occurredAt,
      metadata: sanitizeAuditMetadata(event.type, event.metadata),
      correlationId: event.correlationId,
    })),
  };
}

async function sha256Hex(value: Uint8Array): Promise<string> {
  const digestInput = new Uint8Array(value.byteLength);
  digestInput.set(value);
  const digest = await crypto.subtle.digest("SHA-256", digestInput.buffer);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
