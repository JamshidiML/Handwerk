"use client";

import type {
  ClarificationAnswer,
  EntityId,
  HumanApproval,
  IsoDateTime,
  OrganisationId,
  OfferDraft,
  OfferDraftRevision,
  OfferLine,
  Quantity,
  SourceCitation,
} from "@handwerk/contracts";
import {
  applyQuantityEdit,
  approveCurrentRevision,
  buildApprovedOfferViewModel,
  calculateLineAmounts,
  renderOfferCsv,
  renderOfferPdf,
} from "@handwerk/exports/browser";
import { MediaError } from "@handwerk/media/browser";
import { SYNTHETIC_MALER_ITEMS } from "@handwerk/pricebook/browser";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  CaptureWorkspace,
  type CaptureUploadHandler,
} from "@/src/features/capture";
import {
  ClarificationPanel,
  type ClarificationViewRecord,
} from "@/src/features/clarifications";
import { OfferReview } from "@/src/features/offer-review";
import {
  PrivacyControls,
  type PrivacyDeletionResult,
} from "@/src/features/privacy";
import { useDemoData } from "@/src/features/customers-projects/demo-data-provider";
import type { ProjectFeatureSlotProps } from "@/src/features/customers-projects/integration-slots";

type ActivityKind =
  | "Erfassung erstellt"
  | "Analyse abgeschlossen"
  | "Zuordnung abgeschlossen"
  | "Rückfrage beantwortet"
  | "Entwurf bearbeitet"
  | "Entwurf freigegeben"
  | "Export erstellt"
  | "Projektdatenexport erstellt"
  | "Demo-Löschung bestätigt";

interface Activity {
  id: string;
  label: ActivityKind;
}

interface WorkflowContextValue {
  activities: readonly Activity[];
  addActivity: (label: ActivityKind) => void;
  approval?: HumanApproval;
  approve: () => Promise<void>;
  draft: OfferDraft;
  exportCurrentRevision: (kind: "PDF" | "CSV") => Promise<void>;
  markAnalysisComplete: () => void;
  analysisComplete: boolean;
  analysisError?: string;
  analysisNotice?: string;
  recordTranscript: (text: string) => void;
  records: readonly ClarificationViewRecord[];
  revision: OfferDraftRevision;
  updateAnswer: (
    questionId: EntityId,
    value: string | boolean | Quantity,
  ) => void;
  updateQuantity: (lineId: EntityId, value: string) => Promise<void>;
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

const fixtureTime = "2026-08-12T09:30:00.000Z" as IsoDateTime;

const SYNTHETIC_EXPORT_RETRY_MARKER = "SYNTHETIC_EXPORT_RETRY";
const SYNTHETIC_INVALID_EXTRACTION_MARKER = "SYNTHETIC_INVALID_EXTRACTION";
const SYNTHETIC_UNKNOWN_MAPPING_MARKER = "SYNTHETIC_UNKNOWN_MAPPING";
const SYNTHETIC_UPLOAD_RETRY_FILENAME = "synthetic-evidence-retry.png";

function includesPromptInjection(text: string): boolean {
  return /ignore\s+(all\s+)?previous\s+instructions/i.test(text);
}

function asEntityId(value: string): EntityId {
  return value as EntityId;
}

function asOrganisationId(value: string): OrganisationId {
  return value as OrganisationId;
}

function source(
  organisationId: SourceCitation["organisationId"],
  input: Pick<
    SourceCitation,
    "id" | "sourceEntityId" | "sourceType" | "locator" | "explanation"
  >,
): SourceCitation {
  return {
    ...input,
    organisationId,
    extractionVersion: "handwerk-synthetic-v1",
    authority: "AUTHORITATIVE",
  };
}

function offerLine(input: {
  citation: SourceCitation;
  description: string;
  id: string;
  itemCode: string;
  organisationId: OfferDraft["organisationId"];
  priceBookItemId: EntityId;
  quantity: OfferLine["quantity"];
  unitPriceMinor: number;
}): OfferLine {
  const amounts = calculateLineAmounts(
    input.quantity,
    { currency: "EUR", minor: input.unitPriceMinor },
    1_900,
  );
  return {
    id: asEntityId(input.id),
    organisationId: input.organisationId,
    priceBookItemId: input.priceBookItemId,
    itemCode: input.itemCode,
    description: input.description,
    quantity: input.quantity,
    unitPrice: { currency: "EUR", minor: input.unitPriceMinor },
    ...amounts,
    taxCategory: "STANDARD_19",
    taxRateBasisPoints: 1_900,
    citations: [input.citation],
    risk: "CONFIRMED",
    origin: "GENERATED",
  };
}

function totals(lines: readonly OfferLine[]) {
  return lines.reduce(
    (current, line) => ({
      gross: current.gross + line.grossTotal.minor,
      net: current.net + line.netTotal.minor,
      tax: current.tax + line.taxTotal.minor,
    }),
    { gross: 0, net: 0, tax: 0 },
  );
}

function createWorkflowState(input: {
  organisationId: OfferDraft["organisationId"];
  projectId: EntityId;
  userId: HumanApproval["approvedByUserId"];
}) {
  const wall = SYNTHETIC_MALER_ITEMS.find(
    (item) => item.code === "MAL-WAND-2X",
  );
  const frame = SYNTHETIC_MALER_ITEMS.find(
    (item) => item.code === "SCHUTZ-ZARGE",
  );
  if (!wall || !frame)
    throw new Error("Synthetisches Preisbuch unvollständig.");

  const wallCitation = source(input.organisationId, {
    id: asEntityId("citation-synthetic-wall-measurement"),
    sourceEntityId: asEntityId("measurement-synthetic-wall-52"),
    sourceType: "EXPLICIT_MEASUREMENT",
    locator: "measurement:wall-area:52-m2",
    explanation: "Explizit erfasste und bestätigte Wandfläche von 52 m².",
  });
  const frameCitation = source(input.organisationId, {
    id: asEntityId("citation-synthetic-frames-transcript"),
    sourceEntityId: asEntityId("transcript-synthetic-segment-2"),
    sourceType: "TRANSCRIPT_SEGMENT",
    locator: "transcript:segment:2:door-frames",
    explanation: "Synthetische Sprachnotiz nennt zwei zu schützende Türzargen.",
  });
  const lines = [
    offerLine({
      citation: wallCitation,
      description: wall.description,
      id: "offer-line-synthetic-wall",
      itemCode: wall.code,
      organisationId: input.organisationId,
      priceBookItemId: wall.id,
      quantity: { value: "52", unit: "M2" },
      unitPriceMinor: wall.unitPrice.minor,
    }),
    offerLine({
      citation: frameCitation,
      description: frame.description,
      id: "offer-line-synthetic-frames",
      itemCode: frame.code,
      organisationId: input.organisationId,
      priceBookItemId: frame.id,
      quantity: { value: "2", unit: "STK" },
      unitPriceMinor: frame.unitPrice.minor,
    }),
  ];
  const amount = totals(lines);
  const draftId = asEntityId("offer-synthetic-westblick");
  const draft: OfferDraft = {
    id: draftId,
    organisationId: input.organisationId,
    projectId: input.projectId,
    state: "READY_FOR_REVIEW",
    currentRevision: 1,
    createdAt: fixtureTime,
    updatedAt: fixtureTime,
    version: 1,
  };
  const revision: OfferDraftRevision = {
    id: asEntityId("offer-revision-synthetic-1"),
    organisationId: input.organisationId,
    offerDraftId: draftId,
    revision: 1,
    lines,
    excludedItems: [
      {
        key: "Deckenfläche 20 m²",
        reason: "Bis zur expliziten Antwort nicht bepreist.",
        citations: [],
      },
    ],
    unmatchedItems: [
      {
        key: "Beschädigte Sockelleiste",
        reason: "Kein aktiver, freigegebener Preisbuch-Eintrag vorhanden.",
        citations: [],
      },
    ],
    netTotal: { currency: "EUR", minor: amount.net },
    taxTotal: { currency: "EUR", minor: amount.tax },
    grossTotal: { currency: "EUR", minor: amount.gross },
    createdByUserId: input.userId,
    createdAt: fixtureTime,
    updatedAt: fixtureTime,
    version: 1,
  };
  const records: ClarificationViewRecord[] = [
    {
      question: {
        id: asEntityId("question-synthetic-ceiling"),
        organisationId: input.organisationId,
        projectId: input.projectId,
        key: "ceiling.included",
        prompt: "Soll die Decke mitgestrichen werden?",
        rationale: "Die Deckenfläche ist erfasst, die Beauftragung aber offen.",
        answerType: "BOOLEAN",
        severity: "CRITICAL",
        blocking: true,
        status: "OPEN",
        sourceContext: [
          source(input.organisationId, {
            id: asEntityId("citation-synthetic-ceiling-measurement"),
            sourceEntityId: asEntityId("measurement-synthetic-ceiling-20"),
            sourceType: "EXPLICIT_MEASUREMENT",
            locator: "measurement:ceiling-area:20-m2",
            explanation:
              "Explizite Deckenmessung; Umfang wurde nicht bestätigt.",
          }),
        ],
        createdAt: fixtureTime,
        updatedAt: fixtureTime,
        version: 1,
      },
    },
    {
      question: {
        id: asEntityId("question-synthetic-substrate"),
        organisationId: input.organisationId,
        projectId: input.projectId,
        key: "substrate.sound",
        prompt:
          "Ist der Untergrund tragfähig und ohne zusätzliche Ausbesserung?",
        rationale:
          "Fotos zeigen nur Kontext; der Zustand benötigt eine menschliche Bestätigung.",
        answerType: "BOOLEAN",
        severity: "CRITICAL",
        blocking: true,
        status: "OPEN",
        sourceContext: [
          source(input.organisationId, {
            id: asEntityId("citation-synthetic-substrate-transcript"),
            sourceEntityId: asEntityId("transcript-synthetic-segment-3"),
            sourceType: "TRANSCRIPT_SEGMENT",
            locator: "transcript:segment:3:substrate",
            explanation:
              "Die synthetische Notiz hält den Zustand bewusst offen.",
          }),
        ],
        createdAt: fixtureTime,
        updatedAt: fixtureTime,
        version: 1,
      },
    },
  ];
  return { draft, records, revision };
}

function download(bytes: Uint8Array, filename: string, type: string) {
  const blob = new Blob([bytes.slice().buffer], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function IntegratedWorkflowProvider({
  children,
}: {
  children: ReactNode;
}) {
  const workspace = useDemoData();
  const initial = useMemo(
    () =>
      createWorkflowState({
        organisationId: asOrganisationId(workspace.organisation.id),
        projectId: asEntityId("project-wohnzimmer-bochum"),
        userId: workspace.user.id,
      }),
    [workspace.organisation.id, workspace.user.id],
  );
  const [draft, setDraft] = useState(initial.draft);
  const [revision, setRevision] = useState(initial.revision);
  const [approval, setApproval] = useState<HumanApproval>();
  const [records, setRecords] = useState(initial.records);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analysisError, setAnalysisError] = useState<string>();
  const [analysisNotice, setAnalysisNotice] = useState<string>();
  const [transcript, setTranscript] = useState("");
  const [exportFailureConsumed, setExportFailureConsumed] = useState(false);
  const [activities, setActivities] = useState<readonly Activity[]>([]);

  function addActivity(label: ActivityKind) {
    setActivities((current) => [
      ...current,
      { id: `${current.length + 1}-${label}`, label },
    ]);
  }

  const unresolvedCriticalQuestionIds = records
    .filter(
      (record) =>
        record.question.blocking && record.question.status !== "ANSWERED",
    )
    .map((record) => record.question.id);

  function updateAnswer(
    questionId: EntityId,
    value: string | boolean | Quantity,
  ) {
    setRecords((current) =>
      current.map((record) => {
        if (record.question.id !== questionId) return record;
        const answer: ClarificationAnswer = {
          id: asEntityId(`answer-${questionId}`),
          organisationId: record.question.organisationId,
          questionId,
          answeredByUserId: workspace.user.id,
          value,
          createdAt: fixtureTime,
          updatedAt: fixtureTime,
          version: 1,
        };
        return {
          ...record,
          answer,
          question: { ...record.question, status: "ANSWERED" },
        };
      }),
    );
    addActivity("Rückfrage beantwortet");
  }

  async function updateQuantity(lineId: EntityId, value: string) {
    const result = applyQuantityEdit({
      draft,
      revision,
      ...(approval ? { approval } : {}),
      lineId,
      quantityValue: value,
      revisionId: asEntityId(
        `offer-revision-synthetic-${revision.revision + 1}`,
      ),
      createdByUserId: workspace.user.id,
      editedAt: fixtureTime,
    });
    if (!result.changed) return;
    setDraft(result.draft);
    setRevision(result.revision);
    setApproval(result.invalidatedApproval);
    addActivity("Entwurf bearbeitet");
  }

  async function approve() {
    const result = approveCurrentRevision({
      draft,
      revision,
      unresolvedCriticalQuestionIds,
      confirmed: true,
      approvalId: asEntityId(`approval-synthetic-${revision.revision}`),
      approvedByUserId: workspace.user.id,
      approvedAt: fixtureTime,
    });
    setDraft(result.draft);
    setApproval(result.approval);
    addActivity("Entwurf freigegeben");
  }

  async function exportCurrentRevision(kind: "PDF" | "CSV") {
    if (
      transcript.includes(SYNTHETIC_EXPORT_RETRY_MARKER) &&
      !exportFailureConsumed
    ) {
      setExportFailureConsumed(true);
      throw new Error(
        "Der synthetische Exportdienst ist vorübergehend nicht verfügbar.",
      );
    }
    const model = buildApprovedOfferViewModel({
      draft,
      revision,
      ...(approval ? { approval } : {}),
      unresolvedCriticalQuestionIds,
      organisationName: workspace.organisation.name,
      recipientName: "Anna Becker (synthetisch)",
      projectName: "Wohnzimmer renovieren",
      projectLocation: "Bochum - synthetisches Projekt",
      offerNumber: `SYN-WB-2026-${String(revision.revision).padStart(4, "0")}`,
      issuedAt: fixtureTime,
      notes: ["Ausschließlich synthetische Demo-Daten."],
      synthetic: true,
      artifactIds: {
        pdf: asEntityId(`export-pdf-synthetic-${revision.revision}`),
        csv: asEntityId(`export-csv-synthetic-${revision.revision}`),
      },
    });
    if (kind === "PDF") {
      download(
        await renderOfferPdf(model),
        `Angebot-${model.offerNumber}.pdf`,
        "application/pdf",
      );
    } else {
      download(
        renderOfferCsv(model),
        `Angebot-${model.offerNumber}.csv`,
        "text/csv;charset=utf-8",
      );
    }
    addActivity("Export erstellt");
  }

  function recordTranscript(text: string) {
    setTranscript(text);
  }

  function markAnalysisComplete() {
    setAnalysisError(undefined);
    setAnalysisNotice(undefined);
    if (transcript.includes(SYNTHETIC_INVALID_EXTRACTION_MARKER)) {
      setAnalysisComplete(false);
      setAnalysisError(
        "Die Analyse wurde sicher abgebrochen: Das Extraktionsergebnis ist ungültig.",
      );
      return;
    }
    if (transcript.includes(SYNTHETIC_UNKNOWN_MAPPING_MARKER)) {
      setRevision((current) => {
        if (
          current.unmatchedItems.some(
            (item) => item.key === "SYNTHETIC-UNAPPROVED-999",
          )
        ) {
          return current;
        }
        return {
          ...current,
          unmatchedItems: [
            ...current.unmatchedItems,
            {
              key: "SYNTHETIC-UNAPPROVED-999",
              reason:
                "Keine aktive, freigegebene Preisbuchposition; bleibt unbepreist.",
              citations: [],
            },
          ],
        };
      });
    }
    if (includesPromptInjection(transcript)) {
      setAnalysisNotice(
        "Quellinhalt wird als Daten behandelt; Anweisungen werden nicht ausgeführt.",
      );
    }
    setAnalysisComplete(true);
    addActivity("Analyse abgeschlossen");
    addActivity("Zuordnung abgeschlossen");
  }

  const value: WorkflowContextValue = {
    activities,
    addActivity,
    approval,
    approve,
    draft,
    exportCurrentRevision,
    markAnalysisComplete,
    analysisComplete,
    ...(analysisError ? { analysisError } : {}),
    ...(analysisNotice ? { analysisNotice } : {}),
    recordTranscript,
    records,
    revision,
    updateAnswer,
    updateQuantity,
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}

function useIntegratedWorkflow() {
  const value = useContext(WorkflowContext);
  if (!value) throw new Error("Integrated workflow provider is missing.");
  return value;
}

const syntheticUploadAttempts = new Map<string, number>();

const localUpload: CaptureUploadHandler = async (file, options) => {
  for (const percent of [20, 65]) {
    if (options.signal.aborted)
      throw new DOMException("Abgebrochen", "AbortError");
    options.onProgress(percent);
  }
  const attempts = syntheticUploadAttempts.get(file.name) ?? 0;
  if (file.name === SYNTHETIC_UPLOAD_RETRY_FILENAME && attempts === 0) {
    syntheticUploadAttempts.set(file.name, attempts + 1);
    throw new MediaError(
      "STORAGE_TRANSIENT",
      "Synthetic retry fixture requests one transient failure.",
    );
  }
  options.onProgress(100);
  return {
    evidenceAssetId: asEntityId("evidence-synthetic-upload"),
    status: "STORED",
  };
};

export function CaptureWorkflowFeature({
  project,
  siteVisit,
}: ProjectFeatureSlotProps) {
  const workflow = useIntegratedWorkflow();
  const workspace = useDemoData();
  const siteVisitId =
    siteVisit?.id ?? asEntityId(`visit-synthetic-${project.id}`);

  return (
    <section aria-labelledby="capture-workflow-title">
      <div className="section-heading simple">
        <div>
          <span className="eyebrow">Schritt 1</span>
          <h2 id="capture-workflow-title">Erfassung und Analyse</h2>
        </div>
      </div>
      <CaptureWorkspace
        siteVisitId={siteVisitId}
        userId={workspace.user.id}
        audio={{
          onTranscriptFallback: (draft) => {
            workflow.recordTranscript(draft.text);
            workflow.addActivity("Erfassung erstellt");
          },
          onUpload: localUpload,
          onAudioCaptured: () => workflow.addActivity("Erfassung erstellt"),
        }}
        photo={{
          onUpload: localUpload,
          onPhotoCaptured: () => workflow.addActivity("Erfassung erstellt"),
        }}
        measurement={{
          onAdd: () => workflow.addActivity("Erfassung erstellt"),
        }}
      />
      <div className="workflow-panel">
        <p>
          Die Analyse verwendet ausschließlich den deterministischen
          synthetischen Datenpfad. Fotos bleiben Kontext und können keine
          Messwerte erzeugen.
        </p>
        <button
          className="button"
          onClick={workflow.markAnalysisComplete}
          type="button"
        >
          <Sparkles aria-hidden="true" size={18} />
          Analyse starten
        </button>
        {workflow.analysisError ? (
          <p role="alert">{workflow.analysisError}</p>
        ) : null}
        {workflow.analysisNotice ? (
          <p role="status">{workflow.analysisNotice}</p>
        ) : null}
        {workflow.analysisComplete ? (
          <Link className="button secondary" href={`/projekte/${project.id}`}>
            Entwurf prüfen
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export function ClarificationWorkflowFeature() {
  const workflow = useIntegratedWorkflow();
  const readyForReview = workflow.records.every(
    (record) =>
      !record.question.blocking || record.question.status === "ANSWERED",
  );
  return (
    <section>
      <ClarificationPanel
        onAnswer={workflow.updateAnswer}
        readyForReview={readyForReview}
        records={workflow.records}
      />
      {readyForReview ? (
        <p className="synthetic-label">
          Entwurf aktualisiert: Decke bleibt ausgeschlossen.
        </p>
      ) : null}
    </section>
  );
}

export function OfferWorkflowFeature() {
  const workflow = useIntegratedWorkflow();
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string>();
  const unresolvedCriticalQuestionCount = workflow.records.filter(
    (record) =>
      record.question.blocking && record.question.status !== "ANSWERED",
  ).length;

  async function handleExport(kind: "PDF" | "CSV") {
    setExportBusy(true);
    setExportError(undefined);
    try {
      await workflow.exportCurrentRevision(kind);
    } catch {
      setExportError(
        "Der Export konnte nicht erstellt werden. Die aktuelle Revision bleibt unverändert; bitte erneut versuchen.",
      );
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <section aria-labelledby="offer-workflow-title">
      <div className="section-heading simple">
        <div>
          <span className="eyebrow">Schritt 4</span>
          <h2 id="offer-workflow-title">Angebotsentwurf</h2>
        </div>
      </div>
      <OfferReview
        approval={workflow.approval}
        busy={exportBusy}
        draft={workflow.draft}
        errorMessage={exportError}
        onApprove={workflow.approve}
        onExport={handleExport}
        onQuantityCommit={workflow.updateQuantity}
        revision={workflow.revision}
        unresolvedCriticalQuestionCount={unresolvedCriticalQuestionCount}
      />
      <section className="workflow-panel" aria-labelledby="activity-title">
        <div className="section-heading simple">
          <div>
            <span className="eyebrow">Nachvollziehbarkeit</span>
            <h2 id="activity-title">Aktivität</h2>
          </div>
        </div>
        {workflow.activities.length > 0 ? (
          <ol className="workflow-list">
            {workflow.activities.map((activity) => (
              <li data-state="done" key={activity.id}>
                <span>✓</span>
                <strong>{activity.label}</strong>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted-copy">
            Die Audit-Ansicht zeigt nur sichere, synthetische Ereignisnamen.
          </p>
        )}
      </section>
    </section>
  );
}

export function PrivacyWorkflowFeature({
  project,
  demoMode,
}: ProjectFeatureSlotProps) {
  const workflow = useIntegratedWorkflow();
  const workspace = useDemoData();

  async function exportProjectData() {
    const payload = JSON.stringify({
      projectId: project.id,
      synthetic: true,
      exportScope: "project-metadata-only",
    });
    download(
      new TextEncoder().encode(payload),
      "projekt-synthetisch.json",
      "application/json",
    );
    workflow.addActivity("Projektdatenexport erstellt");
  }

  async function requestDeletion(): Promise<PrivacyDeletionResult> {
    return {
      id: "deletion-request-synthetic" as EntityId,
      status: "CONFIRMED",
    };
  }

  async function completeDeletion(): Promise<PrivacyDeletionResult> {
    if (!workspace.deleteDemoProject(project.id)) {
      throw new Error("Das synthetische Projekt konnte nicht gelöscht werden.");
    }
    workflow.addActivity("Demo-Löschung bestätigt");
    return {
      id: "deletion-request-synthetic" as EntityId,
      status: "COMPLETED",
    };
  }

  return (
    <PrivacyControls
      demoMode={demoMode}
      onCompleteDemoDeletion={completeDeletion}
      onExportProject={exportProjectData}
      onRequestDeletion={requestDeletion}
      projectId={project.id}
      projectName={project.name}
    />
  );
}
