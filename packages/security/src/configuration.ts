import type { OrganisationId, UserId } from "@handwerk/contracts";

import { failedSafe, validationFailed } from "./errors";
import { validateEntityId, validateOpaqueToken } from "./validation";

export type RuntimeEnvironment = "development" | "test" | "production";

export interface DemoIdentityConfiguration {
  enabled: boolean;
  userId: UserId;
  organisationId: OrganisationId;
  sessionId: string;
}

export interface SecurityConfiguration {
  environment: RuntimeEnvironment;
  secureCookies: boolean;
  sessionMaxAgeSeconds: number;
  demoIdentity: DemoIdentityConfiguration;
}

export const SESSION_COOKIE_NAME = "__Host-handwerk_session";
export const CSRF_COOKIE_NAME = "__Host-handwerk_csrf";
export const CSRF_HEADER_NAME = "x-handwerk-csrf";
export const DEMO_IDENTITY_HEADER_NAME = "x-handwerk-demo-identity";

export function validateSecurityConfiguration(
  configuration: SecurityConfiguration,
): SecurityConfiguration {
  if (configuration.demoIdentity.enabled) {
    if (configuration.environment === "production") {
      failedSafe(
        "Demo-Authentifizierung darf in der Produktionsumgebung nicht aktiviert sein.",
      );
    }
    validateOpaqueToken(
      configuration.demoIdentity.sessionId,
      "demoIdentity.sessionId",
    );
    validateEntityId(configuration.demoIdentity.userId, "demoIdentity.userId");
    validateEntityId(
      configuration.demoIdentity.organisationId,
      "demoIdentity.organisationId",
    );
  }

  if (
    configuration.environment === "production" &&
    !configuration.secureCookies
  ) {
    failedSafe("Produktions-Cookies müssen als Secure markiert sein.");
  }

  if (
    !Number.isInteger(configuration.sessionMaxAgeSeconds) ||
    configuration.sessionMaxAgeSeconds < 300 ||
    configuration.sessionMaxAgeSeconds > 43_200
  ) {
    validationFailed({
      sessionMaxAgeSeconds: [
        "Die Sitzungsdauer muss zwischen 5 und 720 Minuten liegen.",
      ],
    });
  }

  return configuration;
}
