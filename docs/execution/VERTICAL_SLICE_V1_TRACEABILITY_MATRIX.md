# Vertical Slice V1 Traceability Matrix

Status reflects the T10 pre-integration baseline. `Fixture contract` is executable now; `Integration E2E` is intentionally deferred until the peer-owned application and guarded local test adapter are merged.

| Product invariant or acceptance criterion | Automated evidence                                          | Manual/integration evidence                              | Pre-integration status                                     |
| ----------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| Approved-price-book-only                  | `fixture-pack.spec.ts` active same-tenant line check        | Unknown mapping browser scenario                         | Fixture contract complete; E2E deferred                    |
| Zero invented prices                      | adversarial fixture assertions                              | Hallucinated code browser scenario                       | Fixture contract complete; E2E deferred                    |
| No photo measurement                      | photo context-only fixture assertion                        | Photo-only measurement browser scenario                  | Fixture contract complete; E2E deferred                    |
| Unknown stays unknown                     | canonical unanswered fact fixture assertion                 | Critical-question/unknown-mapping scenario               | Fixture contract complete; E2E deferred                    |
| Human approval required for export        | approved-revision fixture relationship                      | Approval/export flow                                     | Fixture contract complete; E2E deferred                    |
| Approval invalidation                     | approved-revision fixture relationship                      | Post-approval commercial-edit scenario                   | Fixture contract complete; E2E deferred                    |
| Evidence traceability                     | non-empty citation checks and source ID checks              | Visible source explanation on each line                  | Fixture contract complete; E2E deferred                    |
| Tenant isolation                          | cross-tenant expected 404 fixture                           | Neutral not-found browser scenario                       | Fixture contract complete; E2E deferred                    |
| Money correctness                         | integer minor-unit total reconciliation                     | PDF/CSV/UI total reconciliation                          | Fixture contract complete; export E2E deferred             |
| Unit correctness                          | price-book line/unit relation fixture check                 | Incompatible-unit negative integration test from T05/T01 | Fixture coverage partial; integration dependency           |
| Safe AI parsing                           | invalid schema fixture expectation                          | Failed-safe browser scenario                             | Fixture contract complete; E2E deferred                    |
| Content is data                           | prompt-injection fixture expectation                        | No invented code/action browser scenario                 | Fixture contract complete; E2E deferred                    |
| No autonomous communication               | fixture expects zero autonomous messages                    | Audit/browser inspection                                 | Fixture contract complete; E2E deferred                    |
| Data minimisation                         | synthetic-only manifest and generated-media checks          | T08 redaction/log inspection                             | Fixture contract complete; security integration dependency |
| Synthetic-only repository                 | synthetic manifest, JSON labels, deterministic media hashes | Committed artifact audit                                 | Fixture contract complete; final audit deferred            |
| Canonical mobile/desktop journey          | `canonical-journey.spec.ts`                                 | Scripted demo at both widths                             | Harness complete; execution deferred                       |
| Accessibility smoke                       | Axe + keyboard test in `canonical-journey.spec.ts`          | Focus order visual check                                 | Harness complete; execution deferred                       |
| Recoverable paths                         | `recovery-and-safety.spec.ts`                               | Upload/model/export retry verification                   | Harness complete; execution deferred                       |
| PDF/CSV quality                           | golden CSV and export expectations fixture                  | Rendered PDF + parsed CSV comparison                     | Fixture contract complete; export integration deferred     |
| Data export/deletion confirmation         | data-rights browser scenario                                | Visible consequence confirmation                         | Harness complete; execution deferred                       |

No release claim is supported while any critical row remains deferred. The coordinator must replace every deferred entry with executed evidence after integration or log a blocking correction.
