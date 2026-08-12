import { expect, test } from "@playwright/test";

import { installDeniedMicrophone } from "./helpers/integration";
import { QuoteCopilotPage } from "./pages/quote-copilot.page";

test.describe("recoverable failures and safety invariants", () => {
  test("offers a transcript fallback when microphone permission is denied", async ({
    page,
  }) => {
    await installDeniedMicrophone(page);
    const quote = new QuoteCopilotPage(page);

    await quote.openCapture();
    await page.getByRole("button", { name: "Aufnahme starten" }).press("Enter");
    await expect(
      page.getByText("Mikrofonzugriff wurde nicht erlaubt."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Transkript-Ersatz manuell eingeben" }),
    ).toBeVisible();
  });

  test("blocks approval until both critical questions have answers", async ({
    page,
  }) => {
    const quote = new QuoteCopilotPage(page);

    await quote.openOffer();
    await expect(
      page.getByRole("heading", {
        name: "Soll die Decke mitgestrichen werden?",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Ist der Untergrund tragfähig und ohne zusätzliche Ausbesserung?",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Revision freigeben" }),
    ).toBeDisabled();
    await expect(
      page.getByText("2 kritische Angaben sind offen."),
    ).toBeVisible();
  });

  test("invalidates approval after a commercial edit and blocks export", async ({
    page,
  }) => {
    const quote = new QuoteCopilotPage(page);

    await quote.openOffer();
    await quote.answerCanonicalQuestions();
    await quote.approveCurrentRevision();
    await quote.makeSafeCommercialEdit();
    await expect(
      page.getByText("Freigabe ungültig", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Eine kommerzielle Änderung hat die Freigabe ungültig gemacht.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "PDF herunterladen" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "CSV herunterladen" }),
    ).toBeDisabled();
  });

  test("keeps an unknown project route neutral", async ({ page }) => {
    await page.goto("/projekte/project-cross-tenant-nord");

    await expect(
      page.getByRole("heading", { name: "Projekt nicht gefunden" }),
    ).toBeVisible();
    await expect(page.getByText("Fremdbetrieb Nord")).toHaveCount(0);
  });

  test("requires an explicit deletion acknowledgement and phrase", async ({
    page,
  }) => {
    const quote = new QuoteCopilotPage(page);

    await quote.openProject();
    const requestDeletion = page.getByRole("button", {
      name: "Löschung anfordern",
    });
    await expect(requestDeletion).toBeDisabled();
    await page
      .getByLabel(
        "Ich habe die Folgen verstanden und möchte die Löschung anfordern.",
      )
      .check();
    await page
      .getByLabel("Zur Bestätigung PROJEKT LÖSCHEN eingeben")
      .fill("PROJEKT LÖSCHEN");
    await expect(requestDeletion).toBeEnabled();
  });
});
