import type { EntityId } from "@handwerk/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  CSRF_COOKIE_NAME,
  DEMO_IDENTITY_HEADER_NAME,
  SESSION_COOKIE_NAME,
  createTenantAuthorizationContext,
  loadTenantResource,
  toSafeApiError,
  validateSecurityConfiguration,
  type SecurityConfiguration,
} from "../src/index";
import {
  NOW,
  ORG_A,
  ORG_B,
  USER_A,
  createContext,
  createMembership,
} from "./helpers";

const SESSION = "session_token_abcdefghijklmnopqrstuvwxyz123456";
const CSRF = "csrf_token_abcdefghijklmnopqrstuvwxyz123456789";

function configuration(
  overrides: Partial<SecurityConfiguration> = {},
): SecurityConfiguration {
  return {
    environment: "test",
    secureCookies: true,
    sessionMaxAgeSeconds: 3_600,
    demoIdentity: {
      enabled: true,
      userId: USER_A,
      organisationId: ORG_A,
      sessionId: SESSION,
    },
    ...overrides,
  };
}

describe("tenant authorization context", () => {
  it("derives the organisation from a verified session and ignores spoofed tenant headers", async () => {
    const sessions = {
      resolveSession: vi.fn(async () => ({
        userId: USER_A,
        organisationId: ORG_A,
        sessionId: SESSION,
        expiresAtEpochMs: Date.parse(NOW) + 60_000,
        method: "SESSION" as const,
      })),
    };
    const memberships = {
      findActiveMembership: vi.fn(async () => createMembership()),
    };

    const context = await createTenantAuthorizationContext(
      {
        method: "GET",
        requestId: "request-session-1",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${SESSION}`,
          "x-organisation-id": ORG_B,
        },
      },
      configuration(),
      { sessions, memberships, now: () => Date.parse(NOW) },
    );

    expect(context.organisationId).toBe(ORG_A);
    expect(context.demoMode).toBe(false);
    expect(memberships.findActiveMembership).toHaveBeenCalledWith(
      USER_A,
      ORG_A,
    );
  });

  it("uses demo identity only after an explicit non-production request", async () => {
    const dependencies = {
      sessions: { resolveSession: vi.fn(async () => null) },
      memberships: {
        findActiveMembership: vi.fn(async () => createMembership()),
      },
      now: () => Date.parse(NOW),
    };
    await expect(
      createTenantAuthorizationContext(
        { method: "GET", requestId: "request-demo-no", headers: {} },
        configuration(),
        dependencies,
      ),
    ).rejects.toMatchObject({ code: "AUTHENTICATION_REQUIRED" });

    const context = await createTenantAuthorizationContext(
      {
        method: "GET",
        requestId: "request-demo-yes",
        headers: { [DEMO_IDENTITY_HEADER_NAME]: "enabled" },
      },
      configuration(),
      dependencies,
    );
    expect(context.demoMode).toBe(true);
    expect(context.organisationId).toBe(ORG_A);
  });

  it("hard-fails configuration when demo authentication is enabled in production", () => {
    expect(() =>
      validateSecurityConfiguration(
        configuration({ environment: "production", secureCookies: true }),
      ),
    ).toThrowError(/Demo-Authentifizierung/);
  });

  it("requires a matching CSRF cookie and header for mutations", async () => {
    const dependencies = {
      sessions: { resolveSession: vi.fn(async () => null) },
      memberships: {
        findActiveMembership: vi.fn(async () => createMembership()),
      },
      now: () => Date.parse(NOW),
    };
    const request = {
      method: "POST",
      requestId: "request-csrf-1",
      headers: {
        [DEMO_IDENTITY_HEADER_NAME]: "enabled",
        cookie: `${CSRF_COOKIE_NAME}=${CSRF}`,
        "x-handwerk-csrf": `${CSRF}wrong`,
      },
    };
    await expect(
      createTenantAuthorizationContext(request, configuration(), dependencies),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    request.headers["x-handwerk-csrf"] = CSRF;
    await expect(
      createTenantAuthorizationContext(request, configuration(), dependencies),
    ).resolves.toMatchObject({ demoMode: true, organisationId: ORG_A });
  });

  it("fails closed for both missing and cross-tenant resources", async () => {
    const context = createContext();
    const missingStore = {
      findByIdForOrganisation: vi.fn(async () => null),
    };
    const crossTenantStore = {
      findByIdForOrganisation: vi.fn(async () => ({
        id: "resource-b" as EntityId,
        organisationId: ORG_B,
        createdAt: NOW,
        updatedAt: NOW,
        version: 1,
      })),
    };

    const errors: unknown[] = [];
    for (const store of [missingStore, crossTenantStore]) {
      try {
        await loadTenantResource(context, "resource-b", store);
      } catch (error) {
        errors.push(error);
      }
    }
    expect(errors).toHaveLength(2);
    for (const error of errors) {
      expect(toSafeApiError(error, context.requestId)).toMatchObject({
        code: "FORBIDDEN_OR_NOT_FOUND",
        message: "Die angeforderte Ressource wurde nicht gefunden.",
      });
    }
    expect(crossTenantStore.findByIdForOrganisation).toHaveBeenCalledWith(
      "resource-b",
      ORG_A,
    );
  });

  it("does not leak unexpected internal errors", () => {
    const error = toSafeApiError(
      new Error("database password and customer address"),
      "request-error-1",
    );
    expect(error).toEqual({
      code: "FAILED_SAFE",
      message: "Die Aktion wurde sicher abgebrochen.",
      requestId: "request-error-1",
    });
    expect(error.message).not.toContain("database");
  });
});
