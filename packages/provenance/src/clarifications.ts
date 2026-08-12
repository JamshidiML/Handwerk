import {
  CANONICAL_QUESTIONS,
  type ClarificationAnswer,
  type ClarificationQuestion,
  type EntityId,
  type ExtractedFact,
  type IsoDateTime,
  type OrganisationId,
  type Quantity,
  type SourceCitation,
  type Unit,
  type UserId,
} from "@handwerk/contracts";
import { createSourceCitation, userAnswerCitationSource } from "./citations";

export const CRITICAL_FACT_KEYS = {
  wallArea: "wall.area",
  wallCoats: "wall.coats",
  ceilingIncluded: "ceiling.included",
  ceilingArea: "ceiling.area",
  substrateSound: "substrate.sound",
  substrateRemediation: "substrate.remediation_scope",
} as const;

export type CriticalFactKey =
  (typeof CRITICAL_FACT_KEYS)[keyof typeof CRITICAL_FACT_KEYS];

export type ClarificationTrigger =
  | "MISSING"
  | "UNKNOWN"
  | "UNCERTAIN"
  | "CONTRADICTORY"
  | "STALE_ANSWER";

export interface CriticalFactRule {
  key: CriticalFactKey;
  aliases: readonly string[];
  prompt: string;
  rationale: string;
  answerType: ClarificationQuestion["answerType"];
  options?: readonly string[];
  allowedUnits?: readonly Unit[];
  severity: ClarificationQuestion["severity"];
  blocking: boolean;
  condition: "ALWAYS" | "WHEN_CEILING_INCLUDED" | "WHEN_SUBSTRATE_NOT_SOUND";
}

export interface ClarificationRecord {
  question: ClarificationQuestion;
  basisFingerprint: string;
  trigger: ClarificationTrigger;
  answer?: ClarificationAnswer;
  answerBasisFingerprint?: string;
  allowedUnits?: readonly Unit[];
}

export interface ClarificationResolution {
  key: CriticalFactKey;
  value: string | number | boolean | Quantity;
  citations: SourceCitation[];
  resolvedBy: "EXTRACTED_FACT" | "USER_ANSWER";
}

export interface ClarificationExclusion {
  key: "ceiling.painting";
  reason: string;
  citations: SourceCitation[];
}

export interface ClarificationReadiness {
  readyForReview: boolean;
  draftState: "NEEDS_CLARIFICATION" | "READY_FOR_REVIEW";
  blockingQuestionIds: EntityId[];
  unresolvedCriticalKeys: CriticalFactKey[];
}

export interface ClarificationEvaluation {
  records: ClarificationRecord[];
  resolutions: ClarificationResolution[];
  exclusions: ClarificationExclusion[];
  readiness: ClarificationReadiness;
}

export interface EvaluateClarificationsInput {
  organisationId: OrganisationId;
  projectId: EntityId;
  facts: readonly ExtractedFact[];
  previousRecords?: readonly ClarificationRecord[];
  now: IsoDateTime;
  extractionVersion: string;
}

export interface ApplyClarificationAnswerInput {
  record: ClarificationRecord;
  answerId: EntityId;
  answeredByUserId: UserId;
  value: unknown;
  now: IsoDateTime;
}

export type ClarificationAnswerErrorCode =
  | "QUESTION_NOT_ANSWERABLE"
  | "INVALID_BOOLEAN"
  | "INVALID_OPTION"
  | "INVALID_TEXT"
  | "INVALID_QUANTITY"
  | "UNSUPPORTED_UNIT";

export class ClarificationAnswerError extends Error {
  readonly code: ClarificationAnswerErrorCode;

  constructor(code: ClarificationAnswerErrorCode, message: string) {
    super(message);
    this.name = "ClarificationAnswerError";
    this.code = code;
  }
}

const ALWAYS_REQUIRED_RULES: readonly CriticalFactRule[] = [
  {
    key: CRITICAL_FACT_KEYS.wallArea,
    aliases: ["wall.area", "wall_area", "wallArea"],
    prompt: "Wie groß ist die zu streichende Wandfläche?",
    rationale:
      "Die bestätigte Wandfläche wird für Menge und Kalkulation benötigt.",
    answerType: "QUANTITY",
    allowedUnits: ["M2"],
    severity: "CRITICAL",
    blocking: true,
    condition: "ALWAYS",
  },
  {
    key: CRITICAL_FACT_KEYS.wallCoats,
    aliases: ["wall.coats", "wall_coats", "wallCoats"],
    prompt: "Wie viele Anstriche sind für die Wände vorgesehen?",
    rationale:
      "Die Anzahl der Anstriche bestimmt den auszuführenden Leistungsumfang.",
    answerType: "SINGLE_CHOICE",
    options: ["1", "2", "3"],
    severity: "CRITICAL",
    blocking: true,
    condition: "ALWAYS",
  },
  {
    key: CRITICAL_FACT_KEYS.ceilingIncluded,
    aliases: [
      "ceiling.included",
      "ceiling_included",
      "ceiling.include",
      "ceilingInScope",
    ],
    prompt: CANONICAL_QUESTIONS.ceiling,
    rationale:
      "Ohne diese Entscheidung darf der Deckenanstrich weder eingerechnet noch stillschweigend ausgeschlossen werden.",
    answerType: "BOOLEAN",
    severity: "CRITICAL",
    blocking: true,
    condition: "ALWAYS",
  },
  {
    key: CRITICAL_FACT_KEYS.substrateSound,
    aliases: [
      "substrate.sound",
      "substrate_sound",
      "substrate.condition.sound",
      "substrateSound",
    ],
    prompt: CANONICAL_QUESTIONS.substrate,
    rationale:
      "Der Untergrund entscheidet, ob zusätzliche Vorarbeiten geklärt werden müssen.",
    answerType: "BOOLEAN",
    severity: "CRITICAL",
    blocking: true,
    condition: "ALWAYS",
  },
];

const CONDITIONAL_RULES: readonly CriticalFactRule[] = [
  {
    key: CRITICAL_FACT_KEYS.ceilingArea,
    aliases: ["ceiling.area", "ceiling_area", "ceilingArea"],
    prompt: "Wie groß ist die zu streichende Deckenfläche?",
    rationale:
      "Bei eingeschlossenem Deckenanstrich ist eine bestätigte Fläche erforderlich.",
    answerType: "QUANTITY",
    allowedUnits: ["M2"],
    severity: "CRITICAL",
    blocking: true,
    condition: "WHEN_CEILING_INCLUDED",
  },
  {
    key: CRITICAL_FACT_KEYS.substrateRemediation,
    aliases: [
      "substrate.remediation_scope",
      "substrate_remediation_scope",
      "substrate.repairs",
    ],
    prompt:
      "Welche zusätzlichen Ausbesserungen sind am Untergrund erforderlich?",
    rationale:
      "Ein nicht tragfähiger oder ausbesserungsbedürftiger Untergrund braucht einen ausdrücklich beschriebenen Leistungsumfang.",
    answerType: "TEXT",
    severity: "CRITICAL",
    blocking: true,
    condition: "WHEN_SUBSTRATE_NOT_SOUND",
  },
];

export const CRITICAL_FACT_RULES: readonly CriticalFactRule[] = [
  ...ALWAYS_REQUIRED_RULES,
  ...CONDITIONAL_RULES,
];

type EffectiveValue = string | number | boolean | Quantity;
type AssessmentState = "CONFIRMED" | "UNKNOWN" | "UNCERTAIN" | "CONTRADICTORY";

interface FactAssessment {
  state: AssessmentState;
  fingerprint: string;
  citations: SourceCitation[];
  value?: string | number | boolean;
  unit?: Unit;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function stableQuestionId(projectId: EntityId, key: CriticalFactKey): EntityId {
  return `clarification-${stableHash(`${projectId}:${key}`)}` as EntityId;
}

function stableAnswerCitationId(answerId: EntityId): EntityId {
  return `citation-answer-${stableHash(answerId)}` as EntityId;
}

function factComparisonValue(
  value: string | number | boolean,
  unit?: Unit,
): string {
  return JSON.stringify({ value, unit: unit ?? null });
}

function effectiveComparisonValue(value: EffectiveValue): string {
  if (typeof value === "object") {
    return factComparisonValue(value.value, value.unit);
  }
  return factComparisonValue(value);
}

function deduplicateCitations(
  citations: readonly SourceCitation[],
): SourceCitation[] {
  const byId = new Map<string, SourceCitation>();
  for (const citation of citations) {
    byId.set(citation.id, citation);
  }
  return [...byId.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

function assessFacts(
  rule: CriticalFactRule,
  facts: readonly ExtractedFact[],
): FactAssessment {
  const relevant = facts
    .filter((fact) => rule.aliases.includes(fact.key))
    .sort((left, right) => left.id.localeCompare(right.id));
  const citations = deduplicateCitations(
    relevant.flatMap((fact) => fact.citations),
  );
  const fingerprintPayload = relevant.map((fact) => ({
    id: fact.id,
    key: fact.key,
    value: fact.value,
    unit: fact.unit ?? null,
    status: fact.status,
    citations: fact.citations
      .map((citation) => ({
        id: citation.id,
        sourceType: citation.sourceType,
        sourceEntityId: citation.sourceEntityId,
        locator: citation.locator,
        authority: citation.authority,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  }));
  const fingerprint = stableHash(
    `${rule.key}:${JSON.stringify(fingerprintPayload)}`,
  );

  if (relevant.length === 0) {
    return { state: "UNKNOWN", fingerprint, citations };
  }

  if (relevant.some((fact) => fact.status === "CONTRADICTORY")) {
    return { state: "CONTRADICTORY", fingerprint, citations };
  }

  const meaningful = relevant.filter(
    (fact) => fact.status !== "UNKNOWN" && fact.value !== null,
  );
  if (meaningful.length === 0) {
    return { state: "UNKNOWN", fingerprint, citations };
  }

  const distinctValues = new Set(
    meaningful.map((fact) =>
      factComparisonValue(fact.value as string | number | boolean, fact.unit),
    ),
  );
  if (distinctValues.size > 1) {
    return { state: "CONTRADICTORY", fingerprint, citations };
  }

  const first = meaningful[0];
  if (first === undefined || first.value === null) {
    return { state: "UNKNOWN", fingerprint, citations };
  }

  const state = meaningful.some((fact) => fact.status === "UNCERTAIN")
    ? "UNCERTAIN"
    : "CONFIRMED";
  return {
    state,
    fingerprint,
    citations,
    value: first.value,
    ...(first.unit === undefined ? {} : { unit: first.unit }),
  };
}

function triggerFor(assessment: FactAssessment): ClarificationTrigger {
  switch (assessment.state) {
    case "UNKNOWN":
      return assessment.citations.length === 0 ? "MISSING" : "UNKNOWN";
    case "UNCERTAIN":
      return "UNCERTAIN";
    case "CONTRADICTORY":
      return "CONTRADICTORY";
    case "CONFIRMED":
      return "STALE_ANSWER";
  }
}

function triggerExplanation(trigger: ClarificationTrigger): string {
  switch (trigger) {
    case "MISSING":
      return "Die Angabe fehlt.";
    case "UNKNOWN":
      return "Die Angabe wurde ausdrücklich als unbekannt erfasst.";
    case "UNCERTAIN":
      return "Die vorhandene Angabe ist nicht ausreichend sicher.";
    case "CONTRADICTORY":
      return "Die vorhandenen Quellen widersprechen sich.";
    case "STALE_ANSWER":
      return "Seit der Antwort hat sich die zugrunde liegende Evidenz geändert.";
  }
}

function answerMatchesAssessment(
  answer: ClarificationAnswer,
  assessment: FactAssessment,
): boolean {
  if (assessment.state !== "CONFIRMED" || assessment.value === undefined) {
    return false;
  }
  const assessed: EffectiveValue =
    assessment.unit === undefined
      ? assessment.value
      : { value: String(assessment.value), unit: assessment.unit };
  return (
    effectiveComparisonValue(answer.value) ===
    effectiveComparisonValue(assessed)
  );
}

function questionIsUnchanged(
  previous: ClarificationRecord,
  status: ClarificationQuestion["status"],
  trigger: ClarificationTrigger,
  assessment: FactAssessment,
): boolean {
  return (
    previous.basisFingerprint === assessment.fingerprint &&
    previous.question.status === status &&
    previous.trigger === trigger
  );
}

function buildQuestionRecord(
  rule: CriticalFactRule,
  assessment: FactAssessment,
  input: EvaluateClarificationsInput,
  previous: ClarificationRecord | undefined,
): ClarificationRecord | undefined {
  if (assessment.state === "CONFIRMED") {
    if (
      previous?.answer === undefined ||
      answerMatchesAssessment(previous.answer, assessment)
    ) {
      return undefined;
    }
  }

  let trigger = triggerFor(assessment);
  let status: ClarificationQuestion["status"] = "OPEN";
  if (previous?.answer !== undefined) {
    if (previous.answerBasisFingerprint === assessment.fingerprint) {
      status = "ANSWERED";
    } else {
      status = "STALE";
      trigger = "STALE_ANSWER";
    }
  }

  if (
    previous !== undefined &&
    questionIsUnchanged(previous, status, trigger, assessment)
  ) {
    return previous;
  }

  const questionId = stableQuestionId(input.projectId, rule.key);
  const question: ClarificationQuestion = {
    id: questionId,
    organisationId: input.organisationId,
    projectId: input.projectId,
    key: rule.key,
    prompt: rule.prompt,
    rationale: `${rule.rationale} ${triggerExplanation(trigger)}`,
    answerType: rule.answerType,
    severity: rule.severity,
    blocking: rule.blocking,
    status,
    sourceContext: assessment.citations,
    createdAt: previous?.question.createdAt ?? input.now,
    updatedAt: input.now,
    version: (previous?.question.version ?? 0) + 1,
    ...(rule.options === undefined ? {} : { options: [...rule.options] }),
  };

  return {
    question,
    basisFingerprint: assessment.fingerprint,
    trigger,
    ...(previous?.answer === undefined ? {} : { answer: previous.answer }),
    ...(previous?.answerBasisFingerprint === undefined
      ? {}
      : { answerBasisFingerprint: previous.answerBasisFingerprint }),
    ...(rule.allowedUnits === undefined
      ? {}
      : { allowedUnits: rule.allowedUnits }),
  };
}

function answerCitation(
  record: ClarificationRecord,
  extractionVersion: string,
): SourceCitation | undefined {
  if (record.answer === undefined || record.question.status !== "ANSWERED") {
    return undefined;
  }
  return createSourceCitation({
    id: stableAnswerCitationId(record.answer.id),
    source: userAnswerCitationSource(record.answer),
    extractionVersion,
    explanation: `Bestätigte Antwort auf „${record.question.prompt}“`,
  });
}

function resolutionFromAssessment(
  rule: CriticalFactRule,
  assessment: FactAssessment,
): ClarificationResolution | undefined {
  if (assessment.state !== "CONFIRMED" || assessment.value === undefined) {
    return undefined;
  }
  return {
    key: rule.key,
    value:
      assessment.unit === undefined
        ? assessment.value
        : { value: String(assessment.value), unit: assessment.unit },
    citations: assessment.citations,
    resolvedBy: "EXTRACTED_FACT",
  };
}

function resolutionFromRecord(
  rule: CriticalFactRule,
  record: ClarificationRecord | undefined,
  extractionVersion: string,
): ClarificationResolution | undefined {
  if (record?.answer === undefined || record.question.status !== "ANSWERED") {
    return undefined;
  }
  const citation = answerCitation(record, extractionVersion);
  return {
    key: rule.key,
    value: record.answer.value,
    citations: citation === undefined ? [] : [citation],
    resolvedBy: "USER_ANSWER",
  };
}

function resolutionValue(
  resolutions: readonly ClarificationResolution[],
  key: CriticalFactKey,
): EffectiveValue | undefined {
  return resolutions.find((resolution) => resolution.key === key)?.value;
}

function processRule(
  rule: CriticalFactRule,
  input: EvaluateClarificationsInput,
  previousByKey: ReadonlyMap<string, ClarificationRecord>,
  records: ClarificationRecord[],
  resolutions: ClarificationResolution[],
): void {
  const assessment = assessFacts(rule, input.facts);
  const record = buildQuestionRecord(
    rule,
    assessment,
    input,
    previousByKey.get(rule.key),
  );
  if (record !== undefined) {
    records.push(record);
  }

  const resolution =
    resolutionFromRecord(rule, record, input.extractionVersion) ??
    (record === undefined
      ? resolutionFromAssessment(rule, assessment)
      : undefined);
  if (resolution !== undefined) {
    resolutions.push(resolution);
  }
}

export function evaluateClarifications(
  input: EvaluateClarificationsInput,
): ClarificationEvaluation {
  if (input.extractionVersion.trim().length === 0) {
    throw new Error("extractionVersion must not be empty");
  }
  for (const fact of input.facts) {
    if (fact.organisationId !== input.organisationId) {
      throw new Error("Cannot evaluate cross-tenant extracted facts");
    }
  }
  for (const record of input.previousRecords ?? []) {
    if (
      record.question.organisationId !== input.organisationId ||
      record.question.projectId !== input.projectId ||
      (record.answer !== undefined &&
        (record.answer.organisationId !== input.organisationId ||
          record.answer.questionId !== record.question.id))
    ) {
      throw new Error(
        "Cannot evaluate cross-tenant or cross-project clarification state",
      );
    }
  }

  const previousByKey = new Map(
    (input.previousRecords ?? []).map((record) => [
      record.question.key,
      record,
    ]),
  );
  const records: ClarificationRecord[] = [];
  const resolutions: ClarificationResolution[] = [];

  for (const rule of ALWAYS_REQUIRED_RULES) {
    processRule(rule, input, previousByKey, records, resolutions);
  }

  if (
    resolutionValue(resolutions, CRITICAL_FACT_KEYS.ceilingIncluded) === true
  ) {
    const ceilingAreaRule = CONDITIONAL_RULES.find(
      (rule) => rule.key === CRITICAL_FACT_KEYS.ceilingArea,
    );
    if (ceilingAreaRule !== undefined) {
      processRule(ceilingAreaRule, input, previousByKey, records, resolutions);
    }
  }

  if (
    resolutionValue(resolutions, CRITICAL_FACT_KEYS.substrateSound) === false
  ) {
    const remediationRule = CONDITIONAL_RULES.find(
      (rule) => rule.key === CRITICAL_FACT_KEYS.substrateRemediation,
    );
    if (remediationRule !== undefined) {
      processRule(remediationRule, input, previousByKey, records, resolutions);
    }
  }

  const ceilingResolution = resolutions.find(
    (resolution) => resolution.key === CRITICAL_FACT_KEYS.ceilingIncluded,
  );
  const exclusions: ClarificationExclusion[] =
    ceilingResolution?.value === false
      ? [
          {
            key: "ceiling.painting",
            reason:
              "Deckenanstrich ausdrücklich ausgeschlossen; die Deckenfläche wird nicht bepreist.",
            citations: ceilingResolution.citations,
          },
        ]
      : [];

  const blockingRecords = records.filter(
    (record) =>
      record.question.blocking &&
      record.question.severity === "CRITICAL" &&
      record.question.status !== "ANSWERED",
  );
  const readyForReview = blockingRecords.length === 0;

  return {
    records,
    resolutions,
    exclusions,
    readiness: {
      readyForReview,
      draftState: readyForReview ? "READY_FOR_REVIEW" : "NEEDS_CLARIFICATION",
      blockingQuestionIds: blockingRecords.map((record) => record.question.id),
      unresolvedCriticalKeys: blockingRecords.map(
        (record) => record.question.key as CriticalFactKey,
      ),
    },
  };
}

function normaliseQuantity(
  value: unknown,
  allowedUnits: readonly Unit[] | undefined,
): Quantity {
  if (
    typeof value !== "object" ||
    value === null ||
    !("value" in value) ||
    !("unit" in value) ||
    typeof value.value !== "string" ||
    typeof value.unit !== "string"
  ) {
    throw new ClarificationAnswerError(
      "INVALID_QUANTITY",
      "A quantity answer requires a decimal string and unit",
    );
  }
  const decimal = value.value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(decimal) || /^0+(?:\.0+)?$/.test(decimal)) {
    throw new ClarificationAnswerError(
      "INVALID_QUANTITY",
      "Quantity must be a positive decimal value",
    );
  }
  const unit = value.unit as Unit;
  if (allowedUnits !== undefined && !allowedUnits.includes(unit)) {
    throw new ClarificationAnswerError(
      "UNSUPPORTED_UNIT",
      "Quantity unit is not allowed for this question",
    );
  }
  return { value: decimal, unit };
}

function normaliseAnswer(
  record: ClarificationRecord,
  value: unknown,
): ClarificationAnswer["value"] {
  switch (record.question.answerType) {
    case "BOOLEAN":
      if (typeof value !== "boolean") {
        throw new ClarificationAnswerError(
          "INVALID_BOOLEAN",
          "Boolean question requires Ja or Nein",
        );
      }
      return value;
    case "SINGLE_CHOICE":
      if (
        typeof value !== "string" ||
        record.question.options === undefined ||
        !record.question.options.includes(value)
      ) {
        throw new ClarificationAnswerError(
          "INVALID_OPTION",
          "Answer is not one of the allowed options",
        );
      }
      return value;
    case "TEXT": {
      if (typeof value !== "string") {
        throw new ClarificationAnswerError(
          "INVALID_TEXT",
          "Text question requires a text answer",
        );
      }
      const text = value.trim();
      if (text.length === 0 || text.length > 1000) {
        throw new ClarificationAnswerError(
          "INVALID_TEXT",
          "Text answer must contain between 1 and 1000 characters",
        );
      }
      return text;
    }
    case "QUANTITY":
      return normaliseQuantity(value, record.allowedUnits);
  }
}

export function applyClarificationAnswer(
  input: ApplyClarificationAnswerInput,
): ClarificationRecord {
  if (
    input.record.question.status !== "OPEN" &&
    input.record.question.status !== "STALE" &&
    input.record.question.status !== "ANSWERED"
  ) {
    throw new ClarificationAnswerError(
      "QUESTION_NOT_ANSWERABLE",
      "Question cannot be answered in its current state",
    );
  }

  const value = normaliseAnswer(input.record, input.value);
  const previousAnswer = input.record.answer;
  const answer: ClarificationAnswer = {
    id: previousAnswer?.id ?? input.answerId,
    organisationId: input.record.question.organisationId,
    questionId: input.record.question.id,
    answeredByUserId: input.answeredByUserId,
    value,
    createdAt: previousAnswer?.createdAt ?? input.now,
    updatedAt: input.now,
    version: (previousAnswer?.version ?? 0) + 1,
  };

  return {
    ...input.record,
    question: {
      ...input.record.question,
      status: "ANSWERED",
      updatedAt: input.now,
      version: input.record.question.version + 1,
    },
    answer,
    answerBasisFingerprint: input.record.basisFingerprint,
  };
}
