# Local Runbook

## Scope

This runbook starts the internal Handwerk vertical slice with synthetic data only. It does not deploy anything, configure a production environment, or authorize real customer data.

## Supported Toolchain

- Local reference runtime: Node.js `26.3.0` from `.nvmrc`.
- Minimum runtime: Node.js `22.13.0`.
- Package manager: npm `11.16.0`, recorded in `package.json#packageManager`.
- Optional service runtime: Docker with Compose v2.

Use the exact npm version when changing `package-lock.json`. CI verifies Node.js `22.13.0` and `26.3.0`.

## First Setup

```sh
nvm use
npm --version
npm run setup
```

`npm run setup` checks Node.js, copies `.env.example` to ignored `.env` only when absent, installs exactly from the lockfile, and validates configuration. The checked-in values are local placeholders; `.env` must remain untracked.

Start and verify local dependencies:

```sh
npm run services:up
npm run health
npm run services:status
```

The local endpoints bind only to loopback:

| Service       | Default endpoint        | Purpose                            |
| ------------- | ----------------------- | ---------------------------------- |
| PostgreSQL    | `127.0.0.1:5432`        | Relational vertical-slice state    |
| MinIO API     | `http://127.0.0.1:9000` | Private synthetic evidence objects |
| MinIO console | `http://127.0.0.1:9001` | Local operator inspection only     |

## Database and Demo

After the T01 database workspace is integrated:

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

`db:migration:check` applies the forward-only migration command twice and fails on either error. Before `@handwerk/db` is integrated it reports the gate as not applicable instead of claiming migration evidence.

The development server uses deterministic fake AI through `AI_PROVIDER=deterministic_fake`. No API key or external AI network call is required.

## Test Paths

Docker-free developer path:

```sh
npm run test:unit
npm run lint
npm run typecheck
```

`npm test` is the complete fresh-worktree test command: it builds first, then runs every workspace test and the platform tests. This avoids the starter web rendering test depending on an artifact from an earlier manual build.

Do not run `npm run build`, `npm test`, or `npm --workspace @handwerk/web run test` concurrently in the same worktree. Vinext writes the shared `apps/web/dist` directory; the root command and CI run its build and tests sequentially.

Full local path with dependencies running:

```sh
npm run db:migration:check
npm run test:integration
npm run build
npm run test:e2e
```

Security and dependency evidence:

```sh
npm run security:secrets
npm run security:audit:prod
npm run security:audit
npm run security:inventory
npm run security:sbom
```

Inventory and CycloneDX files are generated under ignored `.artifacts/`; they are CI evidence, not source files.

## Shutdown and Local Data

```sh
npm run services:down
```

This retains named volumes. To deliberately destroy all local PostgreSQL and object-storage state, run Docker Compose with `down --volumes` only after confirming no needed synthetic evidence remains. There is no automated backup/restore promise for this internal slice.

## E2E Safety Contract

The E2E adapter is an integration dependency. Its server implementation must require test mode, an explicit server-side E2E flag, and `x-handwerk-e2e-token`; it must fail closed in production, reset only isolated synthetic storage, and never log raw fixtures, media, signed URLs, or tokens.

Fixture-only validation works before the adapter is integrated:

```sh
npm --prefix tests/e2e run test:fixtures
npm --prefix tests/e2e run test:list
```

Once the local adapter is present, run the browser suite against the local server:

```sh
HANDWERK_E2E_INTEGRATED=1 \
HANDWERK_E2E_TEST_TOKEN='<local-test-token>' \
HANDWERK_E2E_BASE_URL=http://127.0.0.1:3000 \
npm --prefix tests/e2e run test
```

## Production Blockers

Before any production decision, add independently verified authentication, managed secrets and encryption keys, encrypted backup/restore with restore drills, retention enforcement, regional hosting and subprocessors, remote telemetry controls, alerting/on-call ownership, incident response, penetration testing, and qualified legal/privacy review. Local Compose and local metrics are not substitutes for those controls.
