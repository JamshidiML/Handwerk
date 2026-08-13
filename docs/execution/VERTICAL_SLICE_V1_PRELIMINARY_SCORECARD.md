# Vertical Slice V1 Cycle 1 Scorecard

This is the coordinator's evidence-based assessment of the internal synthetic slice. It is not a production-readiness, legal, privacy-compliance, or market-validation claim.

| Quality area                           |  Weight | Evidence                                                                                                                                     |  Score |
| -------------------------------------- | ------: | -------------------------------------------------------------------------------------------------------------------------------------------- | -----: |
| End-to-end customer value              |      20 | 35-test desktop/mobile browser matrix captures evidence, resolves questions, approves, exports, audits, exports data, and deletes demo state |     19 |
| Price-book accuracy and calculations   |      15 | 35 price-book/mapping tests, 13 export tests, integer minor-unit reconciliation, approved synthetic items only                               |     14 |
| Uncertainty, provenance, human control |      15 | Blocking clarifications, visible provenance, explicit approval, and invalidation browser safety test                                         |     15 |
| Privacy, security, tenant isolation    |      15 | T08 suite, SEC-001 strict-projection regression, neutral route, secret scan, production audit                                                |     13 |
| Test quality and reproducibility       |      15 | 270 root-test passes, 35 browser passes, exact safety recovery coverage, and a fresh-server browser contract                                 |     15 |
| Mobile UX and accessibility            |       8 | 390px Chromium journey, manual viewport inspection, keyboard focus, Axe serious/critical smoke                                               |      8 |
| Architecture and maintainability       |       7 | Frozen contracts, package boundaries, public browser entrypoints, serial root test wiring                                                    |      6 |
| Operations and observability           |       5 | CI workflow, runbook, SBOM, local health/config/redaction coverage                                                                           |      4 |
| **Total**                              | **100** | Detached clean-checkout gate complete; GitHub CI remains required                                                                            | **94** |

## Score Boundaries

- The numerical score is not an acceptance decision until the final correction SHA completes GitHub CI. It does not remove production blockers.
- The former interrupted Vinext-build claim has been withdrawn. Cycle 1 completed a detached clean-checkout build and test run; it must be repeated after any later correction commit.
- Privacy/security retains a deduction for two documented development-tool audit exceptions (`vinext`, `image-size`) that expire on 2026-08-26, even though the production audit reports zero vulnerabilities.
- The slice deliberately excludes persistent multi-user authentication, managed secrets, hosted storage, external AI, production observability, backup/restore drills, legal review, and production deployment.
