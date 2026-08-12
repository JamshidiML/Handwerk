# Local Vertical Slice Runbook

## Scope And Safety

This runbook is for the internal synthetic vertical slice. Use only local dependencies, the committed `handwerk-synthetic-v1` fixture pack, and placeholder local credentials. It does not deploy or configure production services. The optional E2E test-support adapter must never be enabled against a deployed or production-like environment.

## Prerequisites

- Node.js `>=22.13.0` and the package-manager version pinned by T09.
- A fresh checkout of the integration branch after its lockfile has been reconciled.
- Local PostgreSQL/object storage only when T09's local environment documents them.
- No live AI key. CI and the demo use deterministic providers.

## Fresh Local Setup

1. Install only from the committed lockfile: `npm ci`.
2. Copy the T09 environment template to a local ignored `.env` file and fill only local placeholders.
3. Start the local dependencies using the T09-approved command.
4. Run the T01 migration command, then the synthetic seed command.
5. Start the web app: `npm run dev`.
6. Verify the local health/readiness endpoint supplied by T09 before using the browser.

## E2E Safety Contract

The E2E adapter is an integration dependency. The server implementation must satisfy every condition below before `HANDWERK_E2E_INTEGRATED=1` is used:

- `NODE_ENV=test` and an explicit server-side E2E flag are both required;
- enabling it in production must fail startup;
- every request requires `x-handwerk-e2e-token` and a locally supplied test token;
- seed operations reset only isolated synthetic storage;
- no normal product route exposes seed/fault operations;
- raw fixtures, transcripts, media bytes, signed URLs, and token values are never logged.

With that adapter available, run:

```bash
HANDWERK_E2E_INTEGRATED=1 \
HANDWERK_E2E_TEST_TOKEN='<local-test-token>' \
HANDWERK_E2E_BASE_URL=http://127.0.0.1:3000 \
npm --prefix tests/e2e run test
```

For fixture-only validation before the peer services are integrated:

```bash
npm --prefix tests/e2e run test:fixtures
npm --prefix tests/e2e run test:list
```

## Standard Verification Order

1. `npm run format:check`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test:unit`
5. `npm run test:integration`
6. `npm run build`
7. `npm --prefix tests/e2e run test`
8. Render and inspect the synthetic PDF, then parse the CSV and reconcile totals.
9. Inspect redacted logs and run the security/secret/dependency checks supplied by T08/T09.

## Data Handling

The demo deletion flow removes only seeded synthetic project state. It is not a production retention/deletion implementation or a GDPR certification. Backups, recovery objectives, production monitoring, processor agreements, and legal review remain release blockers outside this local slice.
