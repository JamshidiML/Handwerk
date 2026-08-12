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

The Cloudflare/Vite updates remove eight baseline high findings. `apps/web` still directly pins a Vinext line that pins vulnerable `image-size@2.0.2`; T09 cannot validly override that direct workspace declaration. Two exact development-only findings have an exception through 26 August 2026 in `scripts/config/dependency-audit-policy.json`. Any new path, severity, package, or post-expiry run fails.

Remove an override when its owning direct package declares a patched version and the full gate passes without it.

## Evidence Commands

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run security:audit:prod
npm run security:audit
npm run security:audit:raw
npm run security:inventory
npm run security:sbom
```

The deterministic inventory derives only from `package-lock.json` and includes its SHA-256. The CycloneDX SBOM comes from `npm sbom`. Both outputs are ignored locally and retained for 14 days by CI.

## Workspace Reconciliation

At T09 implementation time, sibling manifests were discoverable for `@handwerk/db`, `@handwerk/media`, `@handwerk/ai`, `@handwerk/pricebook`, `@handwerk/provenance`, and `@handwerk/exports`. T02, T08, and T10 had not exposed additional package manifests. The coordinator must regenerate the lockfile after integration and verify any later workspace additions.
