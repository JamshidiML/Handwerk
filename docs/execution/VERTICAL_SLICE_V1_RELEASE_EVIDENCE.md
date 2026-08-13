# Vertical Slice V1 Release Evidence

## Integrated Local Record

| Item                       | Evidence                                                                                                                                                                                                                           | Result                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Synthetic fixture contract | `npm run test:e2e:fixtures`                                                                                                                                                                                                        | 9 passed                                                                  |
| Browser acceptance         | `npm run test:e2e` with Playwright-managed fresh local `vinext start`                                                                                                                                                              | 35 passed in 7.9s; desktop and 390px mobile                               |
| Keyboard and accessibility | Canonical browser spec with first-focus assertion and Axe WCAG 2 A/AA serious/critical filter                                                                                                                                      | Passed at both viewport projects                                          |
| Recovery and safety        | Six Cycle 1 scenarios plus denied microphone, approval, route, and deletion checks                                                                                                                                                 | Passed at both viewport projects                                          |
| PDF output                 | [Synthetic PDF fixture](https://github.com/JamshidiML/Handwerk/blob/c4a98f658f2773dfa7d18f5a75912e09c459ece5/packages/exports/fixtures/generated/Angebot-SYN-WB-2026-0007.pdf)                                                     | Rendered and visually inspected as a three-page synthetic offer           |
| CSV output                 | [Synthetic CSV fixture](https://github.com/JamshidiML/Handwerk/blob/c4a98f658f2773dfa7d18f5a75912e09c459ece5/packages/exports/fixtures/generated/Angebot-SYN-WB-2026-0007.csv) and `fixtures/synthetic/exports/offer.expected.csv` | Export package tests reconcile deterministic amounts and formula escaping |
| Security/privacy           | T08 regression for same-tenant foreign-project citation disclosure; privacy UI tests                                                                                                                                               | SEC-001 closed; export uses strict projections                            |
| Production deployment      | Repository and local commands reviewed                                                                                                                                                                                             | None performed                                                            |

The browser suite uses the deterministic in-memory synthetic workspace. It does not invoke a paid AI provider, test-support HTTP adapter, real customer record, or production service. `test-results/e2e/.last-run.json` reports `passed` with no failed tests.

## Cycle 1 Gate Record

The detached Cycle 1 checkout completed `npm ci --ignore-scripts --no-audit --no-fund` (582 packages in 6s), workspace inventory, `npm run ci:quality`, `npm test` (270 passed; 11 database integration tests skipped without the explicit synthetic test URL), `npm run test:integration` (11 passed against the isolated synthetic PostgreSQL URL), `npm run test:e2e` (35 passed in 8.4s), secrets scan, production audit (zero vulnerabilities), and policy audit. Playwright rejects a reused server, so a current built app is always started by the test command. Final acceptance still requires a passing GitHub workflow for the correction SHA; interrupted work is never counted as a pass.

## Cycle 2 Cross-Platform and Hosted Record

Implementation correction [`99e880b`](https://github.com/JamshidiML/Handwerk/commit/99e880b59ec2fdc1dedfc8f33bab69804154e463) makes the Tailwind Linux x64 GNU binding an exact optional web dependency, commits npm-generated registry metadata for it, narrows the hidden artifact upload to two files, and resolves the extensionless local Vite plugin import with `.js` under bundler resolution. Correction [`ffcfdd3`](https://github.com/JamshidiML/Handwerk/commit/ffcfdd3ac6ab97b67aba09d4d4b411c9fb7d5fef) prevents the dedicated PostgreSQL job from succeeding with skipped tests by scoping the exact synthetic URL and enforcing required mode. The separate JSON import-attributes warning remains non-blocking and unsuppressed.

| Environment / gate       | Result                                                                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Disposable Linux         | `mcr.microsoft.com/playwright:v1.62.1-noble`, `linux/amd64`, Ubuntu Noble, glibc 2.39, Node 26.3.0, npm 11.16.0                                                                               |
| Linux clean install      | One `npm ci --ignore-scripts --no-audit --no-fund`; 575 packages; both `@tailwindcss/oxide-linux-x64-gnu@4.2.1` and `lightningcss-linux-x64-gnu@1.31.1` present                               |
| Linux quality/build/root | Workspace graph and `ci:quality` passed; cold Vinext build completed; root suite passed with the expected database skips                                                                      |
| Linux emulated browser   | 28/35 passed; 7 exceeded the unchanged 30-second timeout under Apple-hosted x86_64 emulation; not counted as a pass                                                                           |
| Local integration branch | Quality, 273 root, required-mode PostgreSQL 11/11, 35 browser, and the negative required-mode URL check all passed                                                                            |
| Clean detached `ffcfdd3` | One 582-package install; graph, quality, 273 root, PostgreSQL 11/11, browser 35/35, 327-file secret scan, zero production vulnerabilities, exact policy audit, inventory, and SBOM all passed |
| Native hosted Ubuntu     | PR run [`31699278297`](https://github.com/JamshidiML/Handwerk/actions/runs/31699278297) passed all six jobs on attempt 1; PostgreSQL passed 11/11 and Browser acceptance passed 35/35         |
| Hosted evidence          | Artifact `dependency-evidence` (`9180580274`, 97,987 bytes, 14-day retention) contains exactly `dependency-inventory.json` (175,318 bytes) and `sbom.cdx.json` (658,346 bytes)                |

The Linux container did not reuse host `node_modules` and did not perform a second install. The successful hosted browser run is the native Linux compatibility result; the slower emulated run is retained as a disclosed non-pass rather than reclassified or weakened.

Hosted run `31696348445` initially appeared green after the native-binding correction, but its PostgreSQL logs showed 11 skipped tests. It is not counted as database evidence. The required-mode regression turns that configuration into a failure, and replacement run `31699278297` records 11 passed with zero skipped in job `94444201112`.

## Deliberate Limits

- This is an internal synthetic vertical slice, not a production deployment or legal/privacy certification.
- Demo state is intentionally in-memory. A confirmed demo deletion removes the active browser-session project; refresh restores the seeded fixture.
- Deterministic synthetic analysis replaces any paid or live AI integration.
