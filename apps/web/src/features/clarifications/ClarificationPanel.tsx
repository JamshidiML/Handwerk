"use client";

import type {
  ClarificationAnswer,
  ClarificationQuestion,
  EntityId,
  Quantity,
  SourceCitation,
  Unit,
} from "@handwerk/contracts";
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  CircleHelp,
  Info,
  PencilLine,
  Sparkles,
} from "lucide-react";
import type { FormEvent } from "react";
import styles from "./clarifications.module.css";

export type InformationState =
  | "CONFIRMED"
  | "INFERRED"
  | "EDITED"
  | "EXCLUDED"
  | "UNRESOLVED";

export interface ClarificationViewRecord {
  question: ClarificationQuestion;
  answer?: ClarificationAnswer;
  allowedUnits?: readonly Unit[];
}

export interface ClarificationPanelProps {
  records: readonly ClarificationViewRecord[];
  readyForReview: boolean;
  onAnswer?: (questionId: EntityId, value: string | boolean | Quantity) => void;
  disabled?: boolean;
}

export interface ProvenanceExplanationProps {
  citations: readonly SourceCitation[];
  state: InformationState;
  title?: string;
}

export interface ExcludedItemNoticeProps {
  title: string;
  reason: string;
  citations: readonly SourceCitation[];
}

const STATE_LABELS: Readonly<Record<InformationState, string>> = {
  CONFIRMED: "Bestätigt",
  INFERRED: "Abgeleitet",
  EDITED: "Bearbeitet",
  EXCLUDED: "Ausgeschlossen",
  UNRESOLVED: "Ungeklärt",
};

const SOURCE_LABELS: Readonly<Record<SourceCitation["sourceType"], string>> = {
  TRANSCRIPT_SEGMENT: "Sprachnotiz",
  EXPLICIT_MEASUREMENT: "Explizites Aufmaß",
  USER_ANSWER: "Nutzerantwort",
  COMPANY_RULE: "Unternehmensregel",
  PHOTO_CONTEXT: "Fotokontext",
};

function StateIcon({ state }: { state: InformationState }) {
  const iconProps = { "aria-hidden": true, size: 14, strokeWidth: 2 } as const;
  switch (state) {
    case "CONFIRMED":
      return <CheckCircle2 {...iconProps} />;
    case "INFERRED":
      return <Sparkles {...iconProps} />;
    case "EDITED":
      return <PencilLine {...iconProps} />;
    case "EXCLUDED":
      return <Ban {...iconProps} />;
    case "UNRESOLVED":
      return <AlertTriangle {...iconProps} />;
  }
}

export function InformationStateBadge({ state }: { state: InformationState }) {
  return (
    <span className={`${styles.stateBadge} ${styles[`state${state}`]}`}>
      <StateIcon state={state} />
      {STATE_LABELS[state]}
    </span>
  );
}

function answerLabel(answer: ClarificationAnswer): string {
  if (typeof answer.value === "boolean") {
    return answer.value ? "Ja" : "Nein";
  }
  if (typeof answer.value === "object") {
    return `${answer.value.value} ${answer.value.unit === "M2" ? "m²" : answer.value.unit}`;
  }
  return answer.value;
}

function parseAnswer(
  question: ClarificationQuestion,
  data: FormData,
): string | boolean | Quantity {
  const value = String(data.get("answer") ?? "");
  switch (question.answerType) {
    case "BOOLEAN":
      return value === "true";
    case "QUANTITY":
      return {
        value,
        unit: String(data.get("unit") ?? "M2") as Unit,
      };
    case "SINGLE_CHOICE":
    case "TEXT":
      return value;
  }
}

function AnswerForm({
  record,
  onAnswer,
  disabled,
}: {
  record: ClarificationViewRecord;
  onAnswer?: ClarificationPanelProps["onAnswer"];
  disabled: boolean;
}) {
  const { question } = record;
  const fieldId = `answer-${question.id}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (onAnswer === undefined) return;
    onAnswer(
      question.id,
      parseAnswer(question, new FormData(event.currentTarget)),
    );
  }

  return (
    <form className={styles.answerForm} onSubmit={submit}>
      {question.answerType === "BOOLEAN" ? (
        <fieldset className={styles.segmentedField} disabled={disabled}>
          <legend>Antwort</legend>
          <label>
            <input name="answer" type="radio" value="true" required />
            <span>Ja</span>
          </label>
          <label>
            <input name="answer" type="radio" value="false" required />
            <span>Nein</span>
          </label>
        </fieldset>
      ) : null}

      {question.answerType === "SINGLE_CHOICE" ? (
        <label className={styles.fieldLabel} htmlFor={fieldId}>
          Antwort
          <select id={fieldId} name="answer" required disabled={disabled}>
            <option value="">Bitte auswählen</option>
            {question.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {question.answerType === "TEXT" ? (
        <label className={styles.fieldLabel} htmlFor={fieldId}>
          Antwort
          <textarea
            id={fieldId}
            name="answer"
            rows={3}
            maxLength={1000}
            required
            disabled={disabled}
          />
        </label>
      ) : null}

      {question.answerType === "QUANTITY" ? (
        <div className={styles.quantityFields}>
          <label className={styles.fieldLabel} htmlFor={fieldId}>
            Wert
            <input
              id={fieldId}
              name="answer"
              type="text"
              inputMode="decimal"
              pattern="[0-9]+([,.][0-9]+)?"
              required
              disabled={disabled}
            />
          </label>
          <label className={styles.fieldLabel} htmlFor={`${fieldId}-unit`}>
            Einheit
            <select id={`${fieldId}-unit`} name="unit" disabled={disabled}>
              {(record.allowedUnits ?? ["M2"]).map((unit) => (
                <option key={unit} value={unit}>
                  {unit === "M2" ? "m²" : unit}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <button
        className={styles.submitButton}
        type="submit"
        disabled={disabled || onAnswer === undefined}
      >
        <Check aria-hidden="true" size={17} />
        Antwort übernehmen
      </button>
    </form>
  );
}

function ClarificationCard({
  record,
  onAnswer,
  disabled,
}: {
  record: ClarificationViewRecord;
  onAnswer?: ClarificationPanelProps["onAnswer"];
  disabled: boolean;
}) {
  const { question, answer } = record;
  const isAnswered = question.status === "ANSWERED" && answer !== undefined;
  const isStale = question.status === "STALE";

  return (
    <article
      className={styles.questionCard}
      data-question-key={question.key}
      data-question-status={question.status}
    >
      <div className={styles.questionHeader}>
        <div className={styles.questionIcon} aria-hidden="true">
          {isAnswered ? <CheckCircle2 /> : <CircleHelp />}
        </div>
        <div>
          <div className={styles.questionMeta}>
            <InformationStateBadge
              state={isAnswered ? "CONFIRMED" : "UNRESOLVED"}
            />
            {question.blocking && !isAnswered ? (
              <span className={styles.blockingLabel}>Prüfung blockiert</span>
            ) : null}
          </div>
          <h3>{question.prompt}</h3>
        </div>
      </div>

      <p className={styles.rationale}>{question.rationale}</p>

      {isStale ? (
        <p className={styles.staleWarning} role="alert">
          <AlertTriangle aria-hidden="true" size={17} />
          <span>
            Die Evidenz hat sich geändert. Bitte die Antwort erneut bestätigen.
            {answer === undefined ? null : (
              <>
                {" "}
                Bisherige Antwort: <strong>{answerLabel(answer)}</strong>.
              </>
            )}
          </span>
        </p>
      ) : null}

      {isAnswered ? (
        <p className={styles.answerSummary} role="status">
          <CheckCircle2 aria-hidden="true" size={17} />
          Antwort: <strong>{answerLabel(answer)}</strong>
        </p>
      ) : (
        <AnswerForm record={record} onAnswer={onAnswer} disabled={disabled} />
      )}

      {question.sourceContext.length > 0 ? (
        <ProvenanceExplanation
          citations={question.sourceContext}
          state={isAnswered ? "CONFIRMED" : "UNRESOLVED"}
          title="Warum wird das gefragt?"
        />
      ) : null}
    </article>
  );
}

export function ClarificationPanel({
  records,
  readyForReview,
  onAnswer,
  disabled = false,
}: ClarificationPanelProps) {
  const unresolvedCount = records.filter(
    (record) =>
      record.question.blocking && record.question.status !== "ANSWERED",
  ).length;

  return (
    <section className={styles.panel} aria-labelledby="clarification-heading">
      <header className={styles.panelHeader}>
        <div>
          <p className={styles.eyebrow}>Angebotsgrundlage</p>
          <h2 id="clarification-heading">Klärungen</h2>
        </div>
        <InformationStateBadge
          state={readyForReview ? "CONFIRMED" : "UNRESOLVED"}
        />
      </header>

      <div
        className={readyForReview ? styles.readyNotice : styles.blockedNotice}
        role="status"
        aria-live="polite"
      >
        {readyForReview ? (
          <CheckCircle2 aria-hidden="true" />
        ) : (
          <AlertTriangle aria-hidden="true" />
        )}
        <div>
          <strong>
            {readyForReview
              ? "Bereit zur Prüfung"
              : "Noch nicht bereit zur Prüfung"}
          </strong>
          <span>
            {readyForReview
              ? "Alle kritischen Angaben sind geklärt."
              : `${unresolvedCount} kritische ${
                  unresolvedCount === 1 ? "Angabe ist" : "Angaben sind"
                } offen.`}
          </span>
        </div>
      </div>

      <div className={styles.questionList}>
        {records.map((record) => (
          <ClarificationCard
            key={record.question.id}
            record={record}
            onAnswer={onAnswer}
            disabled={disabled}
          />
        ))}
      </div>
    </section>
  );
}

export function ProvenanceExplanation({
  citations,
  state,
  title = "Warum diese Position?",
}: ProvenanceExplanationProps) {
  return (
    <details className={styles.provenance}>
      <summary>
        <Info aria-hidden="true" size={17} />
        <span>{title}</span>
        <InformationStateBadge state={state} />
      </summary>
      {citations.length === 0 ? (
        <p className={styles.missingProvenance} role="alert">
          Keine gültige Quelle vorhanden. Die Position bleibt ungeklärt.
        </p>
      ) : (
        <ul className={styles.citationList}>
          {citations.map((citation) => (
            <li key={citation.id}>
              <div>
                <strong>{SOURCE_LABELS[citation.sourceType]}</strong>
                <span>
                  {citation.authority === "AUTHORITATIVE"
                    ? "Maßgebliche Quelle"
                    : "Nur Kontext"}
                </span>
              </div>
              <p>{citation.explanation}</p>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

export function ExcludedItemNotice({
  title,
  reason,
  citations,
}: ExcludedItemNoticeProps) {
  return (
    <section className={styles.excludedNotice} aria-label={title}>
      <div className={styles.excludedHeader}>
        <Ban aria-hidden="true" size={19} />
        <strong>{title}</strong>
        <InformationStateBadge state="EXCLUDED" />
      </div>
      <p>{reason}</p>
      <ProvenanceExplanation citations={citations} state="EXCLUDED" />
    </section>
  );
}
