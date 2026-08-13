import type { EntityId, UserId } from "@handwerk/contracts";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CaptureWorkspace } from "./CaptureWorkspace";

describe("capture workspace integration surface", () => {
  it("renders explicit fallback and hard photo authority labels", () => {
    const html = renderToStaticMarkup(
      <CaptureWorkspace
        audio={{
          onTranscriptFallback: () => undefined,
          onUpload: async () => ({ status: "STORED" }),
        }}
        measurement={{ onAdd: () => undefined }}
        photo={{ onUpload: async () => ({ status: "STORED" }) }}
        siteVisitId={"visit-synthetic-001" as EntityId}
        userId={"user-synthetic-001" as UserId}
      />,
    );

    expect(html).toContain("Transkript-Ersatz manuell eingeben");
    expect(html).toContain("Nur Kontext");
    expect(html).toContain(
      "Maße werden ausschließlich als bestätigte Messwerte erfasst",
    );
    expect(html).toContain("Ich habe diesen Messwert vor Ort geprüft");
    expect(html).toContain('accept="image/jpeg,image/png"');
    expect(html).toContain('capture="environment"');
  });

  it("keeps the capture layout bounded for narrow mobile viewports", async () => {
    const css = await readFile(
      new URL("./Capture.module.css", import.meta.url),
      "utf8",
    );

    expect(css).toMatch(/@media \(max-width: 520px\)/);
    expect(css).toMatch(/grid-template-columns:\s*56px minmax\(0, 1fr\)/);
    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).not.toMatch(/letter-spacing:\s*-/);
  });
});
