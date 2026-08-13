# Vertical Slice V1 Integration Record

## Identity

| Field                            | Value                                            |
| -------------------------------- | ------------------------------------------------ |
| Approved base                    | `main` at `7a65429`                              |
| Integration branch               | `codex/handwerk-vertical-slice-v1`               |
| Contract Freeze / `BASELINE_SHA` | `7632cf2`                                        |
| Bootstrap coordinator record     | `8a6e0fb`                                        |
| Worker concurrency               | Six concurrent workers; T01-T06 then T07-T10     |
| Deployment                       | None; production deployment prohibited           |
| Data class                       | Synthetic fixtures and in-memory demo state only |

## Workstream Integration

| Thread | Branch                                  | Worker SHA           | Draft PR | Integration SHA | Focused evidence                                         | Status     |
| ------ | --------------------------------------- | -------------------- | -------- | --------------- | -------------------------------------------------------- | ---------- |
| T01    | `codex/vs-t01-domain-data`              | `707b710`            | #7       | `81549b1`       | 52 domain + 4 DB unit; 11 PostgreSQL integration         | Integrated |
| T08    | `codex/vs-t08-security-privacy`         | `da85136`, `fde68d5` | #8       | `8829163`       | 25 security tests; SEC-001 regression                    | Integrated |
| T09    | `codex/vs-t09-platform-quality`         | `c68cf2f`            | #11      | `57b1c42`       | CI, configuration, observability, audit, tooling checks  | Integrated |
| T03    | `codex/vs-t03-evidence-capture`         | `f41e7f5`            | #6       | `2a06bcf`       | 22 media and 18 capture tests                            | Integrated |
| T04    | `codex/vs-t04-ai-extraction`            | `9491e7a`            | #2       | `0ebb6c9`       | 33 deterministic extraction tests                        | Integrated |
| T05    | `codex/vs-t05-pricebook-mapping`        | `70b48d9`            | #4       | `684757d`       | 35 price-book/mapping tests                              | Integrated |
| T06    | `codex/vs-t06-clarification-provenance` | `4a96cbb`            | #3       | `c465826`       | 16 package plus 7 UI tests                               | Integrated |
| T02    | `codex/vs-t02-web-projects`             | `42ff88b`            | #5       | `995cd4b`       | Web build/render, viewport, keyboard, Axe evidence       | Integrated |
| T07    | `codex/vs-t07-review-export`            | `313837e`            | #9       | `a20edf3`       | 13 export and 6 review UI tests; rendered PDF            | Integrated |
| T10    | `codex/vs-t10-e2e-release-evidence`     | `3a7ac73`            | #10      | `d47ed76`       | 35 integrated fixture/browser/accessibility/safety tests | Integrated |

The mandated merge order was observed: T01, T08, T09, T03, T04, T05, T06, T02, T07, T10. The coordinator corrections after merge are recorded in `CORRECTION_LOG.md`.

## Integrated Gates

| Gate                   | Command or evidence                                                                     | Result                                                                                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quality                | `npm run ci:quality`                                                                    | Passed after coordinator lint corrections                                                                                                                           |
| Root build and test    | `npm test`                                                                              | 272 passed; 11 PostgreSQL integration tests correctly skipped without the explicit synthetic test URL                                                               |
| Web feature components | `vitest run --config vitest.config.ts apps/web/src/features`                            | 32 tests passed                                                                                                                                                     |
| Web build/render       | `npm run build --workspace @handwerk/web`; rendered HTML tests                          | Passed; 5 rendered HTML tests                                                                                                                                       |
| PostgreSQL             | Isolated synthetic migration twice, seed, `test:integration --workspace @handwerk/db`   | Migrations idempotent; 11 tests passed                                                                                                                              |
| Browser                | `npm run test:e2e`                                                                      | Local branch: 35 passed in 50.6s; detached checkout: 35 passed in 1.1m; fresh Vinext server owned by Playwright                                                     |
| Secrets                | `npm run security:secrets`                                                              | 327 files scanned; no potential secrets                                                                                                                             |
| Production audit       | `npm run security:audit:prod`                                                           | 0 vulnerabilities                                                                                                                                                   |
| Policy audit           | `npm run security:audit`                                                                | 0 critical; two time-bounded dev-tool exceptions through 2026-08-26                                                                                                 |
| Inventory/SBOM         | `npm run security:inventory`; `npm run security:sbom`                                   | 761-entry inventory and CycloneDX SBOM generated locally and in CI                                                                                                  |
| Clean checkout         | Detached `99e880b` checkout; every required Cycle 2 command                             | Install: 582 packages; inventory/quality passed; 272 root passed with 11 expected DB skips; 11 DB integration passed; 35 E2E passed; secrets and both audits passed |
| Hosted CI              | PR run [`31696348445`](https://github.com/JamshidiML/Handwerk/actions/runs/31696348445) | All six jobs passed on attempt 1 for `99e880b`; native Ubuntu browser acceptance passed 35/35                                                                       |
| Hosted artifact        | `dependency-evidence`, artifact `9179465931`                                            | 97,986-byte ZIP retained for 14 days; exactly `dependency-inventory.json` and `sbom.cdx.json`                                                                       |

The former interrupted clean-worktree build is not counted as evidence. Cycle 2 repeated every required command on the branch and at a clean detached checkout. A disposable Linux x86_64 Noble/glibc container proved the only `npm ci` installed `@tailwindcss/oxide-linux-x64-gnu@4.2.1` and `lightningcss-linux-x64-gnu@1.31.1`; its cold Vinext build completed. Under Apple-hosted x86_64 emulation, 7 of 35 local browser cases exceeded the unchanged 30-second timeout, so that run is not a pass. Native hosted Ubuntu is the cross-platform browser authority and passed 35/35.

## Cycle 2 Hosted Jobs

| Job                                                                                                                      |            ID | Result                    | Duration |
| ------------------------------------------------------------------------------------------------------------------------ | ------------: | ------------------------- | -------: |
| [Quality (Node 22.13.0)](https://github.com/JamshidiML/Handwerk/actions/runs/31696348445/job/94434894881)                | `94434894881` | Passed                    |   1m 24s |
| [Quality (Node 26.3.0)](https://github.com/JamshidiML/Handwerk/actions/runs/31696348445/job/94434894875)                 | `94434894875` | Passed                    |   1m 22s |
| [Unit and build](https://github.com/JamshidiML/Handwerk/actions/runs/31696348445/job/94434894916)                        | `94434894916` | Passed                    |   1m 22s |
| [PostgreSQL integration and migrations](https://github.com/JamshidiML/Handwerk/actions/runs/31696348445/job/94434894909) | `94434894909` | Passed                    |      50s |
| [Browser acceptance](https://github.com/JamshidiML/Handwerk/actions/runs/31696348445/job/94434894831)                    | `94434894831` | Passed, 35/35             |   2m 24s |
| [Secrets, audit, and inventory](https://github.com/JamshidiML/Handwerk/actions/runs/31696348445/job/94434894908)         | `94434894908` | Passed, artifact uploaded |      47s |

Run `31696348445` was a `pull_request` event for head `99e880b59ec2fdc1dedfc8f33bab69804154e463`. There were no retries.

## Publication

- Draft integration PR targets `main`: https://github.com/JamshidiML/Handwerk/pull/1
- `main` remains at the approved base and was never modified after bootstrap.
- No production deployment, production credential, external paid AI call, or real customer data was used.
