# Local Vertical Slice Troubleshooting

| Symptom                                  | Likely cause                                                    | Safe response                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm ci` differs from the lockfile       | Integration lockfile has not been reconciled                    | Stop and use the T09/coordinator lockfile update; do not hand-edit resolved dependencies.                       |
| `@handwerk/e2e` workspace is not found   | Root workspaces still exclude `tests/*`                         | Use `npm --prefix tests/e2e run ...` locally. T09/coordinator must wire the root script during integration.     |
| Browser specs are skipped                | `HANDWERK_E2E_INTEGRATED` is not `1`                            | This is expected before integration. Do not force them against an ordinary dev server.                          |
| Adapter returns unauthorised             | The local E2E token is missing/mismatched                       | Check only the local placeholder configuration. Never print the token in terminal output, screenshots, or logs. |
| Adapter starts in a non-test environment | Server guard is missing                                         | Treat as a release blocker. Disable the adapter and return the change to its owner.                             |
| Media upload fails                       | Intentional `UPLOAD_ONCE` fault or local storage is unavailable | Clear the test fault and verify the retry produced exactly one synthetic evidence record.                       |
| Analysis fails safely                    | Intentional invalid extraction fixture or schema mismatch       | Confirm no draft line or commercial value was created, then inspect redacted validation metadata.               |
| Export is disabled                       | Current revision lacks valid human approval                     | Resolve critical questions, review the visible evidence, then explicitly approve the current revision.          |
| CSV opens as a formula                   | CSV neutralisation is missing                                   | Treat as a security defect. Formula-leading fields must be prefixed with an apostrophe.                         |
| Cross-tenant route reveals a name or ID  | Tenant isolation is broken                                      | Stop the demo and triage as a critical defect; the response must remain neutral.                                |
| PDF text is clipped or totals differ     | Export renderer/regression                                      | Block the release gate; inspect only synthetic output and compare against the golden CSV.                       |

Do not respond to an E2E problem by weakening an invariant, replacing it with a screenshot, or running the harness against production-like data.
