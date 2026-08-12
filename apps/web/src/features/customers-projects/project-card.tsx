import {
  ArrowRight,
  CalendarClock,
  MapPin,
  MessageCircleQuestion,
} from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/src/components/status-badge";
import { formatDate, formatMoney } from "./formatters";
import { draftStateLabel, draftStateTone } from "./project-status";
import type { ProjectSummary } from "./types";

export function ProjectCard({
  summary,
  customerName,
  compact = false,
}: {
  summary: ProjectSummary;
  customerName: string;
  compact?: boolean;
}) {
  const {
    project,
    openQuestions,
    latestActivityAt,
    draftState,
    approvedGross,
  } = summary;
  return (
    <article className="project-card" data-compact={compact || undefined}>
      <div className="project-card-topline">
        <StatusBadge tone={draftStateTone(draftState)}>
          {draftStateLabel(draftState)}
        </StatusBadge>
        <span className="synthetic-label">Synthetisch</span>
      </div>
      <div className="project-card-heading">
        <div>
          <h3>
            <Link href={`/projekte/${project.id}`}>{project.name}</Link>
          </h3>
          <p>{customerName}</p>
        </div>
        <Link
          className="icon-button project-open"
          href={`/projekte/${project.id}`}
          aria-label={`${project.name} öffnen`}
        >
          <ArrowRight size={19} aria-hidden="true" />
        </Link>
      </div>
      <dl className="project-card-meta">
        <div>
          <dt>
            <MapPin size={15} aria-hidden="true" />
            <span className="sr-only">Ort</span>
          </dt>
          <dd>{project.locationLabel ?? "Ort nicht erfasst"}</dd>
        </div>
        <div>
          <dt>
            <CalendarClock size={15} aria-hidden="true" />
            <span className="sr-only">Letzte Aktivität</span>
          </dt>
          <dd>{formatDate(latestActivityAt)}</dd>
        </div>
        <div>
          <dt>
            <MessageCircleQuestion size={15} aria-hidden="true" />
            <span className="sr-only">Offene Rückfragen</span>
          </dt>
          <dd>
            {openQuestions === 0
              ? "Keine Rückfragen"
              : `${openQuestions} offen`}
          </dd>
        </div>
      </dl>
      {approvedGross ? (
        <div className="project-value">
          <span>Freigegebener Bruttobetrag</span>
          <strong>{formatMoney(approvedGross)}</strong>
        </div>
      ) : null}
    </article>
  );
}
