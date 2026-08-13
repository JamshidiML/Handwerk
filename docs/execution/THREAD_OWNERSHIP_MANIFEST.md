# Thread Ownership Manifest

## Frozen Coordinator Paths

After `BASELINE_SHA`, only the coordinator may change `packages/contracts/**`, this manifest, root workspace configuration, the root lockfile, and integration records. T09 may change root configuration, lockfile, CI, and shared quality tooling through its assigned branch. Contract changes require a request under `docs/execution/contract-change-requests/`.

## Workstream Ownership

| Thread | Branch                                  | Owned paths                                                                                                                       |
| ------ | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| T01    | `codex/vs-t01-domain-data`              | `packages/domain/**`, `packages/db/**`, migrations and owned tests                                                                |
| T02    | `codex/vs-t02-web-projects`             | web shell/components/tokens and `apps/web/app/**`, `apps/web/src/features/customers-projects/**` except feature paths owned below |
| T03    | `codex/vs-t03-evidence-capture`         | `packages/media/**`, `apps/web/src/features/capture/**`, synthetic media assets                                                   |
| T04    | `codex/vs-t04-ai-extraction`            | `packages/ai/**`, extraction adapters/tests/fixtures                                                                              |
| T05    | `codex/vs-t05-pricebook-mapping`        | `packages/pricebook/**`, `apps/web/src/features/pricebook/**`, price-book fixtures                                                |
| T06    | `codex/vs-t06-clarification-provenance` | `packages/provenance/**`, `apps/web/src/features/clarifications/**`                                                               |
| T07    | `codex/vs-t07-review-export`            | `packages/exports/**`, `apps/web/src/features/offer-review/**`, export templates/fixtures                                         |
| T08    | `codex/vs-t08-security-privacy`         | `packages/security/**`, `apps/web/src/features/privacy/**`, `docs/security/**`                                                    |
| T09    | `codex/vs-t09-platform-quality`         | root tooling/lockfile, `.github/workflows/**`, `infra/local/**`, `packages/observability/**`, operator config                     |
| T10    | `codex/vs-t10-e2e-release-evidence`     | `tests/e2e/**`, `fixtures/synthetic/**`, `docs/demo/**`, traceability and release evidence                                        |

Every thread also owns only its report at `docs/execution/thread-reports/Txx.md` and its numbered contract/dependency requests. Shared web integration is coordinator-owned; workers expose typed components/services through their owned paths.

## Change Protocol

Workers must not privately fork contracts, dependencies, architecture, package manager, formatter, test runner, lockfile, or CI. A request must state reason, compatibility, diff, migration impact, tests, license, maintenance, and security impact as applicable. Work may continue against an adapter while the coordinator decides.
