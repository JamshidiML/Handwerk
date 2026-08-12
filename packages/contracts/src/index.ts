export const CONTRACT_VERSION = "handwerk.vertical-slice.v1" as const;

export type Branded<T, Brand extends string> = T & { readonly __brand: Brand };
export type EntityId = Branded<string, "EntityId">;
export type OrganisationId = Branded<string, "OrganisationId">;
export type UserId = Branded<string, "UserId">;
export type IsoDateTime = Branded<string, "IsoDateTime">;
export type Currency = "EUR";
export type Unit = "M2" | "M" | "STK" | "STD" | "PAUSCHALE";
export type TaxCategory = "STANDARD_19" | "REDUCED_7" | "EXEMPT";
export type EvidenceAuthority = "AUTHORITATIVE" | "CONTEXT_ONLY";
export type ConfidenceRisk =
  | "CONFIRMED"
  | "LOW_RISK"
  | "NEEDS_REVIEW"
  | "BLOCKING";
export type HumanOrigin = "GENERATED" | "EDITED" | "CONFIRMED";
export type DraftState =
  | "CAPTURING"
  | "PROCESSING"
  | "NEEDS_CLARIFICATION"
  | "READY_FOR_REVIEW"
  | "APPROVED"
  | "EXPORTED";

export interface Money {
  currency: Currency;
  minor: number;
}

export interface Quantity {
  value: string;
  unit: Unit;
}

export interface TenantOwned {
  id: EntityId;
  organisationId: OrganisationId;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  version: number;
}

export interface Organisation extends Omit<TenantOwned, "organisationId"> {
  name: string;
  locale: "de-DE";
  currency: Currency;
}

export interface User {
  id: UserId;
  displayName: string;
  synthetic: true;
}

export interface Membership extends TenantOwned {
  userId: UserId;
  role: "OWNER" | "MEMBER" | "REVIEWER";
  active: boolean;
}

export interface Customer extends TenantOwned {
  displayName: string;
  synthetic: true;
}

export interface Project extends TenantOwned {
  customerId: EntityId;
  name: string;
  locationLabel?: string;
  synthetic: true;
}

export interface SiteVisit extends TenantOwned {
  projectId: EntityId;
  status: "OPEN" | "PROCESSING" | "COMPLETE";
  startedAt: IsoDateTime;
  completedAt?: IsoDateTime;
}

export interface EvidenceAsset extends TenantOwned {
  siteVisitId: EntityId;
  kind: "AUDIO" | "PHOTO";
  filename: string;
  mediaType: string;
  sizeBytes: number;
  checksumSha256: string;
  objectKey: string;
  authority: EvidenceAuthority;
  synthetic: true;
}

export interface VoiceNote extends TenantOwned {
  evidenceAssetId?: EntityId;
  siteVisitId: EntityId;
  transcriptFallback: boolean;
  transcriptStatus: "PENDING" | "READY" | "FAILED";
}

export interface TranscriptSegment extends TenantOwned {
  voiceNoteId: EntityId;
  startMs: number;
  endMs: number;
  text: string;
  language: string;
  humanEdited: boolean;
}

export interface PhotoEvidence extends TenantOwned {
  evidenceAssetId: EntityId;
  caption?: string;
  authority: "CONTEXT_ONLY";
}

export interface Measurement extends TenantOwned {
  siteVisitId: EntityId;
  label: string;
  context: string;
  quantity: Quantity;
  authority: "AUTHORITATIVE";
  confirmedByUserId: UserId;
}

export type SourceType =
  | "TRANSCRIPT_SEGMENT"
  | "EXPLICIT_MEASUREMENT"
  | "USER_ANSWER"
  | "COMPANY_RULE"
  | "PHOTO_CONTEXT";

export interface SourceCitation {
  id: EntityId;
  organisationId: OrganisationId;
  sourceType: SourceType;
  sourceEntityId: EntityId;
  locator: string;
  extractionVersion: string;
  explanation: string;
  authority: EvidenceAuthority;
}

export interface ExtractedFact {
  id: EntityId;
  organisationId: OrganisationId;
  extractionRunId: EntityId;
  key: string;
  value: string | number | boolean | null;
  unit?: Unit;
  status: "CONFIRMED" | "UNCERTAIN" | "UNKNOWN" | "CONTRADICTORY";
  citations: SourceCitation[];
}

export interface ExtractionRun extends TenantOwned {
  siteVisitId: EntityId;
  provider: "DETERMINISTIC_FAKE" | "LIVE_FLAGGED";
  model: string;
  promptVersion: string;
  schemaVersion: typeof CONTRACT_VERSION;
  status: "PENDING" | "SUCCEEDED" | "FAILED_SAFE";
  durationMs?: number;
  tokenCountPlaceholder?: number;
  costMinorPlaceholder?: number;
}

export interface PriceBook extends TenantOwned {
  name: string;
  active: boolean;
}

export interface PriceBookItem extends TenantOwned {
  priceBookId: EntityId;
  code: string;
  description: string;
  category: string;
  unit: Unit;
  unitPrice: Money;
  taxCategory: TaxCategory;
  taxRateBasisPoints: number;
  active: boolean;
  validFrom?: string;
  validTo?: string;
  synonyms: string[];
}

export interface MappingProposal extends TenantOwned {
  extractedFactId: EntityId;
  priceBookItemId?: EntityId;
  status: "SUPPORTED" | "UNMATCHED" | "NEEDS_CLARIFICATION" | "REJECTED";
  explanation: string;
  citations: SourceCitation[];
}

export interface ClarificationQuestion extends TenantOwned {
  projectId: EntityId;
  key: string;
  prompt: string;
  rationale: string;
  answerType: "BOOLEAN" | "SINGLE_CHOICE" | "TEXT" | "QUANTITY";
  options?: string[];
  severity: "INFO" | "WARNING" | "CRITICAL";
  blocking: boolean;
  status: "OPEN" | "ANSWERED" | "STALE";
  sourceContext: SourceCitation[];
}

export interface ClarificationAnswer extends TenantOwned {
  questionId: EntityId;
  answeredByUserId: UserId;
  value: string | boolean | Quantity;
}

export interface OfferLine {
  id: EntityId;
  organisationId: OrganisationId;
  priceBookItemId: EntityId;
  itemCode: string;
  description: string;
  quantity: Quantity;
  unitPrice: Money;
  netTotal: Money;
  taxCategory: TaxCategory;
  taxRateBasisPoints: number;
  taxTotal: Money;
  grossTotal: Money;
  calculation: string;
  citations: SourceCitation[];
  risk: ConfidenceRisk;
  origin: HumanOrigin;
}

export interface OfferDraft extends TenantOwned {
  projectId: EntityId;
  state: DraftState;
  currentRevision: number;
  approvedRevision?: number;
}

export interface OfferDraftRevision extends TenantOwned {
  offerDraftId: EntityId;
  revision: number;
  lines: OfferLine[];
  excludedItems: Array<{
    key: string;
    reason: string;
    citations: SourceCitation[];
  }>;
  unmatchedItems: Array<{
    key: string;
    reason: string;
    citations: SourceCitation[];
  }>;
  netTotal: Money;
  taxTotal: Money;
  grossTotal: Money;
  createdByUserId: UserId;
}

export interface HumanApproval extends TenantOwned {
  offerDraftId: EntityId;
  revision: number;
  approvedByUserId: UserId;
  confirmationText: string;
  approvedAt: IsoDateTime;
  invalidatedAt?: IsoDateTime;
  invalidationReason?: string;
}

export interface ExportArtifact extends TenantOwned {
  offerDraftId: EntityId;
  revision: number;
  kind: "PDF" | "CSV" | "PROJECT_DATA";
  filename: string;
  mediaType: string;
  checksumSha256: string;
  sizeBytes: number;
}

export type AuditEventType =
  | "CAPTURE_CREATED"
  | "EXTRACTION_COMPLETED"
  | "MAPPING_COMPLETED"
  | "CLARIFICATION_ANSWERED"
  | "DRAFT_EDITED"
  | "DRAFT_APPROVED"
  | "APPROVAL_INVALIDATED"
  | "EXPORT_CREATED"
  | "DATA_EXPORT_REQUESTED"
  | "DELETION_REQUESTED"
  | "DEMO_DATA_DELETED";

export interface AuditEvent extends TenantOwned {
  projectId: EntityId;
  actorUserId: UserId;
  type: AuditEventType;
  occurredAt: IsoDateTime;
  metadata: Record<string, string | number | boolean | null>;
  correlationId: string;
}

export interface DeletionRequest extends TenantOwned {
  projectId: EntityId;
  requestedByUserId: UserId;
  status: "REQUESTED" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  consequenceAcknowledged: boolean;
}

export interface ApiContext {
  requestId: string;
  actorUserId: UserId;
  organisationId: OrganisationId;
  demoMode: boolean;
}

export interface ApiError {
  code:
    | "AUTHENTICATION_REQUIRED"
    | "FORBIDDEN_OR_NOT_FOUND"
    | "VALIDATION_FAILED"
    | "VERSION_CONFLICT"
    | "UNRESOLVED_CLARIFICATION"
    | "APPROVAL_REQUIRED"
    | "UNSUPPORTED_UNIT"
    | "FAILED_SAFE";
  message: string;
  requestId: string;
  fieldErrors?: Record<string, string[]>;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export interface VerticalSliceSnapshot {
  organisation: Organisation;
  user: User;
  membership: Membership;
  customer: Customer;
  project: Project;
  siteVisit: SiteVisit;
  evidence: EvidenceAsset[];
  transcript: TranscriptSegment[];
  measurements: Measurement[];
  facts: ExtractedFact[];
  questions: ClarificationQuestion[];
  draft: OfferDraft;
  revision: OfferDraftRevision;
  approval?: HumanApproval;
  audit: AuditEvent[];
}

export interface HandwerkEvent<T extends AuditEventType = AuditEventType> {
  eventId: EntityId;
  eventVersion: 1;
  contractVersion: typeof CONTRACT_VERSION;
  type: T;
  organisationId: OrganisationId;
  projectId: EntityId;
  actorUserId: UserId;
  occurredAt: IsoDateTime;
  correlationId: string;
  payload: Record<string, string | number | boolean | null>;
}

export const CANONICAL_IDS = {
  organisation: "org-westblick" as OrganisationId,
  user: "user-demo-mohsen" as UserId,
  customer: "customer-anna-becker" as EntityId,
  project: "project-wohnzimmer-bochum" as EntityId,
  siteVisit: "visit-wohnzimmer-001" as EntityId,
} as const;

export const CANONICAL_QUESTIONS = {
  ceiling: "Soll die Decke mitgestrichen werden?",
  substrate: "Ist der Untergrund tragfähig und ohne zusätzliche Ausbesserung?",
} as const;

export const VALID_DRAFT_TRANSITIONS: Readonly<
  Record<DraftState, readonly DraftState[]>
> = {
  CAPTURING: ["PROCESSING"],
  PROCESSING: ["NEEDS_CLARIFICATION", "READY_FOR_REVIEW"],
  NEEDS_CLARIFICATION: ["READY_FOR_REVIEW"],
  READY_FOR_REVIEW: ["APPROVED"],
  APPROVED: ["READY_FOR_REVIEW", "EXPORTED"],
  EXPORTED: ["READY_FOR_REVIEW"],
};
