import type { EntityId, OrganisationId, PriceBook } from "@handwerk/contracts";
import type {
  AtomicImportResult,
  CommercialPriceBookItem,
  PriceBookImportPreview,
  PriceBookStore,
  PriceBookStoreSnapshot,
} from "./types";
import { normalizeCode } from "./validation";

function cloneItem(item: CommercialPriceBookItem): CommercialPriceBookItem {
  return {
    ...item,
    unitPrice: { ...item.unitPrice },
    synonyms: [...item.synonyms],
  };
}

function cloneSnapshot(
  snapshot: PriceBookStoreSnapshot,
): PriceBookStoreSnapshot {
  return {
    priceBook: { ...snapshot.priceBook },
    items: snapshot.items.map(cloneItem),
  };
}

function key(organisationId: OrganisationId, priceBookId: EntityId): string {
  return `${organisationId}\u001f${priceBookId}`;
}

export class PriceBookVersionConflictError extends Error {
  constructor(message = "Preisposition wurde zwischenzeitlich geändert.") {
    super(message);
    this.name = "PriceBookVersionConflictError";
  }
}

export class InMemoryPriceBookStore implements PriceBookStore {
  readonly #snapshots = new Map<string, PriceBookStoreSnapshot>();

  constructor(initial: readonly PriceBookStoreSnapshot[] = []) {
    for (const snapshot of initial) {
      this.#assertSnapshot(snapshot.priceBook, snapshot.items);
      this.#snapshots.set(
        key(snapshot.priceBook.organisationId, snapshot.priceBook.id),
        cloneSnapshot(snapshot),
      );
    }
  }

  read(
    organisationId: OrganisationId,
    priceBookId: EntityId,
  ): PriceBookStoreSnapshot | undefined {
    const snapshot = this.#snapshots.get(key(organisationId, priceBookId));
    return snapshot ? cloneSnapshot(snapshot) : undefined;
  }

  commitImport(
    preview: PriceBookImportPreview,
    items: readonly CommercialPriceBookItem[],
  ): AtomicImportResult {
    if (!preview.canCommit || items.length !== preview.rows.length) {
      return {
        ok: false,
        code: "PREVIEW_HAS_ERRORS",
        message: "Ungültige Importvorschau. Es wurde nichts gespeichert.",
        importedCount: 0,
      };
    }
    const snapshotKey = key(preview.organisationId, preview.priceBookId);
    const current = this.#snapshots.get(snapshotKey);
    if (
      !current ||
      current.priceBook.version !== preview.expectedPriceBookVersion
    ) {
      return {
        ok: false,
        code: "VERSION_CONFLICT",
        message:
          "Preisbuch wurde zwischenzeitlich geändert. Import erneut prüfen.",
        importedCount: 0,
      };
    }

    const existingCodes = new Set(
      current.items.map((item) => normalizeCode(item.code)),
    );
    const importedCodes = new Set<string>();
    for (const item of items) {
      const itemCode = normalizeCode(item.code);
      if (
        item.organisationId !== preview.organisationId ||
        item.priceBookId !== preview.priceBookId ||
        item.approvalStatus !== "APPROVED" ||
        existingCodes.has(itemCode) ||
        importedCodes.has(itemCode)
      ) {
        return {
          ok: false,
          code: "STALE_PREVIEW",
          message:
            "Importdaten sind nicht mehr konsistent. Es wurde nichts gespeichert.",
          importedCount: 0,
        };
      }
      importedCodes.add(itemCode);
    }

    const updatedBook: PriceBook = {
      ...current.priceBook,
      version: current.priceBook.version + 1,
      updatedAt: items[0]?.updatedAt ?? current.priceBook.updatedAt,
    };
    const next: PriceBookStoreSnapshot = {
      priceBook: updatedBook,
      items: [...current.items.map(cloneItem), ...items.map(cloneItem)],
    };
    this.#assertSnapshot(next.priceBook, next.items);
    this.#snapshots.set(snapshotKey, next);
    return {
      ok: true,
      previewId: preview.previewId,
      importedCount: items.length,
      priceBookVersion: updatedBook.version,
      items: items.map(cloneItem),
    };
  }

  saveItem(
    organisationId: OrganisationId,
    priceBookId: EntityId,
    item: CommercialPriceBookItem,
    expectedItemVersion?: number,
  ): CommercialPriceBookItem {
    const snapshotKey = key(organisationId, priceBookId);
    const current = this.#snapshots.get(snapshotKey);
    if (!current)
      throw new PriceBookVersionConflictError("Preisbuch nicht gefunden.");
    if (
      item.organisationId !== organisationId ||
      item.priceBookId !== priceBookId ||
      (item.active && item.approvalStatus !== "APPROVED")
    ) {
      throw new PriceBookVersionConflictError(
        "Mandanten- oder Freigaberegel verletzt.",
      );
    }

    const index = current.items.findIndex(
      (candidate) => candidate.id === item.id,
    );
    const existing = index >= 0 ? current.items[index] : undefined;
    if (existing && expectedItemVersion !== existing.version) {
      throw new PriceBookVersionConflictError();
    }
    if (!existing && expectedItemVersion !== undefined) {
      throw new PriceBookVersionConflictError();
    }
    if (
      current.items.some(
        (candidate) =>
          candidate.id !== item.id &&
          normalizeCode(candidate.code) === normalizeCode(item.code),
      )
    ) {
      throw new PriceBookVersionConflictError(
        "Positionscode existiert bereits.",
      );
    }

    const saved = cloneItem(item);
    const items = current.items.map(cloneItem);
    if (index >= 0) items[index] = saved;
    else items.push(saved);
    const next = {
      priceBook: {
        ...current.priceBook,
        version: current.priceBook.version + 1,
        updatedAt: item.updatedAt,
      },
      items,
    };
    this.#assertSnapshot(next.priceBook, next.items);
    this.#snapshots.set(snapshotKey, next);
    return cloneItem(saved);
  }

  #assertSnapshot(
    priceBook: PriceBook,
    items: readonly CommercialPriceBookItem[],
  ): void {
    const codes = new Set<string>();
    for (const item of items) {
      const code = normalizeCode(item.code);
      if (
        item.organisationId !== priceBook.organisationId ||
        item.priceBookId !== priceBook.id ||
        codes.has(code) ||
        (item.active && item.approvalStatus !== "APPROVED")
      ) {
        throw new Error("Invalid price-book snapshot.");
      }
      codes.add(code);
    }
  }
}
