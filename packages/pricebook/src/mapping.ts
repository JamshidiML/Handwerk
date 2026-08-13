import type {
  EntityId,
  ExtractedFact,
  MappingProposal,
  OfferLine,
  SourceCitation,
} from "@handwerk/contracts";
import {
  calculateCommercialAmounts,
  CommercialCalculationError,
} from "./calculation";
import type {
  CommercialPriceBookItem,
  DeterministicMappingRule,
  FactMappingResult,
  MappingBatchResult,
  MappingContext,
  TenantSynonymRule,
} from "./types";
import {
  TAX_RATE_BY_CATEGORY,
  isValidIsoDate,
  normalizeCode,
  normalizeLookup,
  parsePositiveDecimal,
  stableEntityId,
} from "./validation";

function makeProposal<Status extends MappingProposal["status"]>(
  fact: ExtractedFact,
  context: MappingContext,
  status: Status,
  explanation: string,
  itemId?: EntityId,
): MappingProposal & { status: Status } {
  return {
    id: stableEntityId(context.organisationId, fact.id, status),
    organisationId: context.organisationId,
    extractedFactId: fact.id,
    status,
    explanation,
    citations: fact.citations.map((citation) => ({ ...citation })),
    createdAt: context.now,
    updatedAt: context.now,
    version: 1,
    ...(itemId ? { priceBookItemId: itemId } : {}),
  };
}

function unpriced(
  fact: ExtractedFact,
  context: MappingContext,
  status: "UNMATCHED" | "NEEDS_CLARIFICATION" | "REJECTED",
  explanation: string,
): FactMappingResult {
  return { proposal: makeProposal(fact, context, status, explanation) };
}

function itemValidityError(
  item: CommercialPriceBookItem,
  context: MappingContext,
): string | undefined {
  if (item.organisationId !== context.organisationId) {
    return "Position gehört nicht zum aktuellen Mandanten.";
  }
  if (item.priceBookId !== context.priceBook.id) {
    return "Position gehört nicht zum ausgewählten Preisbuch.";
  }
  if (item.approvalStatus !== "APPROVED") {
    return "Position ist nicht freigegeben.";
  }
  if (!item.active) return "Position ist inaktiv.";
  if (
    (item.validFrom && !isValidIsoDate(item.validFrom)) ||
    (item.validTo && !isValidIsoDate(item.validTo)) ||
    (item.validFrom && item.validTo && item.validFrom > item.validTo)
  ) {
    return "Gültigkeitszeitraum der Position ist ungültig.";
  }
  if (item.validFrom && context.effectiveOn < item.validFrom) {
    return "Position ist am Leistungsdatum noch nicht gültig.";
  }
  if (item.validTo && context.effectiveOn > item.validTo) {
    return "Position ist am Leistungsdatum abgelaufen.";
  }
  if (
    item.unitPrice.currency !== "EUR" ||
    !Number.isSafeInteger(item.unitPrice.minor) ||
    item.unitPrice.minor <= 0
  ) {
    return "Position hat keinen gültigen freigegebenen EUR-Preis.";
  }
  if (TAX_RATE_BY_CATEGORY[item.taxCategory] !== item.taxRateBasisPoints) {
    return "Steuerreferenz der Position ist inkonsistent.";
  }
  return undefined;
}

function deterministicRule(
  fact: ExtractedFact,
  context: MappingContext,
): DeterministicMappingRule | TenantSynonymRule | undefined {
  const direct = context.rules.find(
    (rule) =>
      rule.organisationId === context.organisationId &&
      rule.factKey === fact.key,
  );
  if (direct) return direct;

  return context.synonymRules?.find((rule) => {
    if (
      rule.organisationId !== context.organisationId ||
      rule.factKey !== fact.key
    ) {
      return false;
    }
    const candidate = context.items.find(
      (item) => normalizeCode(item.code) === normalizeCode(rule.itemCode),
    );
    return candidate?.synonyms.some(
      (synonym) => normalizeLookup(synonym) === normalizeLookup(rule.term),
    );
  });
}

function hasAuthoritativeQuantityCitation(
  citations: readonly SourceCitation[],
  organisationId: MappingContext["organisationId"],
): boolean {
  return citations.some(
    (citation) =>
      citation.organisationId === organisationId &&
      citation.authority === "AUTHORITATIVE" &&
      citation.sourceType !== "PHOTO_CONTEXT",
  );
}

function mapFact(
  fact: ExtractedFact,
  context: MappingContext,
  usedItemIds: Set<EntityId>,
): FactMappingResult {
  if (fact.organisationId !== context.organisationId) {
    return unpriced(
      fact,
      context,
      "REJECTED",
      "Fakt gehört nicht zum aktuellen Mandanten.",
    );
  }
  if (
    fact.citations.some(
      (citation) => citation.organisationId !== context.organisationId,
    )
  ) {
    return unpriced(
      fact,
      context,
      "REJECTED",
      "Beleg gehört nicht vollständig zum aktuellen Mandanten.",
    );
  }
  if (fact.status === "UNKNOWN") {
    return unpriced(
      fact,
      context,
      "NEEDS_CLARIFICATION",
      "Unbekannter Wert bleibt ungepreist.",
    );
  }
  if (fact.status === "UNCERTAIN" || fact.status === "CONTRADICTORY") {
    return unpriced(
      fact,
      context,
      "NEEDS_CLARIFICATION",
      "Unsicherer oder widersprüchlicher Wert erfordert Klärung.",
    );
  }
  if (
    !fact.unit ||
    (typeof fact.value !== "string" && typeof fact.value !== "number")
  ) {
    return unpriced(
      fact,
      context,
      "UNMATCHED",
      "Fakt enthält keine bepreisbare Menge mit Einheit.",
    );
  }
  const quantityValue = String(fact.value);
  const parsedQuantity = parsePositiveDecimal(quantityValue, 6);
  if (!parsedQuantity) {
    return unpriced(
      fact,
      context,
      "REJECTED",
      "Menge ist null, negativ, zu groß oder ungültig.",
    );
  }
  if (
    !hasAuthoritativeQuantityCitation(fact.citations, context.organisationId)
  ) {
    return unpriced(
      fact,
      context,
      "REJECTED",
      "Kontext- oder Fotobeleg darf keine bepreisbare Menge autorisieren.",
    );
  }

  const rule = deterministicRule(fact, context);
  if (!rule) {
    const suggestion = context.providerSuggestions?.find(
      (candidate) => candidate.extractedFactId === fact.id,
    );
    return unpriced(
      fact,
      context,
      "UNMATCHED",
      suggestion
        ? `Kein freigegebener Allowlist-Eintrag; Provider-Vorschlag '${suggestion.suggestedItemCode}' bleibt unverbindlich.`
        : "Kein freigegebener Allowlist-Eintrag für diesen Fakt.",
    );
  }
  if (rule.unit !== fact.unit) {
    return unpriced(
      fact,
      context,
      "REJECTED",
      "Fakt-Einheit ist mit der Mappingregel inkompatibel.",
    );
  }

  const item = context.items.find(
    (candidate) =>
      normalizeCode(candidate.code) === normalizeCode(rule.itemCode),
  );
  if (!item) {
    return unpriced(
      fact,
      context,
      "UNMATCHED",
      "Allowlist-Code wurde im Preisbuch nicht gefunden.",
    );
  }
  const invalidReason = itemValidityError(item, context);
  if (invalidReason) return unpriced(fact, context, "REJECTED", invalidReason);
  if (item.unit !== fact.unit) {
    return unpriced(
      fact,
      context,
      "REJECTED",
      "Preisbuch- und Fakt-Einheit sind inkompatibel.",
    );
  }
  if (usedItemIds.has(item.id)) {
    return unpriced(
      fact,
      context,
      "REJECTED",
      "Position wurde bereits erzeugt; mögliche Doppelzählung bleibt ungepreist.",
    );
  }

  try {
    const quantity = { value: parsedQuantity.canonical, unit: fact.unit };
    const amounts = calculateCommercialAmounts(
      quantity,
      item.unitPrice,
      item.taxRateBasisPoints,
    );
    const line: OfferLine = {
      id: stableEntityId(context.organisationId, fact.id, item.id, "line"),
      organisationId: context.organisationId,
      priceBookItemId: item.id,
      itemCode: item.code,
      description: item.description,
      quantity,
      unitPrice: { ...item.unitPrice },
      netTotal: amounts.netTotal,
      taxCategory: item.taxCategory,
      taxRateBasisPoints: item.taxRateBasisPoints,
      taxTotal: amounts.taxTotal,
      grossTotal: amounts.grossTotal,
      calculation: amounts.calculation,
      citations: fact.citations.map((citation) => ({ ...citation })),
      risk: "LOW_RISK",
      origin: "GENERATED",
    };
    usedItemIds.add(item.id);
    return {
      proposal: {
        ...makeProposal(
          fact,
          context,
          "SUPPORTED",
          `Deterministische Mandantenregel '${fact.key}' → '${item.code}'.`,
          item.id,
        ),
        status: "SUPPORTED",
      },
      line,
    };
  } catch (error) {
    const message =
      error instanceof CommercialCalculationError
        ? error.message
        : "Kommerzielle Berechnung ist fehlgeschlagen.";
    return unpriced(fact, context, "REJECTED", message);
  }
}

export function mapFactsToApprovedPriceBook(
  facts: readonly ExtractedFact[],
  context: MappingContext,
): MappingBatchResult {
  if (
    context.priceBook.organisationId !== context.organisationId ||
    !context.priceBook.active ||
    !isValidIsoDate(context.effectiveOn)
  ) {
    return {
      results: facts.map((fact) =>
        unpriced(
          fact,
          context,
          "REJECTED",
          "Preisbuch ist mandantenfremd, inaktiv oder Leistungsdatum ist ungültig.",
        ),
      ),
      lines: [],
    };
  }

  const usedItemIds = new Set<EntityId>();
  const results = facts.map((fact) => mapFact(fact, context, usedItemIds));
  const lines = results.flatMap((result) =>
    result.proposal.status === "SUPPORTED" && "line" in result && result.line
      ? [result.line]
      : [],
  );
  return {
    results,
    lines,
  };
}
