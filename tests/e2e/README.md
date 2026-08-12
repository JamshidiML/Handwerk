# Vertical Slice V1 E2E

This suite is an integration contract for peer-owned UI and services that are not present at T10's baseline. Fixture validation runs immediately; browser journeys are collected but skipped unless the integration adapter is explicitly enabled.

## Commands

```bash
# Baseline-safe: validate fixture relationships and compile/discover all specs.
npx playwright test --config=tests/e2e/playwright.config.ts
npx playwright test --config=tests/e2e/playwright.config.ts --list

# Integrated app already running.
HANDWERK_E2E_INTEGRATED=1 \
HANDWERK_E2E_TEST_TOKEN='<local-test-token>' \
HANDWERK_E2E_BASE_URL=http://127.0.0.1:3000 \
npx playwright test --config=tests/e2e/playwright.config.ts

# Let Playwright start the app.
HANDWERK_E2E_INTEGRATED=1 \
HANDWERK_E2E_TEST_TOKEN='<local-test-token>' \
HANDWERK_E2E_START_SERVER=1 \
npx playwright test --config=tests/e2e/playwright.config.ts
```

Do not enable the adapter against a deployed or production-like environment.

## Required Test-Support Adapter

The integrated server must expose these endpoints only when `NODE_ENV=test` and an explicit server-side E2E flag are both set. It must hard-fail startup if enabled in production and authenticate every request using `x-handwerk-e2e-token`.

| Method   | Endpoint                         | Purpose                                                         |
| -------- | -------------------------------- | --------------------------------------------------------------- |
| `POST`   | `/api/test-support/e2e/scenario` | Reset isolated storage and seed `{ fixtureSetId, scenario }`    |
| `POST`   | `/api/test-support/e2e/fault`    | Enable one named deterministic fault for the current test actor |
| `DELETE` | `/api/test-support/e2e/fault`    | Clear deterministic faults                                      |

The response to scenario seeding is `{ "ok": true, "fixtureSetId": "handwerk-synthetic-v1", "scenario": "..." }`. Seed and fault operations must never exist in normal application routes, log raw fixture content, or bypass tenant checks exercised by the product APIs.

## Route And Accessibility Contract

Route assumptions are centralized in `helpers/integration.ts`; accessible names and actions are centralized in `pages/quote-copilot.page.ts`. The peer UI should provide:

- `/demo`, `/demo/projects/:projectId`, `/demo/projects/:projectId/capture`, and `/demo/projects/:projectId/offer`;
- native headings, links, buttons, labelled file/measurement inputs, fieldsets for canonical questions, tables with accessible names, alerts/statuses, and dialogs;
- stable German accessible names represented by the page object;
- no selector dependency on CSS classes, DOM depth, generated IDs, or visual coordinates.

During integration, update the centralized adapter only when route or German UI wording intentionally differs. Do not dilute behavioural assertions or replace them with screenshots.

## Root Tooling Dependency

At `BASELINE_SHA 7632cf2`, root `npm test:e2e` targets workspace `@handwerk/e2e`, while root workspaces include only `apps/*` and `packages/*`. T09/coordinator must either add `tests/*` as an npm workspace with an owned package manifest or change the root script to invoke this config directly. T10 does not edit the frozen root package or lockfile.
