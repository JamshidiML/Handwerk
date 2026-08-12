import type {
  ClarificationAnswer,
  ClarificationQuestion,
  EntityId,
  IsoDateTime,
  OrganisationId,
  SourceCitation,
  UserId,
} from "@handwerk/contracts";
import { CANONICAL_QUESTIONS } from "@handwerk/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ClarificationPanel,
  ExcludedItemNotice,
  InformationStateBadge,
  ProvenanceExplanation,
  type ClarificationViewRecord,
  type InformationState,
} from "./ClarificationPanel";

const organisationId = "org-westblick" as OrganisationId;
const projectId = "project-wohnzimmer-bochum" as EntityId;
const userId = "user-demo" as UserId;
const now = "2026-08-12T10:00:00.000Z" as IsoDateTime;

function question(
  key: string,
  prompt: string,
  status: ClarificationQuestion["status"] = "OPEN",
): ClarificationQuestion {
  return {
    id: `question-${key}` as EntityId,
    organisationId,
    projectId,
    key,
    prompt,
    rationale: "Diese kritische Angabe muss ausdrücklich geklärt werden.",
    answerType: "BOOLEAN",
    severity: "CRITICAL",
    blocking: true,
    status,
    sourceContext: [],
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function answer(
  target: ClarificationQuestion,
  value: boolean,
): ClarificationAnswer {
  return {
    id: `answer-${target.key}` as EntityId,
    organisationId,
    questionId: target.id,
    answeredByUserId: userId,
    value,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

const answerCitation: SourceCitation = {
  id: "citation-answer-ceiling" as EntityId,
  organisationId,
  sourceType: "USER_ANSWER",
  sourceEntityId: "answer-ceiling" as EntityId,
  locator: "answer:answer-ceiling:question:question-ceiling",
  extractionVersion: "deterministic-v1",
  explanation: "Deckenanstrich wurde mit Nein beantwortet.",
  authority: "AUTHORITATIVE",
};

describe("ClarificationPanel", () => {
  it("renders the canonical blocking questions with native Ja/Nein controls", () => {
    const records: ClarificationViewRecord[] = [
      {
        question: question("ceiling", CANONICAL_QUESTIONS.ceiling),
      },
      {
        question: question("substrate", CANONICAL_QUESTIONS.substrate),
      },
    ];

    const html = renderToStaticMarkup(
      <ClarificationPanel
        records={records}
        readyForReview={false}
        onAnswer={() => undefined}
      />,
    );

    expect(html).toContain(CANONICAL_QUESTIONS.ceiling);
    expect(html).toContain(CANONICAL_QUESTIONS.substrate);
    expect(html).toContain("Noch nicht bereit zur Prüfung");
    expect(html).toContain("2 kritische Angaben sind offen");
    expect(html.match(/type="radio"/g)).toHaveLength(4);
    expect(html).toContain("Prüfung blockiert");
  });

  it("announces readiness and formats answered boolean values", () => {
    const ceiling = question(
      "ceiling",
      CANONICAL_QUESTIONS.ceiling,
      "ANSWERED",
    );
    const html = renderToStaticMarkup(
      <ClarificationPanel
        records={[{ question: ceiling, answer: answer(ceiling, false) }]}
        readyForReview
      />,
    );

    expect(html).toContain("Bereit zur Prüfung");
    expect(html).toContain("Antwort: <strong>Nein</strong>");
    expect(html).toContain("Bestätigt");
    expect(html).not.toContain("Prüfung blockiert");
  });

  it("keeps stale answers visibly unresolved", () => {
    const stale = question("substrate", CANONICAL_QUESTIONS.substrate, "STALE");
    const html = renderToStaticMarkup(
      <ClarificationPanel
        records={[{ question: stale, answer: answer(stale, true) }]}
        readyForReview={false}
      />,
    );

    expect(html).toContain("Die Evidenz hat sich geändert");
    expect(html).toContain("Bisherige Antwort: <strong>Ja</strong>");
    expect(html).toContain('data-question-status="STALE"');
    expect(html).toContain("Ungeklärt");
  });
});

describe("provenance presentation", () => {
  it("renders the required Warum explanation and source authority", () => {
    const html = renderToStaticMarkup(
      <ProvenanceExplanation citations={[answerCitation]} state="CONFIRMED" />,
    );

    expect(html).toContain("Warum diese Position?");
    expect(html).toContain("Nutzerantwort");
    expect(html).toContain("Maßgebliche Quelle");
    expect(html).toContain(answerCitation.explanation);
  });

  it("shows a blocking message when provenance is absent", () => {
    const html = renderToStaticMarkup(
      <ProvenanceExplanation citations={[]} state="UNRESOLVED" />,
    );
    expect(html).toContain("Keine gültige Quelle vorhanden");
    expect(html).toContain('role="alert"');
  });

  it("visually labels every required information state", () => {
    const states: InformationState[] = [
      "CONFIRMED",
      "INFERRED",
      "EDITED",
      "EXCLUDED",
      "UNRESOLVED",
    ];
    const html = renderToStaticMarkup(
      <>
        {states.map((state) => (
          <InformationStateBadge key={state} state={state} />
        ))}
      </>,
    );

    for (const label of [
      "Bestätigt",
      "Abgeleitet",
      "Bearbeitet",
      "Ausgeschlossen",
      "Ungeklärt",
    ]) {
      expect(html).toContain(label);
    }
  });

  it("presents the ceiling exclusion with its answer citation", () => {
    const html = renderToStaticMarkup(
      <ExcludedItemNotice
        title="Deckenanstrich"
        reason="Deckenanstrich ausdrücklich ausgeschlossen; die Deckenfläche wird nicht bepreist."
        citations={[answerCitation]}
      />,
    );

    expect(html).toContain("Deckenanstrich");
    expect(html).toContain("Ausgeschlossen");
    expect(html).toContain("Warum diese Position?");
    expect(html).toContain("Nutzerantwort");
  });
});
