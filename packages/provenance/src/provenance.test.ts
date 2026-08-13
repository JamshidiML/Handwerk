import type {
  ClarificationAnswer,
  EntityId,
  ExtractedFact,
  IsoDateTime,
  Measurement,
  OfferLine,
  OrganisationId,
  PhotoEvidence,
  SourceCitation,
  TranscriptSegment,
  UserId,
} from "@handwerk/contracts";
import { CANONICAL_QUESTIONS } from "@handwerk/contracts";
import { describe, expect, it } from "vitest";
import {
  CRITICAL_FACT_KEYS,
  ClarificationAnswerError,
  SourceRegistry,
  applyClarificationAnswer,
  createSourceCitation,
  evaluateClarifications,
  measurementCitationSource,
  photoContextCitationSource,
  transcriptCitationSource,
  userAnswerCitationSource,
  validateFactProvenance,
  validateOfferLineProvenance,
  validateSourceCitation,
  type CitationSource,
  type ClarificationRecord,
  type CompanyRuleCitationSource,
} from "./index";

const organisationId = "org-westblick" as OrganisationId;
const otherOrganisationId = "org-fremd" as OrganisationId;
const projectId = "project-wohnzimmer-bochum" as EntityId;
const userId = "user-demo" as UserId;
const now = "2026-08-12T10:00:00.000Z" as IsoDateTime;
const later = "2026-08-12T11:00:00.000Z" as IsoDateTime;
const extractionVersion = "deterministic-v1";

function id(value: string): EntityId {
  return value as EntityId;
}

function segment(
  value = "segment-1",
  organisation = organisationId,
): TranscriptSegment {
  return {
    id: id(value),
    organisationId: organisation,
    voiceNoteId: id("voice-1"),
    startMs: 100,
    endMs: 2_500,
    text: "Synthetischer Testtext",
    language: "de",
    humanEdited: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function measurement(
  value: string,
  label: string,
  entityId: string,
): Measurement {
  return {
    id: id(entityId),
    organisationId,
    siteVisitId: id("visit-1"),
    label,
    context: "Wohnzimmer",
    quantity: { value, unit: "M2" },
    authority: "AUTHORITATIVE",
    confirmedByUserId: userId,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function photo(): PhotoEvidence {
  return {
    id: id("photo-1"),
    organisationId,
    evidenceAssetId: id("asset-photo-1"),
    caption: "Synthetischer Fotokontext",
    authority: "CONTEXT_ONLY",
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function citation(
  citationId: string,
  source: CitationSource,
  explanation = "Synthetischer Nachweis",
): SourceCitation {
  return createSourceCitation({
    id: id(citationId),
    source,
    extractionVersion,
    explanation,
  });
}

function fact(
  entityId: string,
  key: string,
  value: ExtractedFact["value"],
  status: ExtractedFact["status"],
  citations: SourceCitation[],
  unit?: ExtractedFact["unit"],
  organisation = organisationId,
): ExtractedFact {
  return {
    id: id(entityId),
    organisationId: organisation,
    extractionRunId: id("extraction-1"),
    key,
    value,
    status,
    citations,
    ...(unit === undefined ? {} : { unit }),
  };
}

const wallMeasurement = measurement("52", "Wandfläche", "measurement-wall");
const ceilingMeasurement = measurement(
  "20",
  "Deckenfläche",
  "measurement-ceiling",
);
const transcript = segment();
const wallCitation = citation(
  "citation-wall",
  measurementCitationSource(wallMeasurement),
  "52 m² Wandfläche wurden ausdrücklich eingegeben.",
);
const ceilingAreaCitation = citation(
  "citation-ceiling-area",
  measurementCitationSource(ceilingMeasurement),
  "20 m² Deckenfläche wurden ausdrücklich eingegeben.",
);
const coatsCitation = citation(
  "citation-coats",
  transcriptCitationSource(transcript),
  "Im Transkript sind zwei weiße Anstriche genannt.",
);

function canonicalFacts(
  ceilingStatus: ExtractedFact["status"] = "UNKNOWN",
  substrateStatus: ExtractedFact["status"] = "UNKNOWN",
): ExtractedFact[] {
  return [
    fact("fact-wall", "wall.area", 52, "CONFIRMED", [wallCitation], "M2"),
    fact("fact-coats", "wall.coats", 2, "CONFIRMED", [coatsCitation]),
    fact(
      "fact-ceiling-area",
      "ceiling.area",
      20,
      "CONFIRMED",
      [ceilingAreaCitation],
      "M2",
    ),
    fact("fact-ceiling-included", "ceiling.included", null, ceilingStatus, [
      coatsCitation,
    ]),
    fact("fact-substrate", "substrate.sound", null, substrateStatus, [
      citation(
        "citation-photo-substrate",
        photoContextCitationSource(photo()),
        "Das Foto dokumentiert nur sichtbaren Kontext.",
      ),
    ]),
  ];
}

function evaluate(
  facts = canonicalFacts(),
  previousRecords?: readonly ClarificationRecord[],
) {
  return evaluateClarifications({
    organisationId,
    projectId,
    facts,
    now,
    extractionVersion,
    ...(previousRecords === undefined ? {} : { previousRecords }),
  });
}

function recordByKey(
  records: readonly ClarificationRecord[],
  key: string,
): ClarificationRecord {
  const record = records.find((candidate) => candidate.question.key === key);
  if (record === undefined) throw new Error(`Missing test record for ${key}`);
  return record;
}

function answer(
  record: ClarificationRecord,
  value: unknown,
  answerId: string,
): ClarificationRecord {
  return applyClarificationAnswer({
    record,
    answerId: id(answerId),
    answeredByUserId: userId,
    value,
    now,
  });
}

describe("deterministic critical-fact clarification rules", () => {
  it("emits the two exact canonical questions and blocks review", () => {
    const result = evaluate();

    expect(result.records.map((record) => record.question.prompt)).toEqual([
      CANONICAL_QUESTIONS.ceiling,
      CANONICAL_QUESTIONS.substrate,
    ]);
    expect(result.records.every((record) => record.question.blocking)).toBe(
      true,
    );
    expect(
      result.records.every((record) => record.question.severity === "CRITICAL"),
    ).toBe(true);
    expect(result.readiness).toMatchObject({
      readyForReview: false,
      draftState: "NEEDS_CLARIFICATION",
      unresolvedCriticalKeys: [
        CRITICAL_FACT_KEYS.ceilingIncluded,
        CRITICAL_FACT_KEYS.substrateSound,
      ],
    });
  });

  it("recomputes readiness and creates a cited ceiling exclusion", () => {
    const initial = evaluate();
    const ceiling = answer(
      recordByKey(initial.records, CRITICAL_FACT_KEYS.ceilingIncluded),
      false,
      "answer-ceiling-no",
    );
    const substrate = answer(
      recordByKey(initial.records, CRITICAL_FACT_KEYS.substrateSound),
      true,
      "answer-substrate-yes",
    );

    const result = evaluate(canonicalFacts(), [ceiling, substrate]);

    expect(result.readiness).toEqual({
      readyForReview: true,
      draftState: "READY_FOR_REVIEW",
      blockingQuestionIds: [],
      unresolvedCriticalKeys: [],
    });
    expect(result.exclusions).toHaveLength(1);
    expect(result.exclusions[0]).toMatchObject({
      key: "ceiling.painting",
      reason:
        "Deckenanstrich ausdrücklich ausgeschlossen; die Deckenfläche wird nicht bepreist.",
    });
    expect(result.exclusions[0]?.citations).toMatchObject([
      {
        sourceType: "USER_ANSWER",
        authority: "AUTHORITATIVE",
        sourceEntityId: "answer-ceiling-no",
      },
    ]);
    expect(
      result.resolutions.find(
        (resolution) => resolution.key === CRITICAL_FACT_KEYS.substrateSound,
      ),
    ).toMatchObject({ value: true, resolvedBy: "USER_ANSWER" });
  });

  it("requires explicit repair scope when substrate soundness is denied", () => {
    const initial = evaluate();
    const ceiling = answer(
      recordByKey(initial.records, CRITICAL_FACT_KEYS.ceilingIncluded),
      false,
      "answer-ceiling-no",
    );
    const substrate = answer(
      recordByKey(initial.records, CRITICAL_FACT_KEYS.substrateSound),
      false,
      "answer-substrate-no",
    );
    const needsRepair = evaluate(canonicalFacts(), [ceiling, substrate]);
    const repair = recordByKey(
      needsRepair.records,
      CRITICAL_FACT_KEYS.substrateRemediation,
    );

    expect(needsRepair.readiness.readyForReview).toBe(false);
    expect(repair.question.prompt).toBe(
      "Welche zusätzlichen Ausbesserungen sind am Untergrund erforderlich?",
    );

    const repairAnswer = answer(
      repair,
      "Lose Stellen abstoßen und kleinflächig spachteln.",
      "answer-repair-scope",
    );
    const ready = evaluate(canonicalFacts(), [
      ceiling,
      substrate,
      repairAnswer,
    ]);
    expect(ready.readiness.readyForReview).toBe(true);
  });

  it("keeps unknown and low-confidence values unresolved", () => {
    const lowConfidence = canonicalFacts().map((candidate) =>
      candidate.key === "wall.area"
        ? { ...candidate, status: "UNCERTAIN" as const }
        : candidate,
    );
    const result = evaluate(lowConfidence);

    expect(
      recordByKey(result.records, CRITICAL_FACT_KEYS.wallArea).trigger,
    ).toBe("UNCERTAIN");
    expect(
      result.resolutions.some(
        (resolution) => resolution.key === CRITICAL_FACT_KEYS.wallArea,
      ),
    ).toBe(false);
    expect(result.readiness.readyForReview).toBe(false);
  });

  it("turns conflicting values into a blocking human-resolution question", () => {
    const facts = canonicalFacts().filter(
      (candidate) => candidate.key !== "wall.coats",
    );
    facts.push(
      fact("fact-coats-1", "wall.coats", 1, "CONFIRMED", [coatsCitation]),
      fact("fact-coats-2", "wall.coats", 2, "CONFIRMED", [coatsCitation]),
    );

    const result = evaluate(facts);
    const coats = recordByKey(result.records, CRITICAL_FACT_KEYS.wallCoats);
    expect(coats.trigger).toBe("CONTRADICTORY");
    expect(coats.question.rationale).toContain("widersprechen sich");
    expect(result.readiness.readyForReview).toBe(false);
  });

  it("marks an answer stale when its supporting evidence changes", () => {
    const initial = evaluate();
    const substrate = answer(
      recordByKey(initial.records, CRITICAL_FACT_KEYS.substrateSound),
      true,
      "answer-substrate-yes",
    );
    const changedFacts = canonicalFacts().map((candidate) =>
      candidate.key === "substrate.sound"
        ? {
            ...candidate,
            citations: [
              citation(
                "citation-new-substrate-context",
                transcriptCitationSource(segment("segment-new")),
              ),
            ],
          }
        : candidate,
    );

    const result = evaluate(changedFacts, [substrate]);
    const stale = recordByKey(
      result.records,
      CRITICAL_FACT_KEYS.substrateSound,
    );
    expect(stale.question.status).toBe("STALE");
    expect(stale.trigger).toBe("STALE_ANSWER");
    expect(stale.answer?.value).toBe(true);
    expect(result.readiness.readyForReview).toBe(false);
  });

  it("is stable for identical evidence and prior state", () => {
    const first = evaluate();
    const second = evaluate();
    expect(second).toEqual(first);
  });

  it("validates options, booleans, text, and allowed quantity units", () => {
    const result = evaluate(
      canonicalFacts().map((candidate) =>
        candidate.key === "wall.area"
          ? { ...candidate, status: "UNKNOWN" as const, value: null }
          : candidate,
      ),
    );
    const wallArea = recordByKey(result.records, CRITICAL_FACT_KEYS.wallArea);
    const ceiling = recordByKey(
      result.records,
      CRITICAL_FACT_KEYS.ceilingIncluded,
    );

    expect(() => answer(ceiling, "Nein", "bad-boolean")).toThrowError(
      ClarificationAnswerError,
    );
    expect(() =>
      answer(wallArea, { value: "52", unit: "M" }, "bad-unit"),
    ).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_UNIT" }));
    expect(
      answer(wallArea, { value: "52,5", unit: "M2" }, "wall-answer").answer
        ?.value,
    ).toEqual({ value: "52.5", unit: "M2" });
  });

  it("rejects cross-tenant fact evaluation", () => {
    const facts = canonicalFacts();
    facts.push(
      fact(
        "foreign-fact",
        "wall.area",
        99,
        "CONFIRMED",
        [],
        "M2",
        otherOrganisationId,
      ),
    );
    expect(() => evaluate(facts)).toThrow("cross-tenant");
  });

  it("rejects cross-tenant persisted clarification state", () => {
    const initial = evaluate();
    const ceiling = answer(
      recordByKey(initial.records, CRITICAL_FACT_KEYS.ceilingIncluded),
      false,
      "answer-ceiling-no",
    );
    const foreign = {
      ...ceiling,
      question: {
        ...ceiling.question,
        organisationId: otherOrganisationId,
      },
    };

    expect(() => evaluate(canonicalFacts(), [foreign])).toThrow(
      "cross-tenant or cross-project",
    );
  });
});

describe("strict source citation creation and validation", () => {
  const answerEntity: ClarificationAnswer = {
    id: id("answer-1"),
    organisationId,
    questionId: id("question-1"),
    answeredByUserId: userId,
    value: true,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
  const companyRule: CompanyRuleCitationSource = {
    sourceType: "COMPANY_RULE",
    id: id("rule-source-1"),
    organisationId,
    ruleKey: "protect-door-frames",
    ruleVersion: 2,
  };
  const sources: CitationSource[] = [
    transcriptCitationSource(transcript),
    measurementCitationSource(wallMeasurement),
    userAnswerCitationSource(answerEntity),
    companyRule,
    photoContextCitationSource(photo()),
  ];

  it("creates and validates all five frozen source types", () => {
    const registry = new SourceRegistry(sources);
    const citations = sources.map((source, index) =>
      citation(`citation-source-${index}`, source),
    );

    expect(citations.map((item) => item.sourceType)).toEqual([
      "TRANSCRIPT_SEGMENT",
      "EXPLICIT_MEASUREMENT",
      "USER_ANSWER",
      "COMPANY_RULE",
      "PHOTO_CONTEXT",
    ]);
    expect(citations.at(-1)?.authority).toBe("CONTEXT_ONLY");
    for (const item of citations) {
      expect(validateSourceCitation(item, registry, organisationId)).toEqual({
        valid: true,
        issues: [],
      });
    }
  });

  it("detects orphan, deleted, mistyped, stale-locator, and tenant-invalid citations", () => {
    const valid = citation(
      "citation-valid",
      transcriptCitationSource(transcript),
    );
    const deletedRegistry = new SourceRegistry([
      transcriptCitationSource(transcript, later),
    ]);
    const registry = new SourceRegistry(sources);

    expect(
      validateSourceCitation(
        { ...valid, sourceEntityId: id("missing") },
        registry,
        organisationId,
      ).issues.map((item) => item.code),
    ).toContain("ORPHAN_SOURCE");
    expect(
      validateSourceCitation(valid, deletedRegistry, organisationId).issues.map(
        (item) => item.code,
      ),
    ).toContain("DELETED_SOURCE");
    expect(
      validateSourceCitation(
        { ...valid, sourceType: "PHOTO_CONTEXT" },
        registry,
        organisationId,
      ).issues.map((item) => item.code),
    ).toContain("SOURCE_TYPE_MISMATCH");
    expect(
      validateSourceCitation(
        { ...valid, locator: "transcript:stale:0-1" },
        registry,
        organisationId,
      ).issues.map((item) => item.code),
    ).toContain("LOCATOR_MISMATCH");
    expect(
      validateSourceCitation(
        { ...valid, organisationId: otherOrganisationId },
        registry,
        organisationId,
      ).issues.map((item) => item.code),
    ).toContain("TENANT_MISMATCH");

    const measurementSource = measurementCitationSource(wallMeasurement);
    const measurementCitation = citation(
      "citation-measurement-v1",
      measurementSource,
    );
    const editedMeasurementRegistry = new SourceRegistry([
      measurementCitationSource({ ...wallMeasurement, version: 2 }),
    ]);
    expect(
      validateSourceCitation(
        measurementCitation,
        editedMeasurementRegistry,
        organisationId,
      ).issues.map((item) => item.code),
    ).toContain("LOCATOR_MISMATCH");
  });

  it("rejects ambiguous duplicate source identities", () => {
    const source = transcriptCitationSource(transcript);
    expect(() => new SourceRegistry([source, source])).toThrow(
      "Duplicate provenance source identity",
    );
  });

  it("refuses to create citations from deleted or malformed sources", () => {
    expect(() =>
      citation("deleted-citation", transcriptCitationSource(transcript, later)),
    ).toThrow("deleted");
    expect(() =>
      citation("bad-range", {
        ...transcriptCitationSource(transcript),
        startMs: 500,
        endMs: 500,
      }),
    ).toThrow("millisecond range");
  });

  it("rejects photo-only dimensions and photo-only commercial lines", () => {
    const photoSource = photoContextCitationSource(photo());
    const photoCitation = citation("citation-photo-only", photoSource);
    const registry = new SourceRegistry([photoSource]);
    const area = fact(
      "fact-photo-area",
      "wall.area",
      52,
      "CONFIRMED",
      [photoCitation],
      "M2",
    );
    const line: OfferLine = {
      id: id("line-1"),
      organisationId,
      priceBookItemId: id("item-wall"),
      itemCode: "MAL-001",
      description: "Wandflächen streichen",
      quantity: { value: "52", unit: "M2" },
      unitPrice: { currency: "EUR", minor: 1250 },
      netTotal: { currency: "EUR", minor: 65000 },
      taxCategory: "STANDARD_19",
      taxRateBasisPoints: 1900,
      taxTotal: { currency: "EUR", minor: 12350 },
      grossTotal: { currency: "EUR", minor: 77350 },
      calculation: "52 m² × 12,50 €",
      citations: [photoCitation],
      risk: "NEEDS_REVIEW",
      origin: "GENERATED",
    };

    expect(
      validateFactProvenance(area, registry).issues.map((item) => item.code),
    ).toContain("PHOTO_ONLY_AUTHORITATIVE_CLAIM");
    expect(
      validateOfferLineProvenance(line, registry).issues.map(
        (item) => item.code,
      ),
    ).toContain("MISSING_AUTHORITATIVE_SOURCE");
  });

  it("accepts a commercial line with valid authoritative provenance", () => {
    const source = measurementCitationSource(wallMeasurement);
    const authoritative = citation("citation-authoritative-line", source);
    const registry = new SourceRegistry([source]);
    const line: OfferLine = {
      id: id("line-valid"),
      organisationId,
      priceBookItemId: id("item-wall"),
      itemCode: "MAL-001",
      description: "Wandflächen streichen",
      quantity: { value: "52", unit: "M2" },
      unitPrice: { currency: "EUR", minor: 1250 },
      netTotal: { currency: "EUR", minor: 65000 },
      taxCategory: "STANDARD_19",
      taxRateBasisPoints: 1900,
      taxTotal: { currency: "EUR", minor: 12350 },
      grossTotal: { currency: "EUR", minor: 77350 },
      calculation: "52 m² × 12,50 €",
      citations: [authoritative],
      risk: "LOW_RISK",
      origin: "GENERATED",
    };

    expect(validateOfferLineProvenance(line, registry)).toEqual({
      valid: true,
      issues: [],
    });
  });
});
