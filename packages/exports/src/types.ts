import type {
  EntityId,
  ExportArtifact,
  HumanApproval,
  IsoDateTime,
  OfferDraft,
  OfferDraftRevision,
} from "@handwerk/contracts";

export const APPROVAL_CONFIRMATION_TEXT =
  "Ich habe Umfang, Mengen, Preise und Ausschlüsse der aktuellen Revision geprüft.";

export type ExportBlockerCode =
  | "APPROVAL_REQUIRED"
  | "APPROVAL_INVALIDATED"
  | "STALE_APPROVAL"
  | "UNRESOLVED_CRITICAL_QUESTIONS"
  | "NO_PRICED_LINES"
  | "INVALID_REVISION"
  | "INVALID_COMMERCIAL_TOTALS"
  | "MISSING_LINE_EVIDENCE";

export interface ExportBlocker {
  code: ExportBlockerCode;
  message: string;
}

export type ExportDecision =
  | { allowed: true; revision: number }
  | { allowed: false; blockers: readonly ExportBlocker[] };

export interface ExportAuthorizationInput {
  draft: OfferDraft;
  revision: OfferDraftRevision;
  approval?: HumanApproval;
  unresolvedCriticalQuestionIds: readonly EntityId[];
}

export interface ApprovalInput {
  draft: OfferDraft;
  revision: OfferDraftRevision;
  unresolvedCriticalQuestionIds: readonly EntityId[];
  confirmed: boolean;
  approvalId: EntityId;
  approvedByUserId: HumanApproval["approvedByUserId"];
  approvedAt: IsoDateTime;
}

export interface ApprovedRevisionResult {
  draft: OfferDraft;
  approval: HumanApproval;
}

export interface QuantityEditInput {
  draft: OfferDraft;
  revision: OfferDraftRevision;
  approval?: HumanApproval;
  lineId: EntityId;
  quantityValue: string;
  revisionId: EntityId;
  createdByUserId: OfferDraftRevision["createdByUserId"];
  editedAt: IsoDateTime;
}

export interface QuantityEditResult {
  changed: boolean;
  draft: OfferDraft;
  revision: OfferDraftRevision;
  invalidatedApproval?: HumanApproval;
  summary: RevisionSummary;
}

export type CommercialChangeKind =
  | "LINE_ADDED"
  | "LINE_REMOVED"
  | "QUANTITY_CHANGED"
  | "PRICE_CHANGED"
  | "TAX_CHANGED"
  | "DESCRIPTION_CHANGED"
  | "EXCLUSION_CHANGED"
  | "UNMATCHED_CHANGED";

export interface CommercialChange {
  kind: CommercialChangeKind;
  lineId?: EntityId;
  itemCode?: string;
  summary: string;
}

export interface RevisionSummary {
  fromRevision: number;
  toRevision: number;
  hasCommercialChanges: boolean;
  changes: readonly CommercialChange[];
  netDeltaMinor: number;
  taxDeltaMinor: number;
  grossDeltaMinor: number;
}

export interface ApprovedOfferExportInput extends ExportAuthorizationInput {
  organisationName: string;
  recipientName: string;
  projectName: string;
  projectLocation?: string;
  offerNumber: string;
  issuedAt: IsoDateTime;
  notes?: readonly string[];
  synthetic: true;
  artifactIds: {
    pdf: EntityId;
    csv: EntityId;
  };
}

export interface ExportLineView {
  itemCode: string;
  description: string;
  quantity: string;
  unit: string;
  unitPriceMinor: number;
  netMinor: number;
  taxRateBasisPoints: number;
  taxMinor: number;
  grossMinor: number;
}

export interface ExportUnpricedView {
  status: "EXCLUDED" | "UNMATCHED";
  key: string;
  reason: string;
}

export interface ApprovedOfferViewModel {
  contractVersion: "handwerk.vertical-slice.v1";
  synthetic: true;
  organisationName: string;
  recipientName: string;
  projectName: string;
  projectLocation?: string;
  offerNumber: string;
  issuedAt: string;
  revision: number;
  lines: readonly ExportLineView[];
  unpricedItems: readonly ExportUnpricedView[];
  netMinor: number;
  taxMinor: number;
  grossMinor: number;
  notes: readonly string[];
}

export interface GeneratedExport {
  artifact: ExportArtifact;
  bytes: Uint8Array;
}

export interface ApprovedOfferExportResult {
  pdf: GeneratedExport;
  csv: GeneratedExport;
}

export interface ExportArtifactStore {
  saveAll(artifacts: readonly ExportArtifact[]): Promise<void>;
  listByDraft(offerDraftId: EntityId): Promise<readonly ExportArtifact[]>;
}
