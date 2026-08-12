# Vertical Slice V1 Integration Record

## Identity

| Field                            | Value                                                        |
| -------------------------------- | ------------------------------------------------------------ |
| Approved base                    | `main` at `7a65429`                                          |
| Integration branch               | `codex/handwerk-vertical-slice-v1`                           |
| Contract Freeze / `BASELINE_SHA` | `7632cf2`                                                    |
| Coordinator record SHA           | `8a6e0fb`                                                    |
| Worker concurrency               | 6 maximum concurrent workers; T01-T06 wave 1, T07-T10 wave 2 |
| Deployment                       | None; production deployment prohibited                       |
| Data class                       | Synthetic demo fixtures only                                 |

## Workstream Integration

The coordinator updates each row only after reviewing scope, commit history, diff, report evidence, and focused tests. Integration order follows the master prompt rather than completion time.

| Thread | Branch                                  | Worker SHA | Review                                                                | Focused gate                                                            | Integration SHA        | Status          |
| ------ | --------------------------------------- | ---------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------- | --------------- |
| T01    | `codex/vs-t01-domain-data`              | `707b710`  | Scope/code/report reviewed; Draft PR #7                               | 52 domain + 4 DB unit tests; 11 PostgreSQL integration tests pass       | `81549b1`              | Integrated      |
| T08    | `codex/vs-t08-security-privacy`         | `da85136`  | Scope/code/report reviewed; Draft PR #8; SEC-001 correction reviewed  | 25 security tests, privacy UI test, workspace type/lint/build/test pass | `8829163`              | Integrated      |
| T09    | `codex/vs-t09-platform-quality`         | Pending    | Pending                                                               | Pending                                                                 | Pending                | Running wave 2  |
| T03    | `codex/vs-t03-evidence-capture`         | `f41e7f5`  | Scope/code/report reviewed; Draft PR #6                               | 22 media tests, 18 capture tests, and workspace type-check pass         | Pending required order | Ready after T09 |
| T04    | `codex/vs-t04-ai-extraction`            | `9491e7a`  | Scope/code/report reviewed; Draft PR #2                               | 33 AI tests and package type-check pass                                 | Pending required order | Ready after T03 |
| T05    | `codex/vs-t05-pricebook-mapping`        | `70b48d9`  | Scope/code/report reviewed; Draft PR #4                               | 35 package tests and package type-check pass                            | Pending required order | Ready after T04 |
| T06    | `codex/vs-t06-clarification-provenance` | `4a96cbb`  | Scope/code/report reviewed; Draft PR #3                               | 16 package tests; 23 worker-focused tests                               | Pending required order | Ready after T05 |
| T02    | `codex/vs-t02-web-projects`             | `42ff88b`  | Scope/code/report and four viewport screenshots reviewed; Draft PR #5 | 5 web tests, build, zero axe violations, and keyboard checks pass       | Pending required order | Ready after T06 |
| T07    | `codex/vs-t07-review-export`            | Pending    | Pending                                                               | Pending                                                                 | Pending                | Running wave 2  |
| T10    | `codex/vs-t10-e2e-release-evidence`     | Pending    | Pending                                                               | Pending                                                                 | Pending                | Running wave 2  |

## Growing Gates

| Checkpoint              | Commands                                                                                                                   | Result  | Evidence / correction                                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract Freeze         | `npm run typecheck`; `npm run lint`; `npm run format:check`; `npm test`; production audit and secret scan                  | Pass    | Bootstrap evidence in the execution plan                                                                                                                        |
| T01 integrated          | `npm run typecheck`; `npm run lint`; `npm run format:check`; `npm run build`; `npm test`; T01 PostgreSQL integration suite | Pass    | 56 unit tests, 11 PostgreSQL integration tests, and 2 web tests pass. The first concurrent coordinator attempt raced two build writers; all serial reruns pass. |
| T08 integrated          | Security tests, privacy UI test, `npm run typecheck`; `npm run lint`; `npm run format:check`; `npm run build`; `npm test`  | Pass    | 25 security tests, 1 integration privacy UI test, 56 domain/DB unit tests, and 2 web tests pass. SEC-001 now redacts revision provenance.                       |
| T09 integrated          | Pending                                                                                                                    | Pending | Pending                                                                                                                                                         |
| T03 integrated          | Pending                                                                                                                    | Pending | Pending                                                                                                                                                         |
| T04 integrated          | Pending                                                                                                                    | Pending | Pending                                                                                                                                                         |
| T05 integrated          | Pending                                                                                                                    | Pending | Pending                                                                                                                                                         |
| T06 integrated          | Pending                                                                                                                    | Pending | Pending                                                                                                                                                         |
| T02 integrated          | Pending                                                                                                                    | Pending | Pending                                                                                                                                                         |
| T07 integrated          | Pending                                                                                                                    | Pending | Pending                                                                                                                                                         |
| T10 integrated          | Pending                                                                                                                    | Pending | Pending                                                                                                                                                         |
| Final clean environment | Pending                                                                                                                    | Pending | Pending                                                                                                                                                         |

## Publication

- Integration branch pushed to `origin` after Contract Freeze.
- Draft integration PR targets `main` and must remain Draft.
- Worker branches are pushed only after focused review; worker PRs target the integration branch.
- No branch or PR may merge to `main` during this execution.
