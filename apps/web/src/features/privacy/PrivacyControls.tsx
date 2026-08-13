"use client";

import { AlertTriangle, Download, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";

import styles from "./PrivacyControls.module.css";

export interface PrivacyDeletionResult {
  id: string;
  status: "REQUESTED" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
}

export interface PrivacyControlsProps {
  projectId: string;
  projectName: string;
  demoMode: boolean;
  onExportProject: (projectId: string) => Promise<void>;
  onRequestDeletion: (input: {
    projectId: string;
    consequenceAcknowledged: true;
    confirmationPhrase: string;
  }) => Promise<PrivacyDeletionResult>;
  onCompleteDemoDeletion: (input: {
    projectId: string;
    deletionRequestId: string;
    confirmationPhrase: string;
  }) => Promise<PrivacyDeletionResult>;
}

const CONFIRMATION_PHRASE = "PROJEKT LÖSCHEN";

export function PrivacyControls({
  projectId,
  projectName,
  demoMode,
  onExportProject,
  onRequestDeletion,
  onCompleteDemoDeletion,
}: PrivacyControlsProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [deletionRequest, setDeletionRequest] =
    useState<PrivacyDeletionResult | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "export" | "request" | "delete" | null
  >(null);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const deletionConfirmed =
    acknowledged && confirmationPhrase === CONFIRMATION_PHRASE;

  async function runAction(
    action: "export" | "request" | "delete",
    operation: () => Promise<void>,
  ) {
    setPendingAction(action);
    setMessage(null);
    try {
      await operation();
    } catch {
      setMessage({
        kind: "error",
        text: "Die Aktion konnte nicht abgeschlossen werden. Bitte erneut versuchen.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="privacy-heading">
      <div className={styles.headingGroup}>
        <h2 className={styles.heading} id="privacy-heading">
          Projektdaten und Löschung
        </h2>
        <p className={styles.description}>
          Projekt: <strong>{projectName}</strong>
        </p>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>
          <ShieldCheck aria-hidden="true" size={20} />
          Projektdaten exportieren
        </h3>
        <p className={styles.description}>
          Der Export enthält die zum Projekt gespeicherten Daten als JSON-Datei.
        </p>
        <div className={styles.actions}>
          <button
            className={styles.button}
            type="button"
            disabled={pendingAction !== null}
            onClick={() =>
              void runAction("export", async () => {
                await onExportProject(projectId);
                setMessage({
                  kind: "success",
                  text: "Der Projektdatenexport wurde erstellt.",
                });
              })
            }
          >
            <Download aria-hidden="true" size={18} />
            {pendingAction === "export"
              ? "Export wird erstellt"
              : "Daten exportieren"}
          </button>
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={`${styles.groupTitle} ${styles.danger}`}>
          <AlertTriangle aria-hidden="true" size={20} />
          Projektlöschung anfordern
        </h3>
        <p className={styles.consequence}>
          Die Löschung entfernt Projekt, Baustellenbesuch, Nachweise, Entwürfe
          und Exporte. Im Demo-Modus kann sie sofort ausgeführt werden.
          Außerhalb des Demo-Modus wird nur eine bestätigte Anfrage angelegt.
        </p>

        <label className={styles.checkboxLabel}>
          <input
            className={styles.checkbox}
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>
            Ich habe die Folgen verstanden und möchte die Löschung anfordern.
          </span>
        </label>

        <div className={styles.field}>
          <label htmlFor="privacy-delete-confirmation">
            Zur Bestätigung {CONFIRMATION_PHRASE} eingeben
          </label>
          <input
            id="privacy-delete-confirmation"
            autoComplete="off"
            spellCheck={false}
            value={confirmationPhrase}
            onChange={(event) => setConfirmationPhrase(event.target.value)}
          />
        </div>

        <div className={styles.actions}>
          <button
            className={`${styles.button} ${styles.deleteButton}`}
            type="button"
            disabled={pendingAction !== null || !deletionConfirmed}
            onClick={() =>
              void runAction("request", async () => {
                const result = await onRequestDeletion({
                  projectId,
                  consequenceAcknowledged: true,
                  confirmationPhrase,
                });
                setDeletionRequest(result);
                setMessage({
                  kind: "success",
                  text: "Die Löschanfrage wurde bestätigt.",
                });
              })
            }
          >
            <Trash2 aria-hidden="true" size={18} />
            {pendingAction === "request"
              ? "Anfrage wird erstellt"
              : "Löschung anfordern"}
          </button>

          {demoMode && deletionRequest?.status === "CONFIRMED" ? (
            <button
              className={`${styles.button} ${styles.deleteButton}`}
              type="button"
              disabled={pendingAction !== null}
              onClick={() =>
                void runAction("delete", async () => {
                  const result = await onCompleteDemoDeletion({
                    projectId,
                    deletionRequestId: deletionRequest.id,
                    confirmationPhrase,
                  });
                  setDeletionRequest(result);
                  setMessage({
                    kind: "success",
                    text: "Die synthetischen Demo-Projektdaten wurden gelöscht.",
                  });
                })
              }
            >
              <Trash2 aria-hidden="true" size={18} />
              {pendingAction === "delete"
                ? "Demo-Daten werden gelöscht"
                : "Demo-Daten jetzt löschen"}
            </button>
          ) : null}
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {message ? (
          <p
            className={`${styles.status} ${message.kind === "error" ? styles.error : ""}`}
            role={message.kind === "error" ? "alert" : "status"}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </section>
  );
}
