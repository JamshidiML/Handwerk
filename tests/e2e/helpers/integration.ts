import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const integratedE2E = process.env.HANDWERK_E2E_INTEGRATED === "1";

export const routes = {
  home: "/demo",
  project: (projectId: string) => `/demo/projects/${projectId}`,
  capture: (projectId: string) => `/demo/projects/${projectId}/capture`,
  offer: (projectId: string) => `/demo/projects/${projectId}/offer`,
} as const;

export type ScenarioId =
  | "canonical-capture"
  | "canonical-needs-clarification"
  | "canonical-ready-review"
  | "canonical-approved"
  | "unknown-mapping"
  | "invalid-model-output"
  | "hallucinated-code"
  | "photo-only-measurement"
  | "prompt-injection"
  | "stale-approval"
  | "malicious-csv"
  | "data-rights";

export type FaultId =
  | "UPLOAD_ONCE"
  | "EXTRACTION_INVALID_OUTPUT_ONCE"
  | "EXPORT_CSV_ONCE"
  | "EXPORT_PDF_ONCE";

function e2eHeaders(): Record<string, string> {
  const token = process.env.HANDWERK_E2E_TEST_TOKEN;
  if (!token) {
    throw new Error(
      "HANDWERK_E2E_TEST_TOKEN is required when HANDWERK_E2E_INTEGRATED=1",
    );
  }
  return { "x-handwerk-e2e-token": token };
}

export async function seedScenario(
  request: APIRequestContext,
  scenario: ScenarioId,
): Promise<void> {
  const response = await request.post("/api/test-support/e2e/scenario", {
    headers: e2eHeaders(),
    data: { fixtureSetId: "handwerk-synthetic-v1", scenario },
  });
  expect(response.ok(), await response.text()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({
    ok: true,
    fixtureSetId: "handwerk-synthetic-v1",
    scenario,
  });
}

export async function setFault(
  request: APIRequestContext,
  fault: FaultId,
): Promise<void> {
  const response = await request.post("/api/test-support/e2e/fault", {
    headers: e2eHeaders(),
    data: { fault },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

export async function clearFaults(request: APIRequestContext): Promise<void> {
  const response = await request.delete("/api/test-support/e2e/fault", {
    headers: e2eHeaders(),
  });
  expect(response.ok(), await response.text()).toBe(true);
}

export async function installDeniedMicrophone(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const denied = async () => {
      throw new DOMException(
        "Synthetic E2E microphone denial",
        "NotAllowedError",
      );
    };
    if (navigator.mediaDevices) {
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: denied,
      });
      return;
    }
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: denied },
    });
  });
}
