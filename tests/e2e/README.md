# Vertical Slice V1 E2E

The browser suite exercises the integrated application with an in-memory, synthetic-only `DemoDataProvider`. Every Playwright browser context begins with the deterministic seeded fixture state; no test-support HTTP routes, test token, external AI provider, customer record, or production deployment is involved.

## Commands

```sh
# Fixture relationships only; no app server needed.
npm run test:e2e:fixtures

# Build and let Playwright manage the built local app on port 3000.
npm run build
npm run test:e2e

# Run against an already-running local built app.
HANDWERK_E2E_BASE_URL=http://127.0.0.1:3000 \
npx playwright test --config=tests/e2e/playwright.config.ts
```

The managed browser command starts `@handwerk/web` with `vinext start`; it therefore needs a current build. Locally it can reuse an existing server. CI builds first and always starts the local process from the pinned lockfile.

## Route And Accessibility Contract

Route assumptions are centralized in `helpers/integration.ts`; accessible names and actions are centralized in `pages/quote-copilot.page.ts`.

- `/`, `/projekte/:projectId`, and `/projekte/:projectId/baustellenbesuch` are the canonical routes.
- Browser assertions use native headings, links, buttons, labelled controls, status messages, and semantic regions.
- Tests do not depend on CSS classes, generated IDs, visual coordinates, real data, or external network calls.
- The canonical journey is exercised at desktop and 390px mobile viewports. The mobile script uses keyboard activation for controls that can sit behind the fixed navigation while scrolling; the corresponding visible flow is also manually checked at that viewport.

## Coverage

`canonical-journey.spec.ts` covers capture, deterministic analysis, the two canonical clarifications, price-book-backed draft, quantity revision, human approval, PDF/CSV download, audit activity, data export, demo deletion, keyboard focus, and Axe serious/critical violations.

`recovery-and-safety.spec.ts` covers denied microphone fallback, blocked approval while critical questions remain open, approval invalidation after a commercial edit, neutral unknown-project handling, and explicit deletion acknowledgement. Fixture-contract tests cover synthetic-only labeling, tenant relationships, no photo-derived measurements, safe parsing, approved-price-book-only pricing, CSV formula neutralization, and money reconciliation.
