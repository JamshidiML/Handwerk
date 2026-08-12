# Risk Register

| ID    | Risk                                                                | Severity | Mitigation / Exit evidence                                                            | Owner           | Status    |
| ----- | ------------------------------------------------------------------- | -------: | ------------------------------------------------------------------------------------- | --------------- | --------- |
| R-001 | Price or scope invented outside the approved company price book     | Critical | Allowlist mapping, same-tenant checks, prohibited AI price fields, negative tests     | T01/T04/T05     | Open      |
| R-002 | Unknown substrate or ceiling inclusion silently defaulted           | Critical | Blocking canonical clarifications and readiness tests                                 | T06             | Open      |
| R-003 | Export occurs without current human approval                        | Critical | Revision-bound approval and export authorization tests                                | T01/T07         | Open      |
| R-004 | Cross-tenant object access or enumeration                           | Critical | Central tenant context, fail-closed repositories and negative suite                   | T01/T08         | Open      |
| R-005 | Photo context becomes authoritative measurement                     | Critical | Contract authority type, parser/mapping rejection and E2E safety test                 | T03/T04/T05/T10 | Open      |
| R-006 | Raw transcript, media, address or signed path leaks to logs         |     High | Structured allowlist logging, redaction tests and log inspection                      | T08/T09         | Open      |
| R-007 | Parallel work diverges on contracts or dependencies                 |     High | Frozen contract/manifest and coordinator integration order                            | Coordinator     | Mitigated |
| R-008 | Browser/PDF tooling unavailable in CI                               |   Medium | Deterministic unit coverage and documented local fallback; never claim unrun evidence | T07/T09/T10     | Open      |
| R-009 | Demo authentication is accidentally enabled in production           | Critical | Environment validation hard-fails production demo mode                                | T08/T09         | Open      |
| R-010 | Internal slice is mistaken for market validation or legal readiness |     High | Persistent demo/discovery labels, blockers and scorecard language                     | Coordinator/T10 | Open      |
| R-011 | Development toolchain has transitive high/moderate audit findings   |     High | T09 upgrades compatible tool paths; production dependency audit remains zero          | T09             | Open      |
