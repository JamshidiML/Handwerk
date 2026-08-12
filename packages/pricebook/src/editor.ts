import type {
  EntityId,
  IsoDateTime,
  OrganisationId,
} from "@handwerk/contracts";
import type {
  CommercialPriceBookItem,
  ManualPriceBookItemDraft,
  ManualPriceBookItemInput,
  PriceBookStore,
  PriceBookStoreSnapshot,
} from "./types";
import {
  PriceBookValidationError,
  buildCommercialItem,
  stableEntityId,
  validateManualInput,
} from "./validation";

export interface PriceBookEditorOptions {
  now?: () => IsoDateTime;
  createId?: (input: ManualPriceBookItemInput) => EntityId;
}

function toInput(item: CommercialPriceBookItem): ManualPriceBookItemInput {
  return {
    code: item.code,
    description: item.description,
    category: item.category,
    unit: item.unit,
    unitPriceMinor: item.unitPrice.minor,
    taxCategory: item.taxCategory,
    taxRateBasisPoints: item.taxRateBasisPoints,
    synonyms: item.synonyms,
    ...(item.validFrom ? { validFrom: item.validFrom } : {}),
    ...(item.validTo ? { validTo: item.validTo } : {}),
  };
}

export class PriceBookEditorService {
  readonly #now: () => IsoDateTime;
  readonly #createId: (input: ManualPriceBookItemInput) => EntityId;

  constructor(
    readonly store: PriceBookStore,
    readonly organisationId: OrganisationId,
    readonly priceBookId: EntityId,
    options: PriceBookEditorOptions = {},
  ) {
    this.#now = options.now ?? (() => new Date().toISOString() as IsoDateTime);
    this.#createId =
      options.createId ??
      ((input) =>
        stableEntityId(organisationId, priceBookId, input.code, this.#now()));
  }

  list(): PriceBookStoreSnapshot {
    const snapshot = this.store.read(this.organisationId, this.priceBookId);
    if (!snapshot) throw new Error("Preisbuch nicht gefunden.");
    return snapshot;
  }

  createDraft(input: ManualPriceBookItemInput): CommercialPriceBookItem {
    this.#assertValid(input);
    const now = this.#now();
    const item = buildCommercialItem({
      id: this.#createId(input),
      organisationId: this.organisationId,
      priceBookId: this.priceBookId,
      data: input,
      approvalStatus: "DRAFT",
      active: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
    return this.store.saveItem(this.organisationId, this.priceBookId, item);
  }

  update(
    itemId: EntityId,
    expectedVersion: number,
    input: ManualPriceBookItemInput,
  ): CommercialPriceBookItem {
    this.#assertValid(input);
    const existing = this.#find(itemId);
    const updated = buildCommercialItem({
      id: existing.id,
      organisationId: this.organisationId,
      priceBookId: this.priceBookId,
      data: input,
      approvalStatus: "DRAFT",
      active: false,
      createdAt: existing.createdAt,
      updatedAt: this.#now(),
      version: existing.version + 1,
    });
    return this.store.saveItem(
      this.organisationId,
      this.priceBookId,
      updated,
      expectedVersion,
    );
  }

  approve(
    itemId: EntityId,
    expectedVersion: number,
    activate = false,
  ): CommercialPriceBookItem {
    const existing = this.#find(itemId);
    const approved = buildCommercialItem({
      id: existing.id,
      organisationId: this.organisationId,
      priceBookId: this.priceBookId,
      data: toInput(existing),
      approvalStatus: "APPROVED",
      active: activate,
      createdAt: existing.createdAt,
      updatedAt: this.#now(),
      version: existing.version + 1,
    });
    return this.store.saveItem(
      this.organisationId,
      this.priceBookId,
      approved,
      expectedVersion,
    );
  }

  setActive(
    itemId: EntityId,
    expectedVersion: number,
    active: boolean,
  ): CommercialPriceBookItem {
    const existing = this.#find(itemId);
    if (active && existing.approvalStatus !== "APPROVED") {
      throw new PriceBookValidationError(
        "Nur freigegebene Positionen dürfen aktiv sein.",
        [
          {
            code: "INVALID_ACTIVE",
            field: "active",
            message: "Position muss vor Aktivierung freigegeben werden.",
          },
        ],
      );
    }
    const saved: CommercialPriceBookItem = {
      ...existing,
      active,
      updatedAt: this.#now(),
      version: existing.version + 1,
    };
    return this.store.saveItem(
      this.organisationId,
      this.priceBookId,
      saved,
      expectedVersion,
    );
  }

  toDraft(item: CommercialPriceBookItem): ManualPriceBookItemDraft {
    return {
      id: item.id,
      version: item.version,
      ...toInput(item),
      active: item.active,
      approvalStatus: item.approvalStatus,
    };
  }

  #find(itemId: EntityId): CommercialPriceBookItem {
    const item = this.list().items.find((candidate) => candidate.id === itemId);
    if (!item) throw new Error("Preisposition nicht gefunden.");
    return item;
  }

  #assertValid(input: ManualPriceBookItemInput): void {
    const issues = validateManualInput(input);
    if (issues.length > 0) {
      throw new PriceBookValidationError("Preisposition ist ungültig.", issues);
    }
  }
}
