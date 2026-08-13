import type {
  EntityId,
  ExtractedFact,
  IsoDateTime,
  MappingProposal,
  Money,
  OfferLine,
  OrganisationId,
  PriceBook,
  PriceBookItem,
  TaxCategory,
  Unit,
} from "@handwerk/contracts";

export const PRICEBOOK_IMPORT_VERSION = "pricebook-import.v1" as const;

export type PriceBookApprovalStatus = "DRAFT" | "APPROVED";

export interface CommercialPriceBookItem extends PriceBookItem {
  approvalStatus: PriceBookApprovalStatus;
}

export type PriceBookImportField =
  | "code"
  | "description"
  | "category"
  | "unit"
  | "unitPrice"
  | "taxCategory"
  | "taxRate"
  | "validFrom"
  | "validTo"
  | "active"
  | "synonyms";

export type PriceBookColumnMapping = Partial<
  Record<PriceBookImportField, string>
>;

export type ImportErrorCode =
  | "CSV_PARSE_ERROR"
  | "EMPTY_FILE"
  | "MISSING_COLUMN"
  | "MISSING_VALUE"
  | "INVALID_CODE"
  | "INVALID_TEXT"
  | "CSV_INJECTION"
  | "INVALID_UNIT"
  | "INVALID_MONEY"
  | "INVALID_TAX"
  | "INVALID_DATE"
  | "INVALID_DATE_RANGE"
  | "INVALID_ACTIVE"
  | "DUPLICATE_CODE";

export interface ImportIssue {
  code: ImportErrorCode;
  message: string;
  field?: PriceBookImportField;
  sourceColumn?: string;
}

export interface PriceBookImportRow {
  rowNumber: number;
  source: Readonly<Record<string, string>>;
  item?: CommercialPriceBookItem;
  requestedActive?: boolean;
  issues: readonly ImportIssue[];
  duplicateOfRow?: number;
}

export interface PriceBookImportPreview {
  version: typeof PRICEBOOK_IMPORT_VERSION;
  previewId: string;
  organisationId: OrganisationId;
  priceBookId: EntityId;
  expectedPriceBookVersion: number;
  headers: readonly string[];
  delimiter: string;
  mapping: Readonly<PriceBookColumnMapping>;
  issues: readonly ImportIssue[];
  rows: readonly PriceBookImportRow[];
  validRowCount: number;
  errorRowCount: number;
  canCommit: boolean;
}

export interface PreviewCsvImportRequest {
  csv: string;
  organisationId: OrganisationId;
  priceBookId: EntityId;
  expectedPriceBookVersion: number;
  mapping: PriceBookColumnMapping;
  existingItems?: readonly CommercialPriceBookItem[];
  delimiter?: "," | ";" | "\t" | "|";
  now?: IsoDateTime;
}

export type AtomicImportResult =
  | {
      ok: true;
      previewId: string;
      importedCount: number;
      priceBookVersion: number;
      items: readonly CommercialPriceBookItem[];
    }
  | {
      ok: false;
      code: "PREVIEW_HAS_ERRORS" | "STALE_PREVIEW" | "VERSION_CONFLICT";
      message: string;
      importedCount: 0;
    };

export interface ManualPriceBookItemInput {
  code: string;
  description: string;
  category: string;
  unit: Unit;
  unitPriceMinor: number;
  taxCategory: TaxCategory;
  taxRateBasisPoints?: number;
  validFrom?: string;
  validTo?: string;
  synonyms?: readonly string[];
}

export interface ManualPriceBookItemDraft extends ManualPriceBookItemInput {
  id?: EntityId;
  version?: number;
  active: boolean;
  approvalStatus: PriceBookApprovalStatus;
}

export interface PriceBookStoreSnapshot {
  priceBook: PriceBook;
  items: readonly CommercialPriceBookItem[];
}

export interface PriceBookStore {
  read(
    organisationId: OrganisationId,
    priceBookId: EntityId,
  ): PriceBookStoreSnapshot | undefined;
  commitImport(
    preview: PriceBookImportPreview,
    items: readonly CommercialPriceBookItem[],
  ): AtomicImportResult;
  saveItem(
    organisationId: OrganisationId,
    priceBookId: EntityId,
    item: CommercialPriceBookItem,
    expectedItemVersion?: number,
  ): CommercialPriceBookItem;
}

export interface CommitImportRequest {
  preview: PriceBookImportPreview;
  approvalConfirmed: boolean;
}

export interface DeterministicMappingRule {
  organisationId: OrganisationId;
  factKey: string;
  itemCode: string;
  unit: Unit;
}

export interface TenantSynonymRule {
  organisationId: OrganisationId;
  factKey: string;
  term: string;
  itemCode: string;
  unit: Unit;
}

export interface ProviderMappingSuggestion {
  extractedFactId: EntityId;
  suggestedItemCode: string;
  confidence: number;
}

export interface MappingContext {
  organisationId: OrganisationId;
  priceBook: PriceBook;
  items: readonly CommercialPriceBookItem[];
  rules: readonly DeterministicMappingRule[];
  synonymRules?: readonly TenantSynonymRule[];
  providerSuggestions?: readonly ProviderMappingSuggestion[];
  effectiveOn: string;
  now: IsoDateTime;
}

export interface SupportedMapping {
  proposal: MappingProposal & { status: "SUPPORTED" };
  line: OfferLine;
}

export interface UnpricedMapping {
  proposal: MappingProposal & {
    status: "UNMATCHED" | "NEEDS_CLARIFICATION" | "REJECTED";
  };
  line?: never;
}

export type FactMappingResult = SupportedMapping | UnpricedMapping;

export interface MappingBatchResult {
  results: readonly FactMappingResult[];
  lines: readonly OfferLine[];
}

export interface PriceBookEditorPort {
  list(): PriceBookStoreSnapshot;
  createDraft(input: ManualPriceBookItemInput): CommercialPriceBookItem;
}

export interface PriceBookApplicationService {
  previewCsv(request: PreviewCsvImportRequest): PriceBookImportPreview;
  commitCsv(request: CommitImportRequest): AtomicImportResult;
  mapFacts(
    facts: readonly ExtractedFact[],
    context: MappingContext,
  ): MappingBatchResult;
  readonly editor: PriceBookEditorPort;
  createManualDraft(input: ManualPriceBookItemInput): CommercialPriceBookItem;
}

export interface CalculatedCommercialAmounts {
  netTotal: Money;
  taxTotal: Money;
  grossTotal: Money;
  calculation: string;
}

export type PriceBookFact = ExtractedFact;
