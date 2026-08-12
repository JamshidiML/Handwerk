"use client";

import type {
  EntityId,
  HumanApproval,
  OfferDraft,
  OfferDraftRevision,
  OfferLine,
} from "@handwerk/contracts";
import {
  Ban,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  Link2,
  Pencil,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { getOfferReviewControlState } from "./model";
import styles from "./offer-review.module.css";

const CONFIRMATION_TEXT =
  "Ich habe Umfang, Mengen, Preise und Ausschlüsse der aktuellen Revision geprüft.";

export interface OfferReviewRevisionSummary {
  fromRevision: number;
  toRevision: number;
  hasCommercialChanges: boolean;
  changes: readonly { summary: string }[];
  netDeltaMinor: number;
  taxDeltaMinor: number;
  grossDeltaMinor: number;
}

export interface OfferReviewApprovalRequest {
  revision: number;
  confirmed: true;
  confirmationText: typeof CONFIRMATION_TEXT;
}

export interface OfferReviewProps {
  draft: OfferDraft;
  revision: OfferDraftRevision;
  approval?: HumanApproval;
  unresolvedCriticalQuestionCount: number;
  revisionSummary?: OfferReviewRevisionSummary;
  busy?: boolean;
  errorMessage?: string;
  onQuantityCommit: (
    lineId: EntityId,
    quantityValue: string,
  ) => void | Promise<void>;
  onApprove: (request: OfferReviewApprovalRequest) => void | Promise<void>;
  onExport: (kind: "PDF" | "CSV") => void | Promise<void>;
}

const moneyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function money(minor: number): string {
  return moneyFormatter.format(minor / 100);
}

function unit(unitCode: string): string {
  return (
    {
      M2: "m²",
      M: "m",
      STK: "Stk.",
      STD: "Std.",
      PAUSCHALE: "pauschal",
    }[unitCode] ?? unitCode
  );
}

const riskLabel = {
  CONFIRMED: "Bestätigt",
  LOW_RISK: "Niedriges Risiko",
  NEEDS_REVIEW: "Prüfen",
  BLOCKING: "Blockierend",
} as const;

const originLabel = {
  GENERATED: "Vorgeschlagen",
  EDITED: "Bearbeitet",
  CONFIRMED: "Menschlich bestätigt",
} as const;

function LineReview({
  line,
  disabled,
  onQuantityCommit,
}: {
  line: OfferLine;
  disabled: boolean;
  onQuantityCommit: OfferReviewProps["onQuantityCommit"];
}) {
  const [quantity, setQuantity] = useState(line.quantity.value);
  const [editError, setEditError] = useState<string>();

  const commit = async () => {
    if (quantity === line.quantity.value) return;
    try {
      setEditError(undefined);
      await onQuantityCommit(line.id, quantity);
    } catch (error) {
      setEditError(
        error instanceof Error
          ? error.message
          : "Menge konnte nicht geändert werden.",
      );
    }
  };

  return (
    <article className={styles.lineItem}>
      <div className={styles.lineHeading}>
        <div>
          <span className={styles.itemCode}>{line.itemCode}</span>
          <h3>{line.description}</h3>
        </div>
        <div className={styles.badges} aria-label="Prüfstatus">
          <span className={styles[`risk${line.risk}`]}>
            {riskLabel[line.risk]}
          </span>
          <span className={styles.origin}>{originLabel[line.origin]}</span>
        </div>
      </div>

      <dl className={styles.commercialGrid}>
        <div>
          <dt>Menge</dt>
          <dd className={styles.quantityField}>
            <input
              aria-label={`Menge für ${line.itemCode}`}
              disabled={disabled}
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              onBlur={commit}
            />
            <span>{unit(line.quantity.unit)}</span>
          </dd>
        </div>
        <div>
          <dt>Einheitspreis</dt>
          <dd>{money(line.unitPrice.minor)}</dd>
        </div>
        <div>
          <dt>Netto</dt>
          <dd>{money(line.netTotal.minor)}</dd>
        </div>
        <div>
          <dt>Steuer</dt>
          <dd>
            {(line.taxRateBasisPoints / 100).toLocaleString("de-DE")} % /{" "}
            {money(line.taxTotal.minor)}
          </dd>
        </div>
        <div>
          <dt>Brutto</dt>
          <dd className={styles.strongValue}>{money(line.grossTotal.minor)}</dd>
        </div>
      </dl>

      <p className={styles.calculation}>
        <Pencil aria-hidden="true" size={14} />
        {line.calculation}
      </p>
      {editError ? <p className={styles.fieldError}>{editError}</p> : null}

      <details className={styles.provenance}>
        <summary>
          <Link2 aria-hidden="true" size={15} />
          Warum diese Position?
        </summary>
        <ul>
          {line.citations.map((citation) => (
            <li key={citation.id}>
              <strong>{citation.sourceType.replaceAll("_", " ")}</strong>
              <span>{citation.explanation}</span>
              <small>{citation.locator}</small>
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}

function ApprovalPanel({
  revision,
  canApprove,
  blockReason,
  busy,
  onApprove,
}: {
  revision: number;
  canApprove: boolean;
  blockReason?: string;
  busy: boolean;
  onApprove: OfferReviewProps["onApprove"];
}) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <section className={styles.approvalPanel} aria-labelledby="approval-title">
      <div className={styles.sectionHeading}>
        <ShieldCheck aria-hidden="true" size={20} />
        <div>
          <h2 id="approval-title">Freigabe Revision {revision}</h2>
          <p>Prüfung durch einen Menschen erforderlich</p>
        </div>
      </div>
      <label className={styles.confirmation}>
        <input
          type="checkbox"
          checked={confirmed}
          disabled={!canApprove || busy}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span>{CONFIRMATION_TEXT}</span>
      </label>
      {blockReason ? <p className={styles.blockReason}>{blockReason}</p> : null}
      <button
        className={styles.primaryButton}
        disabled={!canApprove || !confirmed || busy}
        type="button"
        onClick={() =>
          onApprove({
            revision,
            confirmed: true,
            confirmationText: CONFIRMATION_TEXT,
          })
        }
      >
        <Check aria-hidden="true" size={17} />
        Revision freigeben
      </button>
    </section>
  );
}

export function OfferReview({
  draft,
  revision,
  approval,
  unresolvedCriticalQuestionCount,
  revisionSummary,
  busy = false,
  errorMessage,
  onQuantityCommit,
  onApprove,
  onExport,
}: OfferReviewProps) {
  const control = getOfferReviewControlState({
    draft,
    revision,
    ...(approval ? { approval } : {}),
    unresolvedCriticalQuestionCount,
  });
  const approvalStatus = {
    MISSING: "Nicht freigegeben",
    STALE: "Freigabe veraltet",
    INVALIDATED: "Freigabe ungültig",
    CURRENT: "Aktuelle Revision freigegeben",
  }[control.approvalState];

  return (
    <main className={styles.review}>
      <header className={styles.reviewHeader}>
        <div>
          <p className={styles.eyebrow}>Angebotsprüfung</p>
          <h1>Revision {revision.revision}</h1>
        </div>
        <div
          className={styles.status}
          data-state={control.approvalState}
          role="status"
        >
          {control.approvalState === "CURRENT" ? (
            <CheckCircle2 aria-hidden="true" size={18} />
          ) : (
            <TriangleAlert aria-hidden="true" size={18} />
          )}
          {approvalStatus}
        </div>
      </header>

      {errorMessage ? (
        <div className={styles.errorBanner} role="alert">
          <TriangleAlert aria-hidden="true" size={18} />
          {errorMessage}
        </div>
      ) : null}

      {revisionSummary ? (
        <section
          className={styles.revisionSummary}
          aria-labelledby="revision-summary-title"
        >
          <div className={styles.sectionHeading}>
            <History aria-hidden="true" size={19} />
            <div>
              <h2 id="revision-summary-title">
                Änderungen seit Revision {revisionSummary.fromRevision}
              </h2>
              <p>
                {revisionSummary.hasCommercialChanges
                  ? `${revisionSummary.changes.length} kommerzielle Änderung(en)`
                  : "Keine kommerziellen Änderungen"}
              </p>
            </div>
          </div>
          {revisionSummary.changes.length > 0 ? (
            <ul>
              {revisionSummary.changes.map((change, index) => (
                <li key={`${index}-${change.summary}`}>{change.summary}</li>
              ))}
            </ul>
          ) : null}
          <dl className={styles.deltaGrid}>
            <div>
              <dt>Netto</dt>
              <dd>{money(revisionSummary.netDeltaMinor)}</dd>
            </div>
            <div>
              <dt>Steuer</dt>
              <dd>{money(revisionSummary.taxDeltaMinor)}</dd>
            </div>
            <div>
              <dt>Brutto</dt>
              <dd>{money(revisionSummary.grossDeltaMinor)}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section
        className={styles.linesSection}
        aria-labelledby="positions-title"
      >
        <div className={styles.sectionTitleRow}>
          <h2 id="positions-title">Bepreiste Positionen</h2>
          <span>{revision.lines.length}</span>
        </div>
        <div className={styles.lineList}>
          {revision.lines.length > 0 ? (
            revision.lines.map((line) => (
              <LineReview
                key={`${revision.revision}-${line.id}`}
                line={line}
                disabled={busy}
                onQuantityCommit={onQuantityCommit}
              />
            ))
          ) : (
            <div className={styles.emptyState}>
              <Ban aria-hidden="true" size={19} />
              Keine bepreisten Positionen
            </div>
          )}
        </div>
      </section>

      <section
        className={styles.unpricedGrid}
        aria-label="Nicht bepreiste Leistungen"
      >
        <div>
          <h2>Ausgeschlossen</h2>
          {revision.excludedItems.length > 0 ? (
            <ul>
              {revision.excludedItems.map((item) => (
                <li key={item.key}>
                  <strong>{item.key}</strong>
                  <span>{item.reason}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>Keine Ausschlüsse</p>
          )}
        </div>
        <div className={styles.unmatched}>
          <h2>Nicht zugeordnet</h2>
          {revision.unmatchedItems.length > 0 ? (
            <ul>
              {revision.unmatchedItems.map((item) => (
                <li key={item.key}>
                  <strong>{item.key}</strong>
                  <span>{item.reason}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>Keine offenen Zuordnungen</p>
          )}
        </div>
      </section>

      <section className={styles.totals} aria-labelledby="totals-title">
        <h2 id="totals-title">Summen</h2>
        <dl>
          <div>
            <dt>Netto</dt>
            <dd>{money(revision.netTotal.minor)}</dd>
          </div>
          <div>
            <dt>Steuer</dt>
            <dd>{money(revision.taxTotal.minor)}</dd>
          </div>
          <div className={styles.grandTotal}>
            <dt>Brutto</dt>
            <dd>{money(revision.grossTotal.minor)}</dd>
          </div>
        </dl>
      </section>

      {control.approvalState !== "CURRENT" ? (
        <ApprovalPanel
          key={revision.revision}
          revision={revision.revision}
          canApprove={control.canApprove}
          blockReason={control.approvalBlockReason}
          busy={busy}
          onApprove={onApprove}
        />
      ) : null}

      <section className={styles.exportPanel} aria-labelledby="export-title">
        <div className={styles.sectionHeading}>
          <Download aria-hidden="true" size={20} />
          <div>
            <h2 id="export-title">Export</h2>
            <p>Freigegebene Revision {revision.revision}</p>
          </div>
        </div>
        {control.exportBlockReason ? (
          <p className={styles.blockReason}>{control.exportBlockReason}</p>
        ) : null}
        <div className={styles.exportActions}>
          <button
            type="button"
            disabled={!control.canExport || busy}
            onClick={() => onExport("PDF")}
          >
            <FileText aria-hidden="true" size={17} />
            PDF herunterladen
          </button>
          <button
            type="button"
            disabled={!control.canExport || busy}
            onClick={() => onExport("CSV")}
          >
            <FileSpreadsheet aria-hidden="true" size={17} />
            CSV herunterladen
          </button>
        </div>
      </section>
    </main>
  );
}
