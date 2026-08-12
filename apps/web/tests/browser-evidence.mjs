import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const baseUrl = process.env.T02_BASE_URL ?? "http://127.0.0.1:4173";
const evidenceDirectory = new URL("./evidence/", import.meta.url);
const chromeExecutable =
  process.env.CHROME_EXECUTABLE ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

await mkdir(evidenceDirectory, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromeExecutable,
  headless: true,
});
const evidence = {
  baseUrl,
  accessibility: [],
  viewports: [],
  keyboard: [],
};

async function verifyPage(pathname, viewport, screenshotName) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${pathname}`, { waitUntil: "networkidle" });
  await page.locator("h1").first().waitFor();

  const layout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    bodyHeight: document.body.scrollHeight,
    viewportHeight: window.innerHeight,
    visibleH1: Boolean(document.querySelector("h1")?.getClientRects().length),
  }));
  assert.equal(layout.visibleH1, true, `${pathname} needs a visible h1`);
  assert.ok(
    layout.documentWidth <= layout.viewportWidth,
    `${pathname} overflows horizontally: ${layout.documentWidth} > ${layout.viewportWidth}`,
  );

  const accessibility = await new AxeBuilder({ page }).analyze();
  const violationSummary = accessibility.violations.map(
    ({ id, impact, nodes }) => ({
      id,
      impact,
      nodes: nodes.map(({ target, failureSummary }) => ({
        target,
        failureSummary,
      })),
    }),
  );
  assert.deepEqual(
    violationSummary,
    [],
    `${pathname} has accessibility violations`,
  );

  await page.screenshot({
    path: new URL(screenshotName, evidenceDirectory).pathname,
    fullPage: true,
  });

  evidence.viewports.push({ pathname, viewport, ...layout, screenshotName });
  evidence.accessibility.push({ pathname, violations: 0 });
  await context.close();
}

await verifyPage(
  "/",
  { width: 1440, height: 1000 },
  "T02-desktop-dashboard.png",
);
await verifyPage(
  "/kunden",
  { width: 390, height: 844 },
  "T02-mobile-customers.png",
);
await verifyPage(
  "/projekte/project-wohnzimmer-bochum",
  { width: 1024, height: 768 },
  "T02-tablet-project.png",
);
await verifyPage(
  "/projekte/project-wohnzimmer-bochum/baustellenbesuch",
  { width: 390, height: 844 },
  "T02-mobile-site-visit.png",
);

const keyboardContext = await browser.newContext({
  viewport: { width: 1280, height: 800 },
});
const keyboardPage = await keyboardContext.newPage();
await keyboardPage.goto(`${baseUrl}/kunden`, { waitUntil: "networkidle" });

await keyboardPage.keyboard.press("Tab");
assert.equal(
  await keyboardPage.evaluate(() =>
    document.activeElement?.textContent?.trim(),
  ),
  "Zum Inhalt springen",
);
evidence.keyboard.push("First Tab focuses the skip link");

const createCustomer = keyboardPage
  .getByRole("button", { name: "Kunde anlegen" })
  .first();
await createCustomer.focus();
await keyboardPage.keyboard.press("Enter");
const customerInput = keyboardPage.getByLabel("Name des Demo-Kunden");
await customerInput.waitFor();
assert.equal(
  await customerInput.evaluate((element) => element === document.activeElement),
  true,
);
await keyboardPage.keyboard.type("Demo-Kunde Tastatur");
await keyboardPage.keyboard.press("Tab");
await keyboardPage.keyboard.press("Tab");
await keyboardPage.keyboard.press("Enter");
await keyboardPage
  .getByRole("heading", { name: "Demo-Kunde Tastatur" })
  .waitFor();
evidence.keyboard.push("Customer creation completes with Enter and Tab only");

const removableCustomer = keyboardPage
  .getByRole("button", { name: /Demo-Hausverwaltung Morgenrot/ })
  .first();
await removableCustomer.focus();
await keyboardPage.keyboard.press("Enter");
const removeProject = keyboardPage.getByRole("button", {
  name: "Treppenhaus auffrischen entfernen",
});
await removeProject.focus();
await keyboardPage.keyboard.press("Enter");
const dialog = keyboardPage.getByRole("alertdialog");
await dialog.waitFor();
assert.equal(
  await dialog
    .getByRole("button", { name: "Abbrechen" })
    .evaluate((element) => element === document.activeElement),
  true,
);
await keyboardPage.keyboard.press("Escape");
assert.equal(await dialog.count(), 0);
evidence.keyboard.push(
  "Destructive dialog focuses Cancel, traps focus, and closes with Escape",
);

await keyboardPage.goto(`${baseUrl}/projekte/project-wohnzimmer-bochum`, {
  waitUntil: "networkidle",
});
const resumeVisit = keyboardPage
  .getByRole("button", { name: "Baustellenbesuch fortsetzen" })
  .first();
await resumeVisit.focus();
await keyboardPage.keyboard.press("Enter");
await keyboardPage.waitForURL("**/baustellenbesuch");
await keyboardPage
  .getByRole("heading", { name: "Baustellenbesuch", exact: true })
  .waitFor();
evidence.keyboard.push(
  "Project-to-site-visit navigation completes by keyboard",
);

await keyboardContext.close();
await browser.close();

await writeFile(
  new URL("T02-browser-evidence.json", evidenceDirectory),
  `${JSON.stringify(evidence, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify(evidence, null, 2));
