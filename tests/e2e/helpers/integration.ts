import type { Page } from "@playwright/test";

export const routes = {
  home: "/",
  project: (projectId: string) => `/projekte/${projectId}`,
  capture: (projectId: string) => `/projekte/${projectId}/baustellenbesuch`,
  offer: (projectId: string) => `/projekte/${projectId}`,
} as const;

export async function installDeniedMicrophone(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const denied = async () => {
      throw new DOMException(
        "Synthetic E2E microphone denial",
        "NotAllowedError",
      );
    };
    const mediaDevices = { getUserMedia: denied };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: mediaDevices,
    });
  });
}
