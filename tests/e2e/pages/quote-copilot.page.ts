import { expect, type Page } from "@playwright/test";

import { routes } from "../helpers/integration";

const projectId = "project-wohnzimmer-bochum";

export class QuoteCopilotPage {
  constructor(readonly page: Page) {}

  async openHome(): Promise<void> {
    await this.page.goto(routes.home);
    await expect(
      this.page.getByRole("heading", { name: "Guten Morgen, Mohsen." }),
    ).toBeVisible();
  }

  async openProject(): Promise<void> {
    await this.page.goto(routes.project(projectId));
    await expect(
      this.page.getByRole("heading", {
        name: "Wohnzimmer renovieren - Bochum",
      }),
    ).toBeVisible();
  }

  async selectCanonicalProject(): Promise<void> {
    await this.page
      .getByRole("link", {
        name: "Wohnzimmer renovieren - Bochum",
        exact: true,
      })
      .click();
    await expect(this.page).toHaveURL(new RegExp(routes.project(projectId)));
    await expect(
      this.page.getByRole("heading", {
        name: "Wohnzimmer renovieren - Bochum",
      }),
    ).toBeVisible();
  }

  async openCapture(): Promise<void> {
    await this.page.goto(routes.capture(projectId));
    await expect(
      this.page.getByRole("heading", { name: "Erfassung und Analyse" }),
    ).toBeVisible();
  }

  async startSiteVisit(): Promise<void> {
    await this.page
      .getByRole("button", { name: /Baustellenbesuch (starten|fortsetzen)/ })
      .click();
    await expect(this.page).toHaveURL(new RegExp(routes.capture(projectId)));
    await expect(
      this.page.getByRole("heading", { name: "Erfassung und Analyse" }),
    ).toBeVisible();
  }

  async openOffer(): Promise<void> {
    await this.page.goto(routes.offer(projectId));
    await expect(
      this.page.getByRole("heading", { name: "Revision 1", exact: true }),
    ).toBeVisible();
  }

  async reviewGeneratedDraft(): Promise<void> {
    await this.page
      .getByRole("link", { name: "Entwurf prüfen" })
      .press("Enter");
    await expect(this.page).toHaveURL(new RegExp(routes.offer(projectId)));
    await expect(
      this.page.getByRole("heading", { name: "Revision 1", exact: true }),
    ).toBeVisible();
  }

  async captureCanonicalEvidence(): Promise<void> {
    await this.page.getByPlaceholder("z. B. Wandfläche").fill("Wandfläche");
    await this.page.getByPlaceholder("z. B. Wohnzimmer").fill("Wohnzimmer");
    await this.page.getByPlaceholder("52").fill("52");
    const confirmation = this.page.getByLabel(
      "Ich habe diesen Messwert vor Ort geprüft.",
    );
    await confirmation.focus();
    await confirmation.press("Space");
    await expect(confirmation).toBeChecked();
    const addMeasurement = this.page.getByRole("button", {
      name: "Messwert hinzufügen",
    });
    await expect(addMeasurement).toBeVisible();
    await addMeasurement.press("Enter");
    const startAnalysis = this.page.getByRole("button", {
      name: "Analyse starten",
    });
    await expect(startAnalysis).toBeVisible();
    await startAnalysis.press("Enter");
  }

  async answerCanonicalQuestions(): Promise<void> {
    await this.answerQuestion("Soll die Decke mitgestrichen werden?", "Nein");
    await this.answerQuestion(
      "Ist der Untergrund tragfähig und ohne zusätzliche Ausbesserung?",
      "Ja",
    );
    await expect(this.page.getByText("Bereit zur Prüfung")).toBeVisible();
  }

  async answerQuestion(question: string, answer: "Ja" | "Nein"): Promise<void> {
    const card = this.page.locator("article").filter({ hasText: question });
    await expect(card).toBeVisible();
    const answerControl = card.getByRole("radio", { name: answer });
    await answerControl.focus();
    await answerControl.press("Space");
    await card
      .getByRole("button", { name: "Antwort übernehmen" })
      .press("Enter");
  }

  async makeSafeCommercialEdit(): Promise<void> {
    await this.page.getByLabel("Menge für MAL-WAND-2X").fill("53");
    await this.page.getByLabel("Menge für MAL-WAND-2X").press("Tab");
    await expect(
      this.page.getByRole("heading", { name: "Revision 2", exact: true }),
    ).toBeVisible();
  }

  async approveCurrentRevision(): Promise<void> {
    const approvalConfirmation = this.page.getByLabel(
      "Ich habe Umfang, Mengen, Preise und Ausschlüsse der aktuellen Revision geprüft.",
    );
    await approvalConfirmation.focus();
    await approvalConfirmation.press("Space");
    await this.page
      .getByRole("button", { name: "Revision freigeben" })
      .press("Enter");
    await expect(
      this.page.getByText("Aktuelle Revision freigegeben"),
    ).toBeVisible();
  }

  async downloadExport(
    name: "PDF herunterladen" | "CSV herunterladen",
  ): Promise<void> {
    const download = this.page.waitForEvent("download");
    await this.page.getByRole("button", { name }).press("Enter");
    await expect(await download).toBeTruthy();
  }

  async expectCanonicalLineItems(): Promise<void> {
    await expect(this.page.getByText("MAL-WAND-2X")).toBeVisible();
    await expect(this.page.getByText("SCHUTZ-ZARGE")).toBeVisible();
    await expect(this.page.getByText("MAL-DECKE-2X")).toHaveCount(0);
    await expect(this.page.getByText("541,45 €")).toBeVisible();
  }

  async exportProjectData(): Promise<void> {
    const download = this.page.waitForEvent("download");
    await this.page
      .getByRole("button", { name: "Daten exportieren" })
      .press("Enter");
    await expect(await download).toBeTruthy();
  }

  async deleteCanonicalDemoProject(): Promise<void> {
    await this.page
      .getByLabel(
        "Ich habe die Folgen verstanden und möchte die Löschung anfordern.",
      )
      .check();
    await this.page
      .getByLabel("Zur Bestätigung PROJEKT LÖSCHEN eingeben")
      .fill("PROJEKT LÖSCHEN");
    await this.page
      .getByRole("button", { name: "Löschung anfordern" })
      .press("Enter");
    await this.page
      .getByRole("button", { name: "Demo-Daten jetzt löschen" })
      .press("Enter");
    await expect(
      this.page.getByRole("heading", { name: "Projekt nicht gefunden" }),
    ).toBeVisible();
  }
}
