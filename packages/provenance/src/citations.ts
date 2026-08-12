import type {
  ClarificationAnswer,
  EntityId,
  EvidenceAuthority,
  ExtractedFact,
  IsoDateTime,
  Measurement,
  OfferLine,
  OrganisationId,
  PhotoEvidence,
  SourceCitation,
  SourceType,
  TranscriptSegment,
} from "@handwerk/contracts";

interface SourceLifecycle {
  deletedAt?: IsoDateTime;
}

export type TranscriptCitationSource = SourceLifecycle & {
  sourceType: "TRANSCRIPT_SEGMENT";
  id: EntityId;
  organisationId: OrganisationId;
  sourceVersion: number;
  startMs: number;
  endMs: number;
};

export type MeasurementCitationSource = SourceLifecycle & {
  sourceType: "EXPLICIT_MEASUREMENT";
  id: EntityId;
  organisationId: OrganisationId;
  sourceVersion: number;
};

export type UserAnswerCitationSource = SourceLifecycle & {
  sourceType: "USER_ANSWER";
  id: EntityId;
  organisationId: OrganisationId;
  questionId: EntityId;
  sourceVersion: number;
};

export type CompanyRuleCitationSource = SourceLifecycle & {
  sourceType: "COMPANY_RULE";
  id: EntityId;
  organisationId: OrganisationId;
  ruleKey: string;
  ruleVersion: number;
};

export type PhotoContextCitationSource = SourceLifecycle & {
  sourceType: "PHOTO_CONTEXT";
  id: EntityId;
  organisationId: OrganisationId;
  evidenceAssetId: EntityId;
  sourceVersion: number;
};

export type CitationSource =
  | TranscriptCitationSource
  | MeasurementCitationSource
  | UserAnswerCitationSource
  | CompanyRuleCitationSource
  | PhotoContextCitationSource;

export type CitationValidationCode =
  | "EMPTY_FIELD"
  | "ORPHAN_SOURCE"
  | "DELETED_SOURCE"
  | "SOURCE_TYPE_MISMATCH"
  | "TENANT_MISMATCH"
  | "AUTHORITY_MISMATCH"
  | "LOCATOR_MISMATCH"
  | "MISSING_CITATION"
  | "MISSING_AUTHORITATIVE_SOURCE"
  | "PHOTO_ONLY_AUTHORITATIVE_CLAIM";

export interface CitationValidationIssue {
  code: CitationValidationCode;
  citationId?: EntityId;
  message: string;
}

export interface CitationValidationResult {
  valid: boolean;
  issues: CitationValidationIssue[];
}

export interface CreateSourceCitationInput {
  id: EntityId;
  source: CitationSource;
  extractionVersion: string;
  explanation: string;
}

const AUTHORITY_BY_SOURCE: Readonly<Record<SourceType, EvidenceAuthority>> = {
  TRANSCRIPT_SEGMENT: "AUTHORITATIVE",
  EXPLICIT_MEASUREMENT: "AUTHORITATIVE",
  USER_ANSWER: "AUTHORITATIVE",
  COMPANY_RULE: "AUTHORITATIVE",
  PHOTO_CONTEXT: "CONTEXT_ONLY",
};

function requireNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must not be empty`);
  }
}

function locatorFor(source: CitationSource): string {
  switch (source.sourceType) {
    case "TRANSCRIPT_SEGMENT":
      requirePositiveVersion(source.sourceVersion, "Transcript source version");
      if (
        !Number.isInteger(source.startMs) ||
        !Number.isInteger(source.endMs) ||
        source.startMs < 0 ||
        source.endMs <= source.startMs
      ) {
        throw new Error("Transcript source requires a valid millisecond range");
      }
      return `transcript:${source.id}:v${source.sourceVersion}:${source.startMs}-${source.endMs}`;
    case "EXPLICIT_MEASUREMENT":
      requirePositiveVersion(
        source.sourceVersion,
        "Measurement source version",
      );
      return `measurement:${source.id}:v${source.sourceVersion}`;
    case "USER_ANSWER":
      requirePositiveVersion(source.sourceVersion, "Answer source version");
      return `answer:${source.id}:v${source.sourceVersion}:question:${source.questionId}`;
    case "COMPANY_RULE":
      requireNonEmpty(source.ruleKey, "ruleKey");
      requirePositiveVersion(source.ruleVersion, "Company rule version");
      return `rule:${source.ruleKey}:v${source.ruleVersion}`;
    case "PHOTO_CONTEXT":
      requirePositiveVersion(source.sourceVersion, "Photo source version");
      return `photo:${source.id}:v${source.sourceVersion}:asset:${source.evidenceAssetId}`;
  }
}

function requirePositiveVersion(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive integer`);
  }
}

export function createSourceCitation(
  input: CreateSourceCitationInput,
): SourceCitation {
  requireNonEmpty(input.id, "citation id");
  requireNonEmpty(input.source.id, "source id");
  requireNonEmpty(input.source.organisationId, "source organisation id");
  requireNonEmpty(input.extractionVersion, "extractionVersion");
  requireNonEmpty(input.explanation, "explanation");

  if (input.source.deletedAt !== undefined) {
    throw new Error("Cannot cite a deleted source");
  }

  return {
    id: input.id,
    organisationId: input.source.organisationId,
    sourceType: input.source.sourceType,
    sourceEntityId: input.source.id,
    locator: locatorFor(input.source),
    extractionVersion: input.extractionVersion.trim(),
    explanation: input.explanation.trim(),
    authority: AUTHORITY_BY_SOURCE[input.source.sourceType],
  };
}

export function transcriptCitationSource(
  segment: TranscriptSegment,
  deletedAt?: IsoDateTime,
): TranscriptCitationSource {
  return {
    sourceType: "TRANSCRIPT_SEGMENT",
    id: segment.id,
    organisationId: segment.organisationId,
    sourceVersion: segment.version,
    startMs: segment.startMs,
    endMs: segment.endMs,
    ...(deletedAt === undefined ? {} : { deletedAt }),
  };
}

export function measurementCitationSource(
  measurement: Measurement,
  deletedAt?: IsoDateTime,
): MeasurementCitationSource {
  return {
    sourceType: "EXPLICIT_MEASUREMENT",
    id: measurement.id,
    organisationId: measurement.organisationId,
    sourceVersion: measurement.version,
    ...(deletedAt === undefined ? {} : { deletedAt }),
  };
}

export function userAnswerCitationSource(
  answer: ClarificationAnswer,
  deletedAt?: IsoDateTime,
): UserAnswerCitationSource {
  return {
    sourceType: "USER_ANSWER",
    id: answer.id,
    organisationId: answer.organisationId,
    questionId: answer.questionId,
    sourceVersion: answer.version,
    ...(deletedAt === undefined ? {} : { deletedAt }),
  };
}

export function photoContextCitationSource(
  photo: PhotoEvidence,
  deletedAt?: IsoDateTime,
): PhotoContextCitationSource {
  return {
    sourceType: "PHOTO_CONTEXT",
    id: photo.id,
    organisationId: photo.organisationId,
    evidenceAssetId: photo.evidenceAssetId,
    sourceVersion: photo.version,
    ...(deletedAt === undefined ? {} : { deletedAt }),
  };
}

export class SourceRegistry {
  readonly #sources: CitationSource[];

  constructor(sources: readonly CitationSource[]) {
    this.#sources = [...sources];
    const identities = new Set<string>();
    for (const source of this.#sources) {
      const identity = `${source.sourceType}:${source.id}`;
      if (identities.has(identity)) {
        throw new Error("Duplicate provenance source identity");
      }
      identities.add(identity);
    }
  }

  find(
    sourceType: SourceType,
    sourceEntityId: EntityId,
  ): CitationSource | undefined {
    return this.#sources.find(
      (source) =>
        source.sourceType === sourceType && source.id === sourceEntityId,
    );
  }

  findById(sourceEntityId: EntityId): CitationSource[] {
    return this.#sources.filter((source) => source.id === sourceEntityId);
  }
}

function issue(
  code: CitationValidationCode,
  message: string,
  citationId?: EntityId,
): CitationValidationIssue {
  return {
    code,
    message,
    ...(citationId === undefined ? {} : { citationId }),
  };
}

export function validateSourceCitation(
  citation: SourceCitation,
  registry: SourceRegistry,
  expectedOrganisationId: OrganisationId,
): CitationValidationResult {
  const issues: CitationValidationIssue[] = [];

  if (
    citation.id.trim().length === 0 ||
    citation.sourceEntityId.trim().length === 0 ||
    citation.locator.trim().length === 0 ||
    citation.extractionVersion.trim().length === 0 ||
    citation.explanation.trim().length === 0
  ) {
    issues.push(
      issue(
        "EMPTY_FIELD",
        "Citation contains an empty required field",
        citation.id,
      ),
    );
  }

  if (citation.organisationId !== expectedOrganisationId) {
    issues.push(
      issue(
        "TENANT_MISMATCH",
        "Citation does not belong to the expected organisation",
        citation.id,
      ),
    );
  }

  const source = registry.find(citation.sourceType, citation.sourceEntityId);
  if (source === undefined) {
    const sourcesWithId = registry.findById(citation.sourceEntityId);
    issues.push(
      issue(
        sourcesWithId.length > 0 ? "SOURCE_TYPE_MISMATCH" : "ORPHAN_SOURCE",
        sourcesWithId.length > 0
          ? "Citation source type does not match the registered source"
          : "Citation source does not exist",
        citation.id,
      ),
    );
    return { valid: false, issues };
  }

  if (source.deletedAt !== undefined) {
    issues.push(
      issue("DELETED_SOURCE", "Citation source has been deleted", citation.id),
    );
  }

  if (
    source.organisationId !== expectedOrganisationId ||
    source.organisationId !== citation.organisationId
  ) {
    issues.push(
      issue(
        "TENANT_MISMATCH",
        "Citation and source organisation do not match",
        citation.id,
      ),
    );
  }

  if (citation.authority !== AUTHORITY_BY_SOURCE[source.sourceType]) {
    issues.push(
      issue(
        "AUTHORITY_MISMATCH",
        "Citation authority is invalid for its source type",
        citation.id,
      ),
    );
  }

  let expectedLocator: string | undefined;
  try {
    expectedLocator = locatorFor(source);
  } catch {
    issues.push(
      issue(
        "LOCATOR_MISMATCH",
        "Registered source cannot produce a valid stable locator",
        citation.id,
      ),
    );
  }
  if (expectedLocator !== undefined && citation.locator !== expectedLocator) {
    issues.push(
      issue(
        "LOCATOR_MISMATCH",
        "Citation locator does not match the current source",
        citation.id,
      ),
    );
  }

  return { valid: issues.length === 0, issues };
}

function collectCitationIssues(
  citations: readonly SourceCitation[],
  organisationId: OrganisationId,
  registry: SourceRegistry,
): CitationValidationIssue[] {
  return citations.flatMap(
    (citation) =>
      validateSourceCitation(citation, registry, organisationId).issues,
  );
}

function isAuthoritySensitiveFact(fact: ExtractedFact): boolean {
  return (
    fact.unit !== undefined ||
    typeof fact.value === "number" ||
    /(?:area|length|width|height|quantity|count|substrate|moisture|wiring|pipe|hidden)/i.test(
      fact.key,
    )
  );
}

export function validateFactProvenance(
  fact: ExtractedFact,
  registry: SourceRegistry,
): CitationValidationResult {
  const issues = collectCitationIssues(
    fact.citations,
    fact.organisationId,
    registry,
  );

  if (fact.status !== "UNKNOWN" && fact.citations.length === 0) {
    issues.push(issue("MISSING_CITATION", "Known fact has no source citation"));
  }

  if (
    fact.status === "CONFIRMED" &&
    isAuthoritySensitiveFact(fact) &&
    !fact.citations.some((citation) => citation.authority === "AUTHORITATIVE")
  ) {
    issues.push(
      issue(
        "PHOTO_ONLY_AUTHORITATIVE_CLAIM",
        "A dimension or hidden-condition fact cannot be confirmed by context-only evidence",
      ),
    );
  }

  return { valid: issues.length === 0, issues };
}

export function validateOfferLineProvenance(
  line: OfferLine,
  registry: SourceRegistry,
): CitationValidationResult {
  const issues = collectCitationIssues(
    line.citations,
    line.organisationId,
    registry,
  );

  if (line.citations.length === 0) {
    issues.push(
      issue("MISSING_CITATION", "Commercial line has no source citation"),
    );
  }

  if (
    !line.citations.some((citation) => citation.authority === "AUTHORITATIVE")
  ) {
    issues.push(
      issue(
        "MISSING_AUTHORITATIVE_SOURCE",
        "Commercial line requires at least one authoritative source",
      ),
    );
  }

  return { valid: issues.length === 0, issues };
}
