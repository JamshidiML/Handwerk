import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set(
    "test",
    `${process.pid}-${Date.now()}-${pathname}`,
  );
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(pathname, "http://localhost"), {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function renderHtml(pathname) {
  const response = await render(pathname);
  assert.equal(response.status, 200, `${pathname} should render successfully`);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  return response.text();
}

test("renders the operational German demo shell instead of starter metadata", async () => {
  const html = await renderHtml("/");

  assert.match(html, /<html[^>]*\blang="de"/i);
  assert.match(
    html,
    /<title>Angebots-Copilot \| Malerbetrieb Westblick<\/title>/i,
  );
  assert.match(html, /Malerbetrieb Westblick GmbH/);
  assert.match(html, /Interne Demo/);
  assert.match(html, /Guten Morgen, (?:<!-- -->)?Mohsen(?:<!-- -->)?\./);
  assert.match(html, /Wohnzimmer renovieren - Bochum/);
  assert.match(html, /Baustellenbesuch fortsetzen/);
  assert.match(html, /href="#main-content"/);
  assert.match(html, /aria-label="Hauptnavigation"/);
  assert.match(html, /aria-label="Hauptnavigation mobil"/);
  assert.doesNotMatch(
    html,
    /codex-preview|Starter Project|Your site is taking shape/i,
  );
  assert.doesNotMatch(html, /react-loading-skeleton/);
});

test("supports the customer-to-project-to-site-visit route journey", async () => {
  const customerHtml = await renderHtml("/kunden");
  assert.match(
    customerHtml,
    /<title>Kunden und Projekte \| Angebots-Copilot<\/title>/i,
  );
  assert.match(customerHtml, /Anna Becker/);
  assert.match(customerHtml, /Demo-Hausverwaltung Morgenrot/);
  assert.match(customerHtml, /Kunde anlegen/);
  assert.match(customerHtml, /href="\/projekte\/project-wohnzimmer-bochum"/);
  assert.match(customerHtml, /keine echten Kunden- oder Adressdaten/i);

  const projectHtml = await renderHtml("/projekte/project-wohnzimmer-bochum");
  assert.match(projectHtml, /Rückfragen offen/);
  assert.match(projectHtml, /2 offen/);
  assert.match(projectHtml, /52 m²/);
  assert.match(projectHtml, /20 m²/);
  assert.match(projectHtml, /KI-Vorschläge sind ein Arbeitsentwurf/);
  assert.match(
    projectHtml,
    /href="\/projekte\/project-wohnzimmer-bochum\/baustellenbesuch"/,
  );

  const visitHtml = await renderHtml(
    "/projekte/project-wohnzimmer-bochum/baustellenbesuch",
  );
  assert.match(visitHtml, /Besuch geöffnet/);
  assert.match(visitHtml, /Erfassung läuft/);
  assert.match(visitHtml, /Erfassung vorübergehend nicht verfügbar/);
  assert.match(visitHtml, /Fotos dienen ausschließlich als Kontext/);
});

test("formats synthetic project status, dates, money, and locations for de-DE", async () => {
  const html = await renderHtml("/projekte/project-demo-treppenhaus");

  assert.match(html, /Treppenhaus auffrischen/);
  assert.match(html, /Dortmund-Kreuzviertel/);
  assert.match(html, /Exportiert/);
  assert.match(html, /2\.491,86 €/);
  assert.match(html, /07\.08\.2026, 10:30 Uhr/);
  assert.doesNotMatch(html, /2,491\.86|08\/07\/2026/);
});

test("renders a recoverable product-specific state for unknown project IDs", async () => {
  const html = await renderHtml("/projekte/project-does-not-exist");

  assert.match(html, /Projekt nicht gefunden/);
  assert.match(html, /Zur Projektauswahl/);
  assert.match(html, /href="\/kunden"/);
});

test("keeps shared status and destructive patterns accessible and product-specific", async () => {
  const [dialog, connectivity, patterns, shell, registry] = await Promise.all([
    readFile(new URL("src/components/confirm-dialog.tsx", root), "utf8"),
    readFile(new URL("src/components/connectivity-notice.tsx", root), "utf8"),
    readFile(new URL("src/components/ui-patterns.tsx", root), "utf8"),
    readFile(new URL("src/components/app-shell.tsx", root), "utf8"),
    readFile(new URL("app/project-feature-registry.ts", root), "utf8"),
  ]);

  assert.match(dialog, /role="alertdialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /event\.key === "Escape"/);
  assert.match(dialog, /event\.key !== "Tab"/);
  assert.match(connectivity, /window\.addEventListener\("offline"/);
  assert.match(connectivity, /role="status"/);
  assert.match(patterns, /role=\{tone === "error" \? "alert" : "status"\}/);
  assert.match(patterns, /aria-live="polite"/);
  assert.match(shell, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(registry, /ProjectFeatureSlots/);
  assert.match(registry, /projectFeatureSlots/);
});
