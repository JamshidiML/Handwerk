# Vertical Slice V1 Release Evidence

## Pre-Integration Record

| Item                           | Evidence                                                                 | Status                                                          |
| ------------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Fixture set                    | `fixtures/synthetic/`, `fixtureSetId: handwerk-synthetic-v1`             | Implemented                                                     |
| Fixture contract               | `tests/e2e/fixture-pack.spec.ts`                                         | Implemented; execution pending local install                    |
| Browser acceptance harness     | `tests/e2e/canonical-journey.spec.ts` and `recovery-and-safety.spec.ts`  | Implemented; execution blocked on merged product + test adapter |
| Demo walkthrough               | `docs/demo/VERTICAL_SLICE_V1_DEMO_SCRIPT.md`                             | Implemented                                                     |
| Local operations guidance      | `docs/operations/LOCAL_RUNBOOK.md`, `docs/operations/TROUBLESHOOTING.md` | Implemented; T09 commands remain integration inputs             |
| Traceability                   | `docs/execution/VERTICAL_SLICE_V1_TRACEABILITY_MATRIX.md`                | Implemented; critical rows remain deferred                      |
| Rendered PDF/screenshots       | none committed                                                           | Deferred until integrated synthetic run                         |
| CSV/PDF/UI reconciliation      | golden CSV and expectations are committed                                | Deferred until T07 export integration                           |
| Redacted logs/metrics evidence | none yet                                                                 | Deferred to T08/T09 integrated environment                      |

## Required Integration Inputs

- T01 synthetic seed/migrations and tenant-scoped state;
- T02 routes and accessible German UI contract;
- T03 capture/media lifecycle;
- T04 deterministic extraction/failure signals;
- T05 approved mapping/calculation actions;
- T06 clarification/provenance view and state;
- T07 revision approval, exports, audit, data-rights flows;
- T08 test-adapter hardening/privacy assertions;
- T09 root E2E workspace, lockfile, local services, and CI wiring.

## Release Blockers At This Stage

1. The complete canonical journey has not run against an integrated fresh seed.
2. The test-support adapter does not yet exist in this worktree and must be guarded server-side.
3. Browser, accessibility, PDF render, CSV parser, logs/redaction, and clean-checkout evidence are absent.
4. No integrated quality score can be truthfully calculated.

This document is intentionally evidence-oriented: it records what exists and what still requires execution, rather than representing a pre-integration branch as release-ready.
