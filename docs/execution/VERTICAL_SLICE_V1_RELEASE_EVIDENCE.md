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

The integrated checkout completed `npm run ci:quality`, `npm test` (270 passed; 11 database integration tests skipped without the explicit synthetic test URL), and the 35-test browser matrix. Playwright now rejects a reused server, so a current built app is always started by the test command. The final acceptance record is completed only after the detached clean checkout and GitHub workflow for the correction SHA finish; interrupted work is never counted as a pass.

## Deliberate Limits

- This is an internal synthetic vertical slice, not a production deployment or legal/privacy certification.
- Demo state is intentionally in-memory. A confirmed demo deletion removes the active browser-session project; refresh restores the seeded fixture.
- Deterministic synthetic analysis replaces any paid or live AI integration.
