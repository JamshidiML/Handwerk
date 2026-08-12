import type {
  AtomicImportResult,
  CommitImportRequest,
  CommercialPriceBookItem,
  ManualPriceBookItemInput,
  PreviewCsvImportRequest,
  PriceBookApplicationService,
  PriceBookImportPreview,
} from "@handwerk/pricebook/types";

export interface PriceBookEditorItemView {
  id: string;
  code: string;
  description: string;
  category: string;
  unit: CommercialPriceBookItem["unit"];
  unitPriceMinor: number;
  taxCategory: CommercialPriceBookItem["taxCategory"];
  active: boolean;
  approvalStatus: CommercialPriceBookItem["approvalStatus"];
  validFrom?: string;
  validTo?: string;
  synonyms: readonly string[];
  version: number;
}

export interface PriceBookFeaturePort {
  previewCsv(request: PreviewCsvImportRequest): Promise<PriceBookImportPreview>;
  commitCsv(request: CommitImportRequest): Promise<AtomicImportResult>;
  createManualDraft(
    input: ManualPriceBookItemInput,
  ): Promise<PriceBookEditorItemView>;
  listItems(): Promise<readonly PriceBookEditorItemView[]>;
}

export function toPriceBookEditorItemView(
  item: CommercialPriceBookItem,
): PriceBookEditorItemView {
  return {
    id: item.id,
    code: item.code,
    description: item.description,
    category: item.category,
    unit: item.unit,
    unitPriceMinor: item.unitPrice.minor,
    taxCategory: item.taxCategory,
    active: item.active,
    approvalStatus: item.approvalStatus,
    synonyms: [...item.synonyms],
    version: item.version,
    ...(item.validFrom ? { validFrom: item.validFrom } : {}),
    ...(item.validTo ? { validTo: item.validTo } : {}),
  };
}

export function createPriceBookFeaturePort(
  service: PriceBookApplicationService,
): PriceBookFeaturePort {
  return {
    previewCsv: async (request) => service.previewCsv(request),
    commitCsv: async (request) => service.commitCsv(request),
    createManualDraft: async (input) =>
      toPriceBookEditorItemView(service.createManualDraft(input)),
    listItems: async () =>
      service.editor.list().items.map(toPriceBookEditorItemView),
  };
}
