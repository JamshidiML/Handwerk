import { commitCsvImport, previewCsvImport } from "./csv-import";
import { PriceBookEditorService, type PriceBookEditorOptions } from "./editor";
import { mapFactsToApprovedPriceBook } from "./mapping";
import type { PriceBookApplicationService, PriceBookStore } from "./types";

export function createPriceBookApplicationService(
  store: PriceBookStore,
  editor: {
    organisationId: ConstructorParameters<typeof PriceBookEditorService>[1];
    priceBookId: ConstructorParameters<typeof PriceBookEditorService>[2];
    options?: PriceBookEditorOptions;
  },
): PriceBookApplicationService {
  const editorService = new PriceBookEditorService(
    store,
    editor.organisationId,
    editor.priceBookId,
    editor.options,
  );
  return {
    previewCsv: previewCsvImport,
    commitCsv: (request) => commitCsvImport(request, store),
    mapFacts: mapFactsToApprovedPriceBook,
    editor: editorService,
    createManualDraft: (input) => editorService.createDraft(input),
  };
}
