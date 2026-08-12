import { expect, type Page } from "@playwright/test";

import { fixturePath } from "../helpers/fixture-data";
import { routes } from "../helpers/integration";

const projectId = "project-wohnzimmer-bochum";

export class QuoteCopilotPage {
  constructor(readonly page: Page) {}

  async openHome(): Promise<void> {
    await this.page.goto(routes.home);
    await expect(
      this.page.getByRole("heading", { name: "Malerbetrieb Westblick GmbH" }),
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
      .getByRole("link", { name: "Wohnzimmer renovieren - Bochum" })
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
      this.page.getByRole("heading", { name: "Baustellenbesuch erfassen" }),
    ).toBeVisible();
  }

  async startSiteVisit(): Promise<void> {
    await this.page
      .getByRole("button", { name: "Baustellenbesuch starten" })
      .click();
    await expect(this.page).toHaveURL(new RegExp(routes.capture(projectId)));
    await expect(
      this.page.getByRole("heading", { name: "Baustellenbesuch erfassen" }),
    ).toBeVisible();
  }

  async openOffer(): Promise<void> {
    await this.page.goto(routes.offer(projectId));
    await expect(
      this.page.getByRole("heading", { name: "Angebotsentwurf" }),
    ).toBeVisible();
  }

  async reviewGeneratedDraft(): Promise<void> {
    await this.page.getByRole("link", { name: "Entwurf prüfen" }).click();
    await expect(this.page).toHaveURL(new RegExp(routes.offer(projectId)));
    await expect(
      this.page.getByRole("heading", { name: "Angebotsentwurf" }),
    ).toBeVisible();
  }

  async captureCanonicalEvidence(): Promise<void> {
    await this.page
      .getByLabel("Sprachnotiz hochladen")
      .setInputFiles(fixturePath("media/synthetic-site-note.wav"));
    await this.page
      .getByLabel("Baustellenfoto hochladen")
      .setInputFiles(fixturePath("media/synthetic-living-room.png"));
    await this.page.getByLabel("Wandfläche (m²)").fill("52");
    await this.page.getByLabel("Deckenfläche (m²)").fill("20");
    await this.page.getByRole("button", { name: "Analyse starten" }).click();
  }

  async answerCanonicalQuestions(): Promise<void> {
    await this.answerQuestion("Soll die Decke mitgestrichen werden?", "Nein");
    await this.answerQuestion(
      "Ist der Untergrund tragfähig und ohne zusätzliche Ausbesserung?",
      "Ja",
    );
    await this.page
      .getByRole("button", { name: "Entwurf aktualisieren" })
      .click();
  }

  async answerQuestion(question: string, answer: "Ja" | "Nein"): Promise<void> {
    const group = this.page.getByRole("group", { name: question });
    await expect(group).toBeVisible();
    await group.getByRole("radio", { name: answer }).check();
  }

  async makeSafeCommercialEdit(): Promise<void> {
    await this.page
      .getByRole("button", { name: "Position bearbeiten" })
      .first()
      .click();
    await this.page
      .getByLabel("Beschreibung der Position")
      .fill("Wände zweimal weiß streichen - geprüft");
    await this.page.getByRole("button", { name: "Änderung speichern" }).click();
  }

  async approveCurrentRevision(): Promise<void> {
    await this.page
      .getByLabel("Ich habe Positionen, Mengen, Preise und Nachweise geprüft.")
      .check();
    await this.page.getByRole("button", { name: "Entwurf freigeben" }).click();
    await expect(this.page.getByText("Freigegeben")).toBeVisible();
  }

  async downloadExport(
    name: "PDF exportieren" | "CSV exportieren",
  ): Promise<void> {
    const download = this.page.waitForEvent("download");
    await this.page.getByRole("button", { name }).click();
    await expect(await download).toBeTruthy();
  }

  async expectCanonicalLineItems(): Promise<void> {
    await expect(this.page.getByText("MAL-WAND-2X")).toBeVisible();
    await expect(this.page.getByText("SCH-TUER-RAHMEN")).toBeVisible();
    await expect(this.page.getByText("MAL-DECKE-2X")).toHaveCount(0);
    await expect(this.page.getByText("793,73 EUR")).toBeVisible();
  }
}
