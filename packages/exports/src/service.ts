import { createHash } from "node:crypto";
import type { EntityId, ExportArtifact } from "@handwerk/contracts";
import { renderOfferCsv } from "./csv";
import { renderOfferPdf } from "./pdf";
import type {
  ApprovedOfferExportInput,
  ApprovedOfferExportResult,
  ExportArtifactStore,
} from "./types";
import { buildApprovedOfferViewModel } from "./view-model";

function checksumSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function safeFilenameToken(value: string): string {
  const token = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return token || "synthetisches-angebot";
}

function artifact(
  input: ApprovedOfferExportInput,
  id: EntityId,
  kind: "PDF" | "CSV",
  filename: string,
  mediaType: string,
  bytes: Uint8Array,
): ExportArtifact {
  return {
    id,
    organisationId: input.draft.organisationId,
    offerDraftId: input.draft.id,
    revision: input.revision.revision,
    kind,
    filename,
    mediaType,
    checksumSha256: checksumSha256(bytes),
    sizeBytes: bytes.byteLength,
    createdAt: input.issuedAt,
    updatedAt: input.issuedAt,
    version: 1,
  };
}

export class ApprovedOfferExportService {
  constructor(private readonly store: ExportArtifactStore) {}

  async create(
    input: ApprovedOfferExportInput,
  ): Promise<ApprovedOfferExportResult> {
    const model = buildApprovedOfferViewModel(input);
    const [pdfBytes, csvBytes] = await Promise.all([
      renderOfferPdf(model),
      Promise.resolve(renderOfferCsv(model)),
    ]);
    const token = safeFilenameToken(model.offerNumber);
    const pdfArtifact = artifact(
      input,
      input.artifactIds.pdf,
      "PDF",
      `Angebot-${token}.pdf`,
      "application/pdf",
      pdfBytes,
    );
    const csvArtifact = artifact(
      input,
      input.artifactIds.csv,
      "CSV",
      `Angebot-${token}.csv`,
      "text/csv;charset=utf-8",
      csvBytes,
    );

    await this.store.saveAll([pdfArtifact, csvArtifact]);
    return {
      pdf: { artifact: pdfArtifact, bytes: pdfBytes },
      csv: { artifact: csvArtifact, bytes: csvBytes },
    };
  }
}

export class InMemoryExportArtifactStore implements ExportArtifactStore {
  private readonly artifacts = new Map<EntityId, ExportArtifact>();

  async saveAll(artifacts: readonly ExportArtifact[]): Promise<void> {
    const ids = new Set<EntityId>();
    for (const item of artifacts) {
      if (ids.has(item.id) || this.artifacts.has(item.id)) {
        throw new Error(
          `Export-Metadaten mit ID ${item.id} existieren bereits.`,
        );
      }
      ids.add(item.id);
    }
    for (const item of artifacts) this.artifacts.set(item.id, { ...item });
  }

  async listByDraft(
    offerDraftId: EntityId,
  ): Promise<readonly ExportArtifact[]> {
    return [...this.artifacts.values()]
      .filter((item) => item.offerDraftId === offerDraftId)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((item) => ({ ...item }));
  }
}
