import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import {
  clearFaults,
  installDeniedMicrophone,
  integratedE2E,
  seedScenario,
  setFault,
} from "./helpers/integration";
import { fixturePath } from "./helpers/fixture-data";
import { QuoteCopilotPage } from "./pages/quote-copilot.page";

test.describe("recoverable failures and safety invariants", () => {
  test.skip(
    !integratedE2E,
    "Requires the local, test-only scenario adapter after integration.",
  );

  test.afterEach(async ({ request }) => {
    await clearFaults(request);
  });

  test("offers transcript fallback when microphone access is denied", async ({
    page,
    request,
  }) => {
    await seedScenario(request, "canonical-capture");
    await installDeniedMicrophone(page);
    const quote = new QuoteCopilotPage(page);

    await quote.openCapture();
    await page.getByRole("button", { name: "Sprachnotiz aufnehmen" }).click();
    await expect(
      page.getByRole("alert", { name: "Mikrofon nicht verfügbar" }),
    ).toBeVisible();
    await expect(page.getByLabel("Transkript direkt eingeben")).toBeVisible();
  });

  test("retries a failed upload without creating partial capture metadata", async ({
    page,
    request,
  }) => {
    await seedScenario(request, "canonical-capture");
    await setFault(request, "UPLOAD_ONCE");
    const quote = new QuoteCopilotPage(page);

    await quote.openCapture();
    await page
      .getByLabel("Baustellenfoto hochladen")
      .setInputFiles(fixturePath("media/synthetic-living-room.png"));
    await expect(
      page.getByRole("alert", { name: "Upload fehlgeschlagen" }),
    ).toBeVisible();
    await expect(page.getByText("Kein Foto gespeichert")).toBeVisible();
    await page.getByRole("button", { name: "Upload wiederholen" }).click();
    await expect(page.getByText("Foto sicher erfasst")).toBeVisible();
  });

  test("fails safely when model output violates the versioned schema", async ({
    page,
    request,
  }) => {
    await seedScenario(request, "invalid-model-output");
    const quote = new QuoteCopilotPage(page);

    await quote.openCapture();
    await page.getByRole("button", { name: "Analyse erneut starten" }).click();
    await expect(
      page.getByRole("alert", { name: "Analyse sicher abgebrochen" }),
    ).toBeVisible();
    await expect(page.getByText("Keine Position wurde bepreist")).toBeVisible();
  });

  test("blocks approval for an unresolved critical question and unknown mapping", async ({
    page,
    request,
  }) => {
    await seedScenario(request, "unknown-mapping");
    const quote = new QuoteCopilotPage(page);

    await quote.openOffer();
    await expect(
      page.getByText("Keine freigegebene Preisbuchposition gefunden"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Entwurf freigeben" }),
    ).toBeDisabled();
  });

  test("blocks approval until both canonical critical questions have answers", async ({
    page,
    request,
  }) => {
    await seedScenario(request, "canonical-needs-clarification");
    const quote = new QuoteCopilotPage(page);

    await quote.openOffer();
    await expect(
      page.getByRole("group", {
        name: "Soll die Decke mitgestrichen werden?",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("group", {
        name: "Ist der Untergrund tragfähig und ohne zusätzliche Ausbesserung?",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Entwurf freigeben" }),
    ).toBeDisabled();
  });

  test("rejects an invented code and prompt-like transcript content without pricing", async ({
    page,
    request,
  }) => {
    for (const scenario of ["hallucinated-code", "prompt-injection"] as const) {
      await seedScenario(request, scenario);
      const quote = new QuoteCopilotPage(page);
      await quote.openOffer();

      await expect(page.getByText("AI-SPEZIAL-999")).toHaveCount(0);
      await expect(
        page.getByText("Keine Position wurde bepreist"),
      ).toBeVisible();
    }
  });

  test("keeps a photo-only area contextual and requires an explicit measurement", async ({
    page,
    request,
  }) => {
    await seedScenario(request, "photo-only-measurement");
    const quote = new QuoteCopilotPage(page);

    await quote.openOffer();
    await expect(
      page.getByText("Foto liefert nur Kontext, keine verbindliche Messung"),
    ).toBeVisible();
    await expect(page.getByText("99 m²")).toHaveCount(0);
  });

  test("invalidates approval after a commercial edit and blocks export until reapproval", async ({
    page,
    request,
  }) => {
    await seedScenario(request, "canonical-approved");
    const quote = new QuoteCopilotPage(page);

    await quote.openOffer();
    await quote.makeSafeCommercialEdit();
    await expect(page.getByText("Freigabe erneuern")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "PDF exportieren" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "CSV exportieren" }),
    ).toBeDisabled();
  });

  test("does not export an approval bound to an older draft revision", async ({
    page,
    request,
  }) => {
    await seedScenario(request, "stale-approval");
    const quote = new QuoteCopilotPage(page);

    await quote.openOffer();
    await expect(page.getByText("Freigabe gehört zu Revision 2")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "PDF exportieren" }),
    ).toBeDisabled();
  });

  test("retries an export without mutating the approved revision", async ({
    page,
    request,
  }) => {
    await seedScenario(request, "canonical-approved");
    await setFault(request, "EXPORT_CSV_ONCE");
    const quote = new QuoteCopilotPage(page);

    await quote.openOffer();
    await page.getByRole("button", { name: "CSV exportieren" }).click();
    await expect(
      page.getByRole("alert", { name: "CSV-Export fehlgeschlagen" }),
    ).toBeVisible();
    await expect(page.getByText("Revision 2 bleibt freigegeben")).toBeVisible();
    await quote.downloadExport("CSV exportieren");
  });

  test("retries a PDF export without mutating the approved revision", async ({
    page,
    request,
  }) => {
    await seedScenario(request, "canonical-approved");
    await setFault(request, "EXPORT_PDF_ONCE");
    const quote = new QuoteCopilotPage(page);

    await quote.openOffer();
    await page.getByRole("button", { name: "PDF exportieren" }).click();
    await expect(
      page.getByRole("alert", { name: "PDF-Export fehlgeschlagen" }),
    ).toBeVisible();
    await expect(page.getByText("Revision 2 bleibt freigegeben")).toBeVisible();
    await quote.downloadExport("PDF exportieren");
  });

  test("hides cross-tenant resources and neutralizes CSV formula prefixes", async ({
    page,
    request,
  }) => {
    await seedScenario(request, "malicious-csv");
    await page.goto("/demo/projects/project-cross-tenant-nord");
    await expect(
      page.getByRole("heading", { name: "Nicht gefunden" }),
    ).toBeVisible();
    await expect(page.getByText("SYNTHETISCHER Fremdbetrieb Nord")).toHaveCount(
      0,
    );

    const quote = new QuoteCopilotPage(page);
    await quote.openOffer();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "CSV exportieren" }).click();
    const downloadedPath = await (await downloadPromise).path();
    expect(downloadedPath).not.toBeNull();
    const contents = readFileSync(downloadedPath as string, "utf8");
    expect(contents).toContain("'=HYPERLINK");
  });

  test("requires explicit confirmation for project data export and demo deletion", async ({
    page,
    request,
  }) => {
    await seedScenario(request, "data-rights");
    const quote = new QuoteCopilotPage(page);

    await quote.openProject();
    await page
      .getByRole("button", { name: "Projektdaten exportieren" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Projektdaten exportieren" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Demo-Projekt löschen" }).click();
    await expect(
      page.getByRole("dialog", { name: "Demo-Projekt löschen" }),
    ).toContainText("unwiderruflich");
  });
});
