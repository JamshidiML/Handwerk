import type {
  ApiContext,
  Membership,
  OrganisationId,
  TenantOwned,
  UserId,
} from "@handwerk/contracts";

import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  DEMO_IDENTITY_HEADER_NAME,
  SESSION_COOKIE_NAME,
  type SecurityConfiguration,
  validateSecurityConfiguration,
} from "./configuration";
import {
  authenticationRequired,
  forbiddenOrNotFound,
  validationFailed,
} from "./errors";
import {
  type HeaderSource,
  parseCookieHeader,
  readHeader,
} from "./http-security";
import {
  constantTimeEqual,
  validateEntityId,
  validateOpaqueToken,
} from "./validation";

export type MembershipRole = Membership["role"];
export type AuthenticationMethod = "SESSION" | "DEMO";
export type SecurityCapability =
  | "PROJECT_READ"
  | "PROJECT_EXPORT"
  | "PROJECT_DELETION_REQUEST"
  | "PROJECT_DEMO_DELETE"
  | "AUDIT_READ";

export interface SecurityRequest {
  method: string;
  headers: HeaderSource;
  requestId: string;
}

export interface VerifiedIdentity {
  userId: UserId;
  organisationId: OrganisationId;
  sessionId: string;
  expiresAtEpochMs: number;
  method: "SESSION";
}

export interface SessionIdentityResolver {
  resolveSession(sessionId: string): Promise<VerifiedIdentity | null>;
}

export interface MembershipResolver {
  findActiveMembership(
    userId: UserId,
    organisationId: OrganisationId,
  ): Promise<Pick<
    Membership,
    "userId" | "organisationId" | "role" | "active"
  > | null>;
}

export interface TenantAuthorizationContext extends ApiContext {
  authenticationMethod: AuthenticationMethod;
  role: MembershipRole;
  sessionId: string;
}

export interface TenantScopedStore<T extends TenantOwned> {
  findByIdForOrganisation(
    id: T["id"],
    organisationId: OrganisationId,
  ): Promise<T | null>;
}

const ROLE_CAPABILITIES: Readonly<
  Record<MembershipRole, ReadonlySet<SecurityCapability>>
> = {
  OWNER: new Set([
    "PROJECT_READ",
    "PROJECT_EXPORT",
    "PROJECT_DELETION_REQUEST",
    "PROJECT_DEMO_DELETE",
    "AUDIT_READ",
  ]),
  MEMBER: new Set(["PROJECT_READ", "PROJECT_EXPORT"]),
  REVIEWER: new Set(["PROJECT_READ", "PROJECT_EXPORT", "AUDIT_READ"]),
};

export async function createTenantAuthorizationContext(
  request: SecurityRequest,
  configuration: SecurityConfiguration,
  dependencies: {
    sessions: SessionIdentityResolver;
    memberships: MembershipResolver;
    now?: () => number;
  },
): Promise<TenantAuthorizationContext> {
  validateSecurityConfiguration(configuration);
  validateRequest(request);

  const cookies = parseCookieHeader(readHeader(request.headers, "cookie"));
  const sessionId = cookies.get(SESSION_COOKIE_NAME);
  const explicitDemoRequest =
    readHeader(request.headers, DEMO_IDENTITY_HEADER_NAME) === "enabled";
  let identity:
    | (Omit<VerifiedIdentity, "method"> & { method: AuthenticationMethod })
    | null = null;

  if (sessionId) {
    validateOpaqueToken(sessionId, "session");
    identity = await dependencies.sessions.resolveSession(sessionId);
  } else if (configuration.demoIdentity.enabled && explicitDemoRequest) {
    identity = {
      userId: configuration.demoIdentity.userId,
      organisationId: configuration.demoIdentity.organisationId,
      sessionId: configuration.demoIdentity.sessionId,
      expiresAtEpochMs: (dependencies.now?.() ?? Date.now()) + 60_000,
      method: "DEMO",
    };
  }

  if (!identity) authenticationRequired();
  validateEntityId(identity.userId, "identity.userId");
  validateEntityId(identity.organisationId, "identity.organisationId");
  validateOpaqueToken(identity.sessionId, "identity.sessionId");
  if (
    identity.method === "SESSION" &&
    (!sessionId || !constantTimeEqual(identity.sessionId, sessionId))
  ) {
    authenticationRequired();
  }
  if (identity.expiresAtEpochMs <= (dependencies.now?.() ?? Date.now())) {
    authenticationRequired();
  }

  enforceCsrfForMutation(request, cookies);

  const membership = await dependencies.memberships.findActiveMembership(
    identity.userId,
    identity.organisationId,
  );
  if (
    !membership ||
    !membership.active ||
    membership.userId !== identity.userId ||
    membership.organisationId !== identity.organisationId
  ) {
    forbiddenOrNotFound();
  }

  return {
    requestId: request.requestId,
    actorUserId: identity.userId,
    organisationId: identity.organisationId,
    demoMode: identity.method === "DEMO",
    authenticationMethod: identity.method,
    role: membership.role,
    sessionId: identity.sessionId,
  };
}

export function assertCapability(
  context: TenantAuthorizationContext,
  capability: SecurityCapability,
): void {
  if (!ROLE_CAPABILITIES[context.role]?.has(capability)) forbiddenOrNotFound();
}

export function assertTenantResource<
  T extends Pick<TenantOwned, "organisationId">,
>(
  context: TenantAuthorizationContext,
  resource: T | null | undefined,
): asserts resource is T {
  if (!resource || resource.organisationId !== context.organisationId) {
    forbiddenOrNotFound();
  }
}

export async function loadTenantResource<T extends TenantOwned>(
  context: TenantAuthorizationContext,
  id: string,
  store: TenantScopedStore<T>,
): Promise<T> {
  const validatedId = validateEntityId(id);
  const resource = await store.findByIdForOrganisation(
    validatedId,
    context.organisationId,
  );
  assertTenantResource(context, resource);
  return resource;
}

function validateRequest(request: SecurityRequest): void {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(request.requestId)) {
    validationFailed({ requestId: ["Ungültige Anfragekennung."] });
  }
  if (!/^[A-Z]+$/i.test(request.method) || request.method.length > 12) {
    validationFailed({ method: ["Ungültige HTTP-Methode."] });
  }
}

function enforceCsrfForMutation(
  request: SecurityRequest,
  cookies: ReadonlyMap<string, string>,
): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return;

  const cookieToken = cookies.get(CSRF_COOKIE_NAME);
  const headerToken = readHeader(request.headers, CSRF_HEADER_NAME);
  if (!cookieToken || !headerToken) {
    validationFailed({ csrfToken: ["CSRF-Schutzprüfung fehlgeschlagen."] });
  }
  validateOpaqueToken(cookieToken, "csrfToken");
  validateOpaqueToken(headerToken, "csrfToken");
  if (!constantTimeEqual(cookieToken, headerToken)) {
    validationFailed({ csrfToken: ["CSRF-Schutzprüfung fehlgeschlagen."] });
  }
}
