import {
  CANONICAL_IDS,
  type EntityId,
  type IsoDateTime,
  type PriceBook,
} from "@handwerk/contracts";
import type {
  CommercialPriceBookItem,
  DeterministicMappingRule,
  PriceBookStoreSnapshot,
  TenantSynonymRule,
} from "./types";
import { buildCommercialItem } from "./validation";

export const SYNTHETIC_PRICE_BOOK_ID =
  "pricebook-westblick-maler-v1" as EntityId;
export const SYNTHETIC_FIXTURE_TIME = "2026-08-12T08:00:00.000Z" as IsoDateTime;

export const SYNTHETIC_MALER_PRICE_BOOK: PriceBook = {
  id: SYNTHETIC_PRICE_BOOK_ID,
  organisationId: CANONICAL_IDS.organisation,
  name: "SYNTHETISCH – Maler-Preisbuch Westblick",
  active: true,
  createdAt: SYNTHETIC_FIXTURE_TIME,
  updatedAt: SYNTHETIC_FIXTURE_TIME,
  version: 1,
};

function fixtureItem(input: {
  id: string;
  code: string;
  description: string;
  category: string;
  unit: "M2" | "M" | "STK" | "STD" | "PAUSCHALE";
  unitPriceMinor: number;
  synonyms: readonly string[];
  active?: boolean;
}): CommercialPriceBookItem {
  return buildCommercialItem({
    id: input.id as EntityId,
    organisationId: CANONICAL_IDS.organisation,
    priceBookId: SYNTHETIC_PRICE_BOOK_ID,
    data: {
      code: input.code,
      description: input.description,
      category: input.category,
      unit: input.unit,
      unitPriceMinor: input.unitPriceMinor,
      taxCategory: "STANDARD_19",
      taxRateBasisPoints: 1_900,
      validFrom: "2026-01-01",
      synonyms: input.synonyms,
    },
    approvalStatus: "APPROVED",
    active: input.active ?? true,
    createdAt: SYNTHETIC_FIXTURE_TIME,
    updatedAt: SYNTHETIC_FIXTURE_TIME,
    version: 1,
  });
}

export const SYNTHETIC_MALER_ITEMS: readonly CommercialPriceBookItem[] = [
  fixtureItem({
    id: "pb-item-wall-two-coats",
    code: "MAL-WAND-2X",
    description: "Wandflächen zweimal deckend weiß streichen",
    category: "Malerarbeiten",
    unit: "M2",
    unitPriceMinor: 850,
    synonyms: ["Wände zweimal weiß", "zweifacher Wandanstrich"],
  }),
  fixtureItem({
    id: "pb-item-ceiling-two-coats",
    code: "MAL-DECKE-2X",
    description: "Deckenflächen zweimal deckend weiß streichen",
    category: "Malerarbeiten",
    unit: "M2",
    unitPriceMinor: 975,
    synonyms: ["Decke zweimal weiß", "zweifacher Deckenanstrich"],
  }),
  fixtureItem({
    id: "pb-item-protect-frame",
    code: "SCHUTZ-ZARGE",
    description: "Türzarge fachgerecht abkleben und schützen",
    category: "Abdeckarbeiten",
    unit: "STK",
    unitPriceMinor: 650,
    synonyms: ["Türrahmen schützen", "Zarge abkleben"],
  }),
  fixtureItem({
    id: "pb-item-substrate-repair",
    code: "VOR-SPACHTEL",
    description: "Untergrund punktuell ausbessern und spachteln",
    category: "Vorarbeiten",
    unit: "STD",
    unitPriceMinor: 5_900,
    synonyms: ["Untergrund ausbessern"],
    active: false,
  }),
];

export const SYNTHETIC_MAPPING_RULES: readonly DeterministicMappingRule[] = [
  {
    organisationId: CANONICAL_IDS.organisation,
    factKey: "walls.paint.white.two_coats",
    itemCode: "MAL-WAND-2X",
    unit: "M2",
  },
  {
    organisationId: CANONICAL_IDS.organisation,
    factKey: "ceiling.paint.white.two_coats",
    itemCode: "MAL-DECKE-2X",
    unit: "M2",
  },
  {
    organisationId: CANONICAL_IDS.organisation,
    factKey: "door_frames.protect",
    itemCode: "SCHUTZ-ZARGE",
    unit: "STK",
  },
];

export const SYNTHETIC_TENANT_SYNONYM_RULES: readonly TenantSynonymRule[] = [
  {
    organisationId: CANONICAL_IDS.organisation,
    factKey: "walls.paint.double_white",
    term: "Wände zweimal weiß",
    itemCode: "MAL-WAND-2X",
    unit: "M2",
  },
];

export const SYNTHETIC_PRICE_BOOK_SNAPSHOT: PriceBookStoreSnapshot = {
  priceBook: SYNTHETIC_MALER_PRICE_BOOK,
  items: SYNTHETIC_MALER_ITEMS,
};
