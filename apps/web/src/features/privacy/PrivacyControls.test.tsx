import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PrivacyControls } from "./PrivacyControls";

describe("PrivacyControls", () => {
  it("renders export and a fail-closed deletion confirmation state", () => {
    const html = renderToStaticMarkup(
      <PrivacyControls
        projectId="project-synthetic"
        projectName="Synthetisches Testprojekt"
        demoMode={true}
        onExportProject={vi.fn()}
        onRequestDeletion={vi.fn()}
        onCompleteDemoDeletion={vi.fn()}
      />,
    );

    expect(html).toContain("Daten exportieren");
    expect(html).toContain("PROJEKT LÖSCHEN");
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*>[\s\S]*Löschung anfordern/,
    );
    expect(html).not.toContain("Demo-Daten jetzt löschen");
    expect(html).toContain('aria-live="polite"');
  });
});
