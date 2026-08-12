"use client";

import {
  ArrowRight,
  CheckCircle2,
  ClipboardPenLine,
  Clock3,
  MessageCircleQuestion,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { InlineNotice } from "@/src/components/ui-patterns";
import { DEMO_NOW } from "./demo-data";
import { useDemoData } from "./demo-data-provider";
import { formatDateTime, formatLongDate } from "./formatters";
import { ProjectCard } from "./project-card";

export function Dashboard() {
  const { customers, user } = useDemoData();
  const projects = customers.flatMap(
    ({ customer, projects: customerProjects }) =>
      customerProjects.map((summary) => ({ customer, summary })),
  );
  const current =
    projects.find(({ summary }) => summary.siteVisit?.status === "OPEN") ??
    projects[0];
  const openQuestions = projects.reduce(
    (total, entry) => total + entry.summary.openQuestions,
    0,
  );
  const released = projects.filter(({ summary }) =>
    ["APPROVED", "EXPORTED"].includes(summary.draftState),
  ).length;

  return (
    <div className="page-stack">
      <header className="page-header dashboard-header">
        <div>
          <span className="eyebrow">{formatLongDate(DEMO_NOW)}</span>
          <h1>Guten Morgen, {user.displayName.split(" ")[0]}.</h1>
          <p>Malerbetrieb Westblick GmbH · Interner Arbeitsstand</p>
        </div>
        <Link className="button secondary" href="/kunden">
          Kunden und Projekte
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </header>

      <section className="metric-row" aria-label="Arbeitsstand">
        <article>
          <ClipboardPenLine size={19} aria-hidden="true" />
          <span>Aktive Projekte</span>
          <strong>
            {
              projects.filter(
                ({ summary }) => summary.draftState !== "EXPORTED",
              ).length
            }
          </strong>
        </article>
        <article>
          <MessageCircleQuestion size={19} aria-hidden="true" />
          <span>Offene Rückfragen</span>
          <strong>{openQuestions}</strong>
        </article>
        <article>
          <CheckCircle2 size={19} aria-hidden="true" />
          <span>Freigegeben</span>
          <strong>{released}</strong>
        </article>
      </section>

      <div className="dashboard-layout">
        <div className="dashboard-main">
          {current ? (
            <section
              className="current-work"
              aria-labelledby="current-work-title"
            >
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Jetzt weiterarbeiten</span>
                  <h2 id="current-work-title">
                    {current.summary.project.name}
                  </h2>
                  <p>
                    {current.customer.displayName} ·{" "}
                    {current.summary.project.locationLabel}
                  </p>
                </div>
                <span className="activity-time">
                  <Clock3 size={15} aria-hidden="true" />
                  {formatDateTime(current.summary.latestActivityAt)}
                </span>
              </div>

              <div className="current-work-body">
                <div
                  className="visit-progress"
                  aria-label="Fortschritt Baustellenbesuch"
                >
                  <span data-state="done">Projekt</span>
                  <span data-state="current">Erfassung</span>
                  <span>Rückfragen</span>
                  <span>Prüfung</span>
                </div>
                <p className="current-work-note">
                  Der Baustellenbesuch ist geöffnet. Zwei Angaben müssen noch
                  geklärt werden, bevor der Entwurf geprüft werden kann.
                </p>
                <div className="current-work-actions">
                  <Link
                    className="button"
                    href={`/projekte/${current.summary.project.id}/baustellenbesuch`}
                  >
                    <ClipboardPenLine size={18} aria-hidden="true" />
                    Baustellenbesuch fortsetzen
                  </Link>
                  <Link
                    className="button ghost"
                    href={`/projekte/${current.summary.project.id}`}
                  >
                    Projekt ansehen
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </section>
          ) : null}

          <section aria-labelledby="recent-projects-title">
            <div className="section-heading simple">
              <div>
                <span className="eyebrow">Zuletzt bearbeitet</span>
                <h2 id="recent-projects-title">Projekte</h2>
              </div>
              <Link className="text-link" href="/kunden">
                Alle anzeigen
              </Link>
            </div>
            <div className="project-list">
              {projects.map(({ customer, summary }) => (
                <ProjectCard
                  customerName={customer.displayName}
                  key={summary.project.id}
                  summary={summary}
                />
              ))}
            </div>
          </section>
        </div>

        <aside className="dashboard-rail" aria-labelledby="activity-title">
          <section className="activity-panel">
            <div className="section-heading simple">
              <div>
                <span className="eyebrow">Heute</span>
                <h2 id="activity-title">Letzte Aktivität</h2>
              </div>
            </div>
            <ol className="activity-list">
              {projects.slice(0, 3).map(({ customer, summary }) => (
                <li key={summary.project.id}>
                  <span className="activity-marker" aria-hidden="true" />
                  <div>
                    <strong>{summary.latestActivity}</strong>
                    <p>{customer.displayName}</p>
                    <time dateTime={summary.latestActivityAt}>
                      {formatDateTime(summary.latestActivityAt)}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <InlineNotice title="Unter Ihrer Kontrolle" tone="success">
            <p>
              Preise kommen nur aus dem freigegebenen Preisbuch. Ein Angebot
              wird erst nach Ihrer ausdrücklichen Prüfung freigegeben.
            </p>
          </InlineNotice>

          <div className="demo-context">
            <ShieldCheck size={20} aria-hidden="true" />
            <div>
              <strong>Synthetische Demodaten</strong>
              <p>Keine echten Kunden-, Medien- oder Preisdaten verwenden.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
