# Vertical Slice V1 Preliminary Scorecard

This is not the integrated release score. T10 has prepared the evidence harness, but the integrated application has not yet executed the canonical journey. Scoring missing evidence as passing would be misleading.

| Quality area                           | Weight | Current evidence                                             | Pre-integration outcome       |
| -------------------------------------- | -----: | ------------------------------------------------------------ | ----------------------------- |
| End-to-end customer value              |     20 | Browser journey is authored but not executable against peers | Not scored                    |
| Price-book accuracy and calculations   |     15 | Fixture relations and golden totals only                     | Not scored                    |
| Uncertainty, provenance, human control |     15 | Fixture assertions and browser contracts                     | Not scored                    |
| Privacy, security, tenant isolation    |     15 | Synthetic/cross-tenant test definitions; T08 dependency      | Not scored                    |
| Test quality and reproducibility       |     15 | Deterministic fixtures and conditional harness               | Not scored                    |
| Mobile UX and accessibility            |      8 | Mobile/desktop projects plus Axe/keyboard harness            | Not scored                    |
| Architecture and maintainability       |      7 | Centralised page object and adapter contract                 | Not scored                    |
| Operations and observability           |      5 | Local runbook/troubleshooting; T09 dependency                | Not scored                    |
| Total                                  |    100 | No integrated evidence                                       | Not eligible for release gate |

The coordinator may calculate a score only after a clean integrated environment has executed every critical traceability row. Passing requires at least 85/100, every area at least 60% of its weight, zero unresolved critical security/privacy defects, and no dangerous unflagged scope or pricing omission.
