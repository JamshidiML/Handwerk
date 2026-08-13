# Dependency Governance

## Policy

- npm workspaces use one root `package-lock.json`; package manifests use exact versions.
- Node.js `22.13.0` is the minimum and `26.3.0` is the local/CI reference.
- npm `11.16.0` is the only version used to intentionally change the lockfile.
- Production dependency audit must have zero high or critical findings.
- The full tree must have zero unreviewed high or critical findings. Any development-only exception is exact-path, named-owner, short-lived, and fails closed after expiry.
- Never run `npm audit fix --force` or accept an unrelated major downgrade solely to silence an audit.

## Review for Additions

Record purpose, owner, exact version, license, maintenance posture, production/development classification, bundle/runtime impact, and current audit result. Prefer platform APIs and existing packages when they meet the need. T09 or the coordinator reconciles accepted workspace dependencies into the root lockfile.

## Current Compatibility Overrides

Root overrides constrain known vulnerable development paths to tested compatible releases:

- Vite moves within the supported peer ranges. The root lockfile scopes compatible Cloudflare plugin, Wrangler, and Workers types updates to the web workspace so their peer graph remains valid without editing its manifest.
- Brace expansion moves to its patched CommonJS-compatible release so the ESLint dependency graph remains executable.

The Cloudflare/Vite updates remove eight baseline high findings. Cycle 1 re-evaluated the remaining exact path: `apps/web` declares development dependency `vinext@0.0.50`, which declares `image-size@2.0.2`. npm audit reports `GHSA-w3rx-r6r6-pgpr` and `GHSA-5p2g-fcmc-qvqq` on that node. The audit-proposed downgrade to `vinext@0.0.45` removes `image-size`, but an isolated clean install fails the current RSC build with missing `@vitejs/plugin-rsc/browser` exports; it is not compatible. The newest published `vinext@1.0.0-beta.5` still declares `image-size@2.0.2`, so no compatible patched route exists.

Two exact development-only findings remain accepted through 2026-08-26 in `scripts/config/dependency-audit-policy.json`. Their affected paths are `apps/web/node_modules/vinext` and `apps/web/node_modules/image-size`; both lockfile entries are development-only. `npm audit --omit=dev --audit-level=high` is the production non-reachability evidence and must remain clean. Any new path, package, severity, or post-expiry run fails closed.

Remove an override when its owning direct package declares a patched version and the full gate passes without it.

## Cross-Platform Native Packages

Cycle 2 found that a lockfile generated on macOS referenced `@tailwindcss/oxide-linux-x64-gnu@4.2.1` through `@tailwindcss/oxide@4.2.1` but omitted the platform package's resolved lock record. This caused clean Ubuntu `npm ci` builds to fail while loading the PostCSS native binding. `apps/web` therefore owns an exact optional dependency on `@tailwindcss/oxide-linux-x64-gnu@4.2.1`, the narrowest workspace that loads Tailwind during its build. npm 11.16.0 generated the corresponding resolved and integrity metadata; no metadata was fabricated and CI performs no follow-up install.

Platform regression tests require that exact manifest and lock record, the Tailwind graph, and the existing `lightningcss-linux-x64-gnu@1.31.1` record. A disposable Noble/glibc x86_64 container proved that one clean install materializes both bindings, and hosted PR run [`31696348445`](https://github.com/JamshidiML/Handwerk/actions/runs/31696348445) completed the cold build.

## Evidence Commands

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run security:audit:prod
npm run security:audit
npm run security:audit:raw
npm run security:inventory
npm run security:sbom
```

The deterministic inventory derives only from `package-lock.json` and includes its SHA-256. The CycloneDX SBOM comes from `npm sbom`. Both outputs are ignored locally and retained for 14 days by CI. The workflow lists those two files explicitly, enables hidden files only because the dedicated `.artifacts/` directory is hidden, fails when either path is absent, and does not upload the directory broadly. Cycle 2 artifact `9179465931` was downloaded and inspected: its retained file list is exactly `dependency-inventory.json` and `sbom.cdx.json`.

## Workspace Reconciliation

At T09 implementation time, sibling manifests were discoverable for `@handwerk/db`, `@handwerk/media`, `@handwerk/ai`, `@handwerk/pricebook`, `@handwerk/provenance`, and `@handwerk/exports`. T02, T08, and T10 had not exposed additional package manifests. The coordinator must regenerate the lockfile after integration and verify any later workspace additions.
