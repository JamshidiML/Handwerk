import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/src/components/ui-patterns";

export default function NotFound() {
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
