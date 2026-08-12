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

| Thread | Branch                                  | Worker SHA | Review  | Focused gate | Integration SHA | Status        |
| ------ | --------------------------------------- | ---------- | ------- | ------------ | --------------- | ------------- |
| T01    | `codex/vs-t01-domain-data`              | Pending    | Pending | Pending      | Pending         | Running       |
| T08    | `codex/vs-t08-security-privacy`         | Pending    | Pending | Pending      | Pending         | Queued wave 2 |
| T09    | `codex/vs-t09-platform-quality`         | Pending    | Pending | Pending      | Pending         | Queued wave 2 |
| T03    | `codex/vs-t03-evidence-capture`         | Pending    | Pending | Pending      | Pending         | Running       |
| T04    | `codex/vs-t04-ai-extraction`            | Pending    | Pending | Pending      | Pending         | Running       |
| T05    | `codex/vs-t05-pricebook-mapping`        | Pending    | Pending | Pending      | Pending         | Running       |
| T06    | `codex/vs-t06-clarification-provenance` | Pending    | Pending | Pending      | Pending         | Running       |
| T02    | `codex/vs-t02-web-projects`             | Pending    | Pending | Pending      | Pending         | Running       |
| T07    | `codex/vs-t07-review-export`            | Pending    | Pending | Pending      | Pending         | Queued wave 2 |
| T10    | `codex/vs-t10-e2e-release-evidence`     | Pending    | Pending | Pending      | Pending         | Queued wave 2 |

## Growing Gates

| Checkpoint              | Commands                                                                                                  | Result  | Evidence / correction                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------- |
| Contract Freeze         | `npm run typecheck`; `npm run lint`; `npm run format:check`; `npm test`; production audit and secret scan | Pass    | Bootstrap evidence in the execution plan |
| T01 integrated          | Pending                                                                                                   | Pending | Pending                                  |
| T08 integrated          | Pending                                                                                                   | Pending | Pending                                  |
| T09 integrated          | Pending                                                                                                   | Pending | Pending                                  |
| T03 integrated          | Pending                                                                                                   | Pending | Pending                                  |
| T04 integrated          | Pending                                                                                                   | Pending | Pending                                  |
| T05 integrated          | Pending                                                                                                   | Pending | Pending                                  |
| T06 integrated          | Pending                                                                                                   | Pending | Pending                                  |
| T02 integrated          | Pending                                                                                                   | Pending | Pending                                  |
| T07 integrated          | Pending                                                                                                   | Pending | Pending                                  |
| T10 integrated          | Pending                                                                                                   | Pending | Pending                                  |
| Final clean environment | Pending                                                                                                   | Pending | Pending                                  |

## Publication

- Integration branch pushed to `origin` after Contract Freeze.
- Draft integration PR targets `main` and must remain Draft.
- Worker branches are pushed only after focused review; worker PRs target the integration branch.
- No branch or PR may merge to `main` during this execution.
