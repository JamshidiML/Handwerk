"use client";

import { RotateCcw } from "lucide-react";
import { InlineNotice } from "@/src/components/ui-patterns";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="route-state-page">
      <InlineNotice
        title="Der Arbeitsbereich konnte nicht geladen werden"
        tone="error"
        actions={
          <button className="button secondary" onClick={reset} type="button">
            <RotateCcw size={17} aria-hidden="true" />
            Erneut versuchen
          </button>
        }
      >
        <p>Ihre Demodaten wurden nicht verändert. Versuchen Sie es erneut.</p>
      </InlineNotice>
    </div>
  );
}
