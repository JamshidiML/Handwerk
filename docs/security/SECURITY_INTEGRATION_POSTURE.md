# Security Integration Posture

## Required Request Sequence

Every server route or action that handles tenant-owned data should use this order:

1. Validate the security configuration during process startup. Startup must stop when demo identity is enabled in production or production cookies are not secure.
2. Apply `buildSecurityHeaders()` to page/API responses. Sensitive and download responses remain `no-store`.
3. Enforce the route's body/file byte limit before parsing expensive content.
4. Call `createTenantAuthorizationContext()` using a cryptographically verified session resolver and active-membership resolver.
5. For mutations, let context creation verify the `__Host-handwerk_csrf` cookie against `x-handwerk-csrf`.
6. Parse unknown input with allowlisted keys and bounded values. Never deserialize organisation, actor, role, price, or authorization context from a request body.
7. Enforce the action capability, action-specific rate limit, and organisation-scoped repository lookup.
8. Convert failures with `toSafeApiError()`. Operational logs receive only `sanitizeLogFields()` output.
9. Record audit events through `AuditService`; do not pass raw request bodies or content.
10. Serve generated files with `buildSafeDownloadHeaders()` and a server-generated filename.

## Identity And Session Requirements

- `SessionIdentityResolver` is a trusted adapter boundary. It must verify session authenticity, expiration, revocation, and rotation server-side.
- The session identity contains actor and organisation. Client organisation headers are ignored.
- Active membership is checked for every context creation. Disabled users/memberships fail closed.
- Session IDs and CSRF tokens must be unguessable URL-safe values of at least 32 characters. Production entropy and rotation require review with the selected auth provider.
- Session cookies are `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and bounded to 12 hours. CSRF cookies are `Secure`, `SameSite=Strict`, and readable by the client solely to echo in the custom header.
- `__Host-` cookie helpers reject non-Secure configuration.
- Demo identity is a fixed synthetic user/organisation from server configuration. It also requires `x-handwerk-demo-identity: enabled` and cannot accept client identity fields.

The starter's `oai-authenticated-user-*` headers are not by themselves a production authentication design. The integration owner must establish which trusted proxy signs/strips them before using them as an identity source.

## Authorization Capabilities

| Role     | Read project | Export project data | Request deletion | Immediate demo delete | Read audit |
| -------- | ------------ | ------------------- | ---------------- | --------------------- | ---------- |
| Owner    | Yes          | Yes                 | Yes              | Yes                   | Yes        |
| Member   | Yes          | Yes                 | No               | No                    | No         |
| Reviewer | Yes          | Yes                 | No               | No                    | Yes        |

Unknown roles/actions fail closed. Persistence adapters must expose organisation-scoped methods; unscoped `findById` calls must not be used at request boundaries.

## Safe Errors And Downloads

- Missing, foreign, and unauthorized resources return `FORBIDDEN_OR_NOT_FOUND` with the same message.
- Unexpected exceptions return `FAILED_SAFE`; stack traces, SQL, credentials, customer text, and resource existence are not sent to the client.
- Validation returns bounded field keys/messages and never echoes hostile values.
- Download MIME types are limited to JSON, PDF, and UTF-8 CSV. Extensions are derived from MIME type, disposition is attachment, caching is disabled, and content sniffing is disabled.

## Audit And Logging

Audit event metadata is event-specific. Unknown keys are dropped. Allowed strings must be short token-shaped codes/IDs, which prevents raw prose from entering audit records through an allowed key. Numeric values must be non-negative safe integers.

Operational logging is more restrictive and allows only request/correlation IDs, event/outcome/code, duration/count, method, route template, and status. Do not log request/response bodies, transcript, captions, filenames, addresses, object keys, signed URLs, media bytes, prompts, provider payloads, cookies, authorization headers, or CSRF/session tokens.

## Coordinator Integration Actions

- T02/coordinator: wire privacy callbacks and response headers without importing server-only security code into the browser bundle.
- T01/coordinator: implement `PrivacyStore` with atomic same-tenant export reads and demo deletion transactions.
- T03/T04/T07: call the shared size/rate helpers at upload, extraction, and export boundaries.
- T09: reconcile the new `@handwerk/security` workspace into the frozen root lockfile, wire secret/dependency scans, add structured logging through the allowlist, and verify headers in the integrated server.
- T10: cover the browser-level project export/deletion confirmation flow and inspect integrated logs for raw-content absence.
