import type { DraftState } from "@handwerk/contracts";
import type { StatusTone } from "@/src/components/status-badge";

const labels: Record<DraftState, string> = {
  CAPTURING: "Erfassung offen",
  PROCESSING: "Wird verarbeitet",
  NEEDS_CLARIFICATION: "Rückfragen offen",
  READY_FOR_REVIEW: "Prüfung bereit",
  APPROVED: "Freigegeben",
  EXPORTED: "Exportiert",
};

const tones: Record<DraftState, StatusTone> = {
  CAPTURING: "info",
  PROCESSING: "info",
  NEEDS_CLARIFICATION: "warning",
  READY_FOR_REVIEW: "info",
  APPROVED: "success",
  EXPORTED: "success",
};

export function draftStateLabel(state: DraftState) {
  return labels[state];
}

export function draftStateTone(state: DraftState) {
  return tones[state];
}

export function approvalLabel(state: DraftState) {
  if (state === "APPROVED") return "Aktuell freigegeben";
  if (state === "EXPORTED") return "Freigabe und Export erfolgt";
  if (state === "READY_FOR_REVIEW") return "Freigabe ausstehend";
  return "Noch nicht prüfbereit";
}
