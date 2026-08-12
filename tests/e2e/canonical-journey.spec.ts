import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { integratedE2E, seedScenario } from "./helpers/integration";
import { QuoteCopilotPage } from "./pages/quote-copilot.page";

test.describe("canonical quotation journey", () => {
  test.skip(
    !integratedE2E,
    "Requires the local, test-only scenario adapter after integration.",
  );

  test.beforeEach(async ({ request }) => {
    await seedScenario(request, "canonical-capture");
  });

  test("captures evidence, resolves uncertainty, approves, exports, and audits", async ({
    page,
  }) => {
    const quote = new QuoteCopilotPage(page);

    await quote.openHome();
    await quote.selectCanonicalProject();
    await quote.startSiteVisit();
    await quote.captureCanonicalEvidence();
    await quote.reviewGeneratedDraft();
    await quote.answerCanonicalQuestions();
    await quote.expectCanonicalLineItems();
    await quote.makeSafeCommercialEdit();
    await quote.approveCurrentRevision();
    await quote.downloadExport("PDF exportieren");
    await quote.downloadExport("CSV exportieren");

    await expect(
      page.getByRole("heading", { name: "Aktivität" }),
    ).toBeVisible();
    for (const event of [
      "Erfassung erstellt",
      "Analyse abgeschlossen",
      "Zuordnung abgeschlossen",
      "Rückfrage beantwortet",
      "Entwurf bearbeitet",
      "Entwurf freigegeben",
      "Export erstellt",
    ]) {
      await expect(page.getByText(event)).toBeVisible();
    }
  });

  test("is keyboard reachable and free of automated serious accessibility violations", async ({
    page,
  }) => {
    const quote = new QuoteCopilotPage(page);
    await quote.openHome();

    await page.keyboard.press("Tab");
    await expect(page.locator(":focus-visible")).toHaveCount(1);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      results.violations.filter((violation) =>
        ["critical", "serious"].includes(violation.impact ?? ""),
      ),
    ).toEqual([]);
  });
});
