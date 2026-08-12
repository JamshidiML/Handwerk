"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardPenLine,
  Euro,
  MessageCircleQuestion,
  Play,
  Ruler,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentType } from "react";
import { StatusBadge } from "@/src/components/status-badge";
import { EmptyState, InlineNotice } from "@/src/components/ui-patterns";
import { useDemoData } from "./demo-data-provider";
import { formatDateTime, formatMoney, formatQuantity } from "./formatters";
import type { ProjectFeatureSlotProps } from "./integration-slots";
import {
  approvalLabel,
  draftStateLabel,
  draftStateTone,
} from "./project-status";

interface ProjectOverviewProps {
  projectId: string;
  ClarificationsFeature?: ComponentType<ProjectFeatureSlotProps>;
  OfferReviewFeature?: ComponentType<ProjectFeatureSlotProps>;
  PrivacyFeature?: ComponentType<ProjectFeatureSlotProps>;
}

export function ProjectOverview({
  projectId,
  ClarificationsFeature,
  OfferReviewFeature,
  PrivacyFeature,
}: ProjectOverviewProps) {
  const router = useRouter();
  const workspace = useDemoData();
  const summary = workspace.findProject(projectId);
  const customer = summary
    ? workspace.findCustomer(summary.project.customerId)
    : undefined;

  if (!summary || !customer) {
    return (
      <div className="route-state-page">
        <EmptyState
          title="Projekt nicht gefunden"
          action={
            <Link className="button secondary" href="/kunden">
              <ArrowLeft size={17} aria-hidden="true" />
              Zur Projektauswahl
            </Link>
          }
        >
          <p>Der Eintrag ist in diesem Demo-Arbeitsbereich nicht verfügbar.</p>
        </EmptyState>
      </div>
    );
  }

  const slotProps: ProjectFeatureSlotProps = {
    organisation: workspace.organisation,
    project: summary.project,
    siteVisit: summary.siteVisit,
    demoMode: true,
  };
  const hasOpenVisit = summary.siteVisit?.status === "OPEN";

  function openSiteVisit() {
    workspace.startSiteVisit(projectId);
    router.push(`/projekte/${projectId}/baustellenbesuch`);
  }

  return (
    <div className="page-stack">
      <nav className="breadcrumbs" aria-label="Brotkrümelnavigation">
        <Link href="/kunden">Kunden und Projekte</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{summary.project.name}</span>
      </nav>

      <header className="page-header project-page-header">
        <div>
          <div className="project-header-status">
            <StatusBadge tone={draftStateTone(summary.draftState)}>
              {draftStateLabel(summary.draftState)}
            </StatusBadge>
            <span className="synthetic-label">Synthetische Demo</span>
          </div>
          <h1>{summary.project.name}</h1>
          <p>
            {customer.customer.displayName} · {summary.project.locationLabel}
          </p>
        </div>
        <button className="button" onClick={openSiteVisit} type="button">
          {hasOpenVisit ? (
            <ClipboardPenLine size={18} aria-hidden="true" />
          ) : (
            <Play size={18} aria-hidden="true" />
          )}
          {hasOpenVisit
            ? "Baustellenbesuch fortsetzen"
            : "Baustellenbesuch starten"}
        </button>
      </header>

      <section className="project-facts" aria-label="Projektstatus">
        <article>
          <MessageCircleQuestion size={20} aria-hidden="true" />
          <div>
            <span>Rückfragen</span>
            <strong>
              {summary.openQuestions === 0
                ? "Keine offen"
                : `${summary.openQuestions} offen`}
            </strong>
          </div>
        </article>
        <article>
          <CheckCircle2 size={20} aria-hidden="true" />
          <div>
            <span>Freigabe</span>
            <strong>{approvalLabel(summary.draftState)}</strong>
          </div>
        </article>
        <article>
          <CalendarClock size={20} aria-hidden="true" />
          <div>
            <span>Letzte Aktivität</span>
            <strong>{formatDateTime(summary.latestActivityAt)}</strong>
          </div>
        </article>
        <article>
          <Euro size={20} aria-hidden="true" />
          <div>
            <span>Bruttobetrag</span>
            <strong>
              {summary.approvedGross
                ? formatMoney(summary.approvedGross)
                : "Noch offen"}
            </strong>
          </div>
        </article>
      </section>

      <div className="project-layout">
        <div className="project-main-column">
          <section className="workflow-panel" aria-labelledby="workflow-title">
            <div className="section-heading simple">
              <div>
                <span className="eyebrow">Arbeitsstand</span>
                <h2 id="workflow-title">Vom Besuch zum Entwurf</h2>
              </div>
            </div>
            <ol className="workflow-list">
              <li data-state="done">
                <span>1</span>
                <div>
                  <strong>Projekt angelegt</strong>
                  <p>Kunde und Baustelle sind zugeordnet.</p>
                </div>
                <CheckCircle2 size={18} aria-hidden="true" />
              </li>
              <li data-state={summary.siteVisit ? "current" : "next"}>
                <span>2</span>
                <div>
                  <strong>Baustellenbesuch</strong>
                  <p>
                    {hasOpenVisit
                      ? "Erfassung ist geöffnet und kann fortgesetzt werden."
                      : "Noch kein offener Besuch."}
                  </p>
                </div>
                <ArrowRight size={18} aria-hidden="true" />
              </li>
              <li data-state={summary.openQuestions > 0 ? "blocked" : "next"}>
                <span>3</span>
                <div>
                  <strong>Rückfragen klären</strong>
                  <p>
                    {summary.openQuestions > 0
                      ? `${summary.openQuestions} Angaben benötigen Ihre Entscheidung.`
                      : "Keine offenen Rückfragen."}
                  </p>
                </div>
                <MessageCircleQuestion size={18} aria-hidden="true" />
              </li>
              <li
                data-state={
                  ["APPROVED", "EXPORTED"].includes(summary.draftState)
                    ? "done"
                    : "next"
                }
              >
                <span>4</span>
                <div>
                  <strong>Prüfen und freigeben</strong>
                  <p>Die finale Entscheidung bleibt beim Menschen.</p>
                </div>
                <ShieldCheck size={18} aria-hidden="true" />
              </li>
            </ol>
          </section>

          {ClarificationsFeature ? (
            <ClarificationsFeature {...slotProps} />
          ) : null}
          {OfferReviewFeature ? <OfferReviewFeature {...slotProps} /> : null}
        </div>

        <aside className="project-side-column">
          <section
            className="summary-panel"
            aria-labelledby="visit-summary-title"
          >
            <div className="section-heading simple">
              <div>
                <span className="eyebrow">Vor Ort</span>
                <h2 id="visit-summary-title">Baustellenbesuch</h2>
              </div>
            </div>
            {summary.siteVisit ? (
              <dl className="summary-list">
                <div>
                  <dt>Status</dt>
                  <dd>
                    {summary.siteVisit.status === "OPEN"
                      ? "Geöffnet"
                      : "Abgeschlossen"}
                  </dd>
                </div>
                <div>
                  <dt>Beginn</dt>
                  <dd>{formatDateTime(summary.siteVisit.startedAt)}</dd>
                </div>
                {projectId === "project-wohnzimmer-bochum" ? (
                  <>
                    <div>
                      <dt>
                        <Ruler size={15} aria-hidden="true" /> Wandfläche
                      </dt>
                      <dd>{formatQuantity({ value: "52", unit: "M2" })}</dd>
                    </div>
                    <div>
                      <dt>
                        <Ruler size={15} aria-hidden="true" /> Deckenfläche
                      </dt>
                      <dd>{formatQuantity({ value: "20", unit: "M2" })}</dd>
                    </div>
                  </>
                ) : null}
              </dl>
            ) : (
              <p className="muted-copy">Noch kein Baustellenbesuch erfasst.</p>
            )}
            <button
              className="button full-width"
              onClick={openSiteVisit}
              type="button"
            >
              {hasOpenVisit ? (
                <ClipboardPenLine size={18} aria-hidden="true" />
              ) : (
                <Play size={18} aria-hidden="true" />
              )}
              {hasOpenVisit ? "Fortsetzen" : "Besuch starten"}
            </button>
          </section>

          <InlineNotice title="Prüfung erforderlich" tone="warning">
            <p>
              KI-Vorschläge sind ein Arbeitsentwurf. Umfang und Preis müssen vor
              jeder Freigabe geprüft werden.
            </p>
          </InlineNotice>

          {PrivacyFeature ? <PrivacyFeature {...slotProps} /> : null}
        </aside>
      </div>
    </div>
  );
}
