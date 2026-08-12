"use client";

import {
  ArrowLeft,
  Check,
  ClipboardPenLine,
  CloudOff,
  MapPin,
  Play,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";
import { useState } from "react";
import { StatusBadge } from "@/src/components/status-badge";
import { EmptyState, InlineNotice } from "@/src/components/ui-patterns";
import { useDemoData } from "./demo-data-provider";
import { formatDateTime } from "./formatters";
import type { ProjectFeatureSlotProps } from "./integration-slots";

export function SiteVisitWorkspace({
  projectId,
  CaptureFeature,
}: {
  projectId: string;
  CaptureFeature?: ComponentType<ProjectFeatureSlotProps>;
}) {
  const workspace = useDemoData();
  const [announcement, setAnnouncement] = useState("");
  const summary = workspace.findProject(projectId);
  const customer = summary
    ? workspace.findCustomer(summary.project.customerId)
    : undefined;

  if (!summary || !customer) {
    return (
      <div className="route-state-page">
        <EmptyState
          title="Baustellenbesuch nicht verfügbar"
          action={
            <Link className="button secondary" href="/kunden">
              <ArrowLeft size={17} aria-hidden="true" />
              Zur Projektauswahl
            </Link>
          }
        >
          <p>Das zugehörige Demo-Projekt wurde nicht gefunden.</p>
        </EmptyState>
      </div>
    );
  }

  const siteVisit = summary.siteVisit;
  const slotProps: ProjectFeatureSlotProps = {
    organisation: workspace.organisation,
    project: summary.project,
    siteVisit,
    demoMode: true,
  };

  function startVisit() {
    const visit = workspace.startSiteVisit(projectId);
    setAnnouncement(
      visit
        ? "Baustellenbesuch wurde gestartet."
        : "Baustellenbesuch konnte nicht gestartet werden.",
    );
  }

  return (
    <div className="page-stack visit-page">
      <nav className="breadcrumbs" aria-label="Brotkrümelnavigation">
        <Link href={`/projekte/${projectId}`}>Projekt</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Baustellenbesuch</span>
      </nav>

      <header className="visit-header">
        <div>
          <div className="project-header-status">
            <StatusBadge
              tone={siteVisit?.status === "OPEN" ? "info" : "neutral"}
            >
              {siteVisit?.status === "OPEN"
                ? "Besuch geöffnet"
                : "Noch nicht gestartet"}
            </StatusBadge>
            <span className="synthetic-label">Synthetische Demo</span>
          </div>
          <h1>Baustellenbesuch</h1>
          <p>
            {summary.project.name} · {customer.customer.displayName}
          </p>
          <span className="visit-location">
            <MapPin size={15} aria-hidden="true" />
            {summary.project.locationLabel}
          </span>
        </div>
        <Link className="button secondary" href={`/projekte/${projectId}`}>
          <ArrowLeft size={17} aria-hidden="true" />
          Zum Projekt
        </Link>
      </header>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      {!siteVisit ? (
        <section
          className="visit-start-panel"
          aria-labelledby="visit-start-title"
        >
          <span className="visit-start-icon" aria-hidden="true">
            <ClipboardPenLine size={27} />
          </span>
          <div>
            <span className="eyebrow">Bereit für die Baustelle</span>
            <h2 id="visit-start-title">Besuch für dieses Projekt starten</h2>
            <p>
              Der Start wird als synthetischer Vorgang in dieser Demo-Sitzung
              geführt.
            </p>
          </div>
          <button className="button" onClick={startVisit} type="button">
            <Play size={18} aria-hidden="true" />
            Baustellenbesuch starten
          </button>
        </section>
      ) : (
        <>
          <section
            className="visit-session-bar"
            aria-label="Geöffneter Baustellenbesuch"
          >
            <div>
              <span className="session-indicator" aria-hidden="true" />
              <span>
                <strong>Erfassung läuft</strong>
                <small>Begonnen {formatDateTime(siteVisit.startedAt)}</small>
              </span>
            </div>
            <span className="session-saved">
              <Check size={16} aria-hidden="true" />
              Zuletzt gesichert
            </span>
          </section>

          <div className="visit-stepper" aria-label="Erfassungsschritte">
            <span data-state="current">
              <strong>1</strong>
              <small>Erfassen</small>
            </span>
            <span>
              <strong>2</strong>
              <small>Prüfen</small>
            </span>
            <span>
              <strong>3</strong>
              <small>Verarbeiten</small>
            </span>
          </div>

          {CaptureFeature ? (
            <CaptureFeature {...slotProps} />
          ) : (
            <section
              className="capture-unavailable"
              aria-labelledby="capture-unavailable-title"
            >
              <CloudOff size={27} aria-hidden="true" />
              <div>
                <h2 id="capture-unavailable-title">
                  Erfassung vorübergehend nicht verfügbar
                </h2>
                <p>
                  Der Baustellenbesuch bleibt geöffnet. Bereits gesicherte
                  Demodaten gehen nicht verloren.
                </p>
              </div>
              <button
                className="button secondary"
                onClick={() => window.location.reload()}
                type="button"
              >
                <RotateCcw size={17} aria-hidden="true" />
                Erneut laden
              </button>
            </section>
          )}

          <InlineNotice title="Maße nur ausdrücklich erfassen" tone="warning">
            <p>
              Fotos dienen ausschließlich als Kontext. Flächen und Längen müssen
              vor Ort gemessen und bestätigt werden.
            </p>
          </InlineNotice>
        </>
      )}
    </div>
  );
}
