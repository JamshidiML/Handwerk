import { CONTRACT_VERSION } from "@handwerk/contracts";
import { assertExportAllowed } from "./review";
import type {
  ApprovedOfferExportInput,
  ApprovedOfferViewModel,
  ExportUnpricedView,
} from "./types";

function limitText(value: string, maxLength: number): string {
  return (
    value
      // eslint-disable-next-line no-control-regex -- exported text never carries C0 controls.
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength)
  );
}

function requireText(value: string, label: string, maxLength: number): string {
  const limited = limitText(value, maxLength);
  if (!limited) {
    throw new TypeError(`${label} darf nicht leer sein.`);
  }
  return limited;
}

export function buildApprovedOfferViewModel(
  input: ApprovedOfferExportInput,
): ApprovedOfferViewModel {
  assertExportAllowed(input);

  const unpricedItems: ExportUnpricedView[] = [
    ...input.revision.excludedItems.map((item) => ({
      status: "EXCLUDED" as const,
      key: requireText(item.key, "Ausschluss", 120),
      reason: requireText(item.reason, "Ausschlussgrund", 600),
    })),
    ...input.revision.unmatchedItems.map((item) => ({
      status: "UNMATCHED" as const,
      key: requireText(item.key, "Nicht zugeordnete Leistung", 120),
      reason: requireText(item.reason, "Zuordnungsgrund", 600),
    })),
  ];

  const base: ApprovedOfferViewModel = {
    contractVersion: CONTRACT_VERSION,
    synthetic: true,
    organisationName: requireText(input.organisationName, "Firmenname", 120),
    recipientName: requireText(input.recipientName, "Empfänger", 120),
    projectName: requireText(input.projectName, "Projektname", 180),
    offerNumber: requireText(input.offerNumber, "Angebotsnummer", 80),
    issuedAt: input.issuedAt,
    revision: input.revision.revision,
    lines: input.revision.lines.map((line) => ({
      itemCode: requireText(line.itemCode, "Artikelnummer", 80),
      description: requireText(
        line.description,
        "Leistungsbeschreibung",
        1_200,
      ),
      quantity: line.quantity.value,
      unit: line.quantity.unit,
      unitPriceMinor: line.unitPrice.minor,
      netMinor: line.netTotal.minor,
      taxRateBasisPoints: line.taxRateBasisPoints,
      taxMinor: line.taxTotal.minor,
      grossMinor: line.grossTotal.minor,
    })),
    unpricedItems,
    netMinor: input.revision.netTotal.minor,
    taxMinor: input.revision.taxTotal.minor,
    grossMinor: input.revision.grossTotal.minor,
    notes: (input.notes ?? [])
      .slice(0, 12)
      .map((note) => limitText(note, 1_000)),
  };
  const projectLocation = input.projectLocation
    ? limitText(input.projectLocation, 160)
    : "";
  return projectLocation ? { ...base, projectLocation } : base;
}
