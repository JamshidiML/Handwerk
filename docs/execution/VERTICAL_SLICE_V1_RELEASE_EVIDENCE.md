# Vertical Slice V1 Release Evidence

## Integrated Local Record

| Item                       | Evidence                                                                                                               | Result                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Synthetic fixture contract | `npm run test:e2e:fixtures`                                                                                            | 9 passed                                                                  |
| Browser acceptance         | `npm run test:e2e` with Playwright-managed local `vinext start`                                                        | 23 passed in 25.7s; desktop and 390px mobile                              |
| Keyboard and accessibility | Canonical browser spec with first-focus assertion and Axe WCAG 2 A/AA serious/critical filter                          | Passed at both viewport projects                                          |
| Recovery and safety        | Denied microphone, unresolved approval, invalidated approval, neutral unknown route, deletion acknowledgement          | Passed at both viewport projects                                          |
| PDF output                 | `packages/exports/fixtures/generated/Angebot-SYN-WB-2026-0007.pdf`                                                     | Rendered and visually inspected as a three-page synthetic offer           |
| CSV output                 | `packages/exports/fixtures/generated/Angebot-SYN-WB-2026-0007.csv` and `fixtures/synthetic/exports/offer.expected.csv` | Export package tests reconcile deterministic amounts and formula escaping |
| Security/privacy           | T08 regression for same-tenant foreign-project citation disclosure; privacy UI tests                                   | SEC-001 closed; export uses strict projections                            |
| Production deployment      | Repository and local commands reviewed                                                                                 | None performed                                                            |

The browser suite uses the deterministic in-memory synthetic workspace. It does not invoke a paid AI provider, test-support HTTP adapter, real customer record, or production service. `test-results/e2e/.last-run.json` reports `passed` with no failed tests.

## Remaining Final Gate

The local integrated browser run is complete. The coordinator still records the final clean-checkout install, full root quality/test gates, clean PostgreSQL migration/seed evidence, dependency audit, secret scan, and redaction inspection separately before declaring the internal slice complete.

## Deliberate Limits

- This is an internal synthetic vertical slice, not a production deployment or legal/privacy certification.
- Demo state is intentionally in-memory. A confirmed demo deletion removes the active browser-session project; refresh restores the seeded fixture.
- Deterministic synthetic analysis replaces any paid or live AI integration.
