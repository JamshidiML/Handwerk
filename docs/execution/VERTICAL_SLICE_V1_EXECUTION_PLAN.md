# Vertical Slice V1 Execution Plan

## Mission

Build an internal, synthetic-data-only quotation copilot for the canonical Malerbetrieb Westblick journey. This is product evidence for discovery, not a production launch or proof of product-market fit.

## Coordinator Bootstrap

- Base branch: `main`
- Integration branch: `codex/handwerk-vertical-slice-v1`
- Package manager: npm workspaces with a single root lockfile
- Runtime: Node.js 26.3.0 locally; minimum supported version 22.13.0
- Architecture: TypeScript modular monolith with Vinext/React web surface, PostgreSQL-oriented persistence interfaces and migrations, local/demo adapters, object-storage abstraction, deterministic fake AI, and versioned contracts
- Deployment: prohibited for this execution
- Data: synthetic fixtures only; no customer data or real site media
- Contract version: `handwerk.vertical-slice.v1`
- `BASELINE_SHA`: populated after the bootstrap commit

## Baseline Evidence

Recorded on 12 August 2026 before worker branches were created:

| Gate                        | Command                                                           | Result                                                                                                                            |
| --------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Clean install               | `npm ci --ignore-scripts --no-audit --no-fund`                    | Pass; 592 packages installed from the root lockfile                                                                               |
| Type check                  | `npm run typecheck`                                               | Pass across web, contracts, and domain workspaces                                                                                 |
| Lint                        | `npm run lint`                                                    | Pass                                                                                                                              |
| Formatting                  | `npm run format:check`                                            | Pass                                                                                                                              |
| Build and starter test      | `npm test`                                                        | Pass; build plus 2 rendered-HTML tests                                                                                            |
| Production dependency audit | `npm audit --omit=dev --audit-level=high`                         | Pass; zero findings                                                                                                               |
| Full dependency audit       | `npm audit --audit-level=critical`                                | Development-tool findings remain; critical Vitest finding patched before freeze, remaining high/moderate findings assigned to T09 |
| Secret scan                 | repository pattern scan for private keys and common token formats | Pass; zero matches                                                                                                                |

The starter test is baseline-only and is expected to be replaced by product acceptance tests. Docker is installed, but the bootstrap has no migrations or database service to validate yet; T01 and T09 own those gates.

## Execution Waves

All ten workstreams start from the same `BASELINE_SHA`. The coordinator uses the maximum agent concurrency actually available, in waves if fewer than ten workers are supported.

| Thread | Scope                                       | Gate                                    |
| ------ | ------------------------------------------- | --------------------------------------- |
| T01    | Domain, persistence, state and calculations | Invariants 1, 5, 6, 8, 9, 10            |
| T02    | Web shell and customer/project flow         | Responsive and accessible navigation    |
| T03    | Evidence capture and media                  | Safe mobile capture; photo context only |
| T04    | AI provider and extraction                  | Deterministic fail-closed parsing       |
| T05    | Price book and mapping                      | Approved same-tenant entries only       |
| T06    | Clarifications and provenance               | Canonical questions and citations       |
| T07    | Review, approval, PDF and CSV               | Approval-gated consistent exports       |
| T08    | Security, privacy and audit                 | Tenant isolation and redaction          |
| T09    | Platform, CI and observability              | Reproducible local and CI gates         |
| T10    | E2E, fixtures and release evidence          | Canonical and safety journeys           |

## Integration Order

T01, T08, T09, T03, T04, T05, T06, T02, T07, then T10. Each merge receives focused verification before the growing integrated gate runs.

## Required Final Gates

1. Clean install and build from the root lockfile.
2. Format, lint, type-check, unit, integration, contract, and E2E tests.
3. Migration and synthetic seed verification.
4. Canonical mobile and desktop journey with deterministic AI.
5. PDF render inspection and CSV reconciliation.
6. Secret, sensitive-data, tenant-isolation, audit-redaction, and dependency checks.
7. Score at least 85/100 with no critical invariant failure.
