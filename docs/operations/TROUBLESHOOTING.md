# Troubleshooting

## Runtime or npm Rejected

Check `node --version` and `npm --version`. Use Node.js `26.3.0` locally or at least `22.13.0`, with npm `11.x`. The repository intentionally enables `engine-strict`.

## Configuration Validation Fails

Run `npm run env:init`, then `npm run env:check`. The validator reports variable names and safe reasons but never values. Common causes are a missing variable, non-Boolean `DEMO_MODE`, a non-PostgreSQL `DATABASE_URL`, or non-loopback plain-HTTP object storage.

Production configuration intentionally fails when demo identity is enabled, local placeholders remain, or object storage is not HTTPS.

## Docker Services Do Not Become Healthy

1. Run `npm run services:status`.
2. Check whether ports `5432`, `9000`, or `9001` are already in use; change the corresponding ignored `.env` port and the matching URL.
3. Inspect service logs with `docker compose --env-file .env -f infra/local/compose.yml logs postgresql object-storage`.
4. Run `npm run health` again after both services report healthy.

Do not paste service logs into issues without checking for local credentials or synthetic content.

## Migration Gate Says Not Applicable

The T09 branch does not own `@handwerk/db`. `npm run db:migration:check` becomes active when the T01 package is integrated. A not-applicable message is not migration acceptance evidence.

## Readiness Is `not_ready`

Readiness returns only component names and safe reason codes:

- `connection_failed`: service is unavailable or the endpoint/port is wrong.
- `unhealthy_response`: object storage responded but was not ready.
- `timeout`: a dependency exceeded the bounded readiness deadline.
- `check_failed`: the adapter failed without exposing its exception text.

Liveness does not imply dependency readiness.

## Browser Tests Cannot Start

CI uses the pinned Playwright `1.62.1` image. Locally, install the matching Chromium binary only when T10's E2E workspace requires it. Unit, type, lint, and domain tests remain available without browsers or Docker.

## E2E Browser Suite

| Symptom                                | Likely cause                                                        | Safe response                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm ci` differs from the lockfile     | Workspace manifests were merged without a reconciled root lockfile. | Stop and regenerate the lockfile with the pinned npm version; never hand-edit resolved entries. |
| `@handwerk/e2e` workspace is not found | Dependencies were not installed from the current root lockfile.     | Run `npm ci --ignore-scripts --no-audit --no-fund` at the repository root.                      |
| Built server cannot start              | `apps/web/dist` is stale or port 3000 is held by another process.   | Run `npm run build`; stop the stale local server or let Playwright reuse it locally.            |
| Media permission is denied             | Browser microphone permission was denied or is unavailable.         | Use the visible transcript fallback; it is an expected recoverable path.                        |
| Export is disabled                     | The current revision is not explicitly approved.                    | Resolve critical questions, review visible evidence, and approve the current revision.          |
| CSV opens as a formula                 | Formula neutralization is missing.                                  | Treat as a security defect; formula-leading fields require an apostrophe prefix.                |
| Cross-tenant route reveals data        | Tenant isolation is broken.                                         | Stop the demo and triage as critical; the response must remain neutral.                         |
| PDF text is clipped or totals differ   | Export rendering regression.                                        | Block release, inspect synthetic output only, and reconcile against the golden CSV.             |

## Audit Changes Over Time

`npm audit` uses current registry advisories and can fail without a source change. Record the advisory, dependency path from `npm explain`, and whether it affects production or development tooling. Do not use `npm audit fix --force`; update compatible direct tooling or a narrow override, regenerate the lockfile, and run the complete gate.
