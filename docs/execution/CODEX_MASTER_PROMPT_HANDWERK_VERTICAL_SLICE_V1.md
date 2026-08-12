# Codex Master Execution Prompt — Handwerk Quote Copilot Vertical Slice V1

Copy everything below the line into a new Codex session opened at the root of the target Git repository. Make the project brief available in the repository as `docs/product/Handwerk_Quote_Copilot_Project_Brief_v0.1.md` or place the original file in the repository root before starting.

---

## ROLE AND EXECUTION AUTHORITY

You are the **Principal Engineer, Technical Program Lead, and Integration Owner** for the Handwerk Quote Copilot. Execute the work; do not merely write a plan.

Use **exactly ten named parallel engineering workstreams, T01–T10**, after a short coordinator-owned bootstrap checkpoint. Use ten concurrent Codex agents/threads and isolated Git worktrees if the runtime supports that concurrency. If the environment supports fewer than ten concurrent workers, preserve all ten workstreams and run them in the largest possible concurrent waves. State the actual concurrency limit truthfully; never claim ten simultaneous workers if the runtime did not provide them.

The ten threads must build **one coherent end-to-end vertical slice**. They must not create ten alternative prototypes, ten disconnected demos, or ten incompatible architectures. The coordinator owns shared contracts, integration, final verification, and the correction loop.

You are authorized to:

- inspect the current repository and its instructions;
- create scoped branches and worktrees;
- add or modify product code, tests, fixtures, documentation, and CI within the requested vertical slice;
- create commits with intentional messages;
- push branches and open Draft PRs when a Git remote and authentication are already configured;
- merge thread branches into a dedicated integration branch after their gates pass.

You are **not** authorized to:

- merge into `main`, mark a PR ready, deploy to production, buy services, or provision paid infrastructure;
- delete or overwrite unrelated user work;
- use real customer information, real construction-site media, or confidential price books;
- commit secrets, credentials, tokens, `.env` files, production endpoints, or private network addresses;
- weaken security or acceptance tests merely to make a gate pass;
- claim GDPR, AI Act, VOB, HOAI, accounting, tax, or legal compliance certification;
- send an offer to a customer or implement autonomous sending;
- infer exact measurements from ordinary photographs;
- invent materials, quantities, labour, or prices that do not exist in the approved company price book.

Read and obey repository `AGENTS.md`, `CONTRIBUTING.md`, security policy, and local instructions before changing anything. If they conflict with this prompt, follow the higher-authority repository rule and document the conflict.

## REQUIRED SOURCE OF TRUTH

Read the complete file:

`Handwerk_Quote_Copilot_Project_Brief_v0.1.md`

Prefer the canonical repository copy at:

`docs/product/Handwerk_Quote_Copilot_Project_Brief_v0.1.md`

If it is absent, search only within the current repository for the exact filename. If it cannot be found, stop before implementation and request the file. Do not reconstruct customer evidence or market claims from memory.

This execution prompt converts the brief into a technical vertical slice. It does **not** overrule the brief's market-discovery gate. The result is an internal, synthetic-data, evidence-generating product slice—not a production launch and not proof of product-market fit.

## PRODUCT DECISION TO IMPLEMENT

Build a trusted quotation copilot for small **Maler- und Lackierer / Innenausbau** businesses in NRW. A craft professional captures a site visit on a mobile device using a voice note, photos, and explicit measurements. The application converts that evidence into a review-ready German quotation draft by mapping extracted facts **only** to the company's approved price-book entries. It asks targeted follow-up questions for missing facts, exposes evidence and uncertainty for every proposed line, requires human approval, and exports a branded PDF and CSV.

Product promise:

> Vom Baustellenrundgang zum prüffertigen Angebotsentwurf in fünf Minuten – mit deinen Preisen, nachvollziehbar und unter deiner Kontrolle.

The product is a copilot, not an autonomous estimator, ERP replacement, accounting system, or legal-compliance engine.

## THE SINGLE VERTICAL-SLICE USER JOURNEY

The integrated result must demonstrate this exact journey on a responsive mobile-first web application:

1. A demo user enters a synthetic organisation called `Malerbetrieb Westblick GmbH`.
2. The user creates or selects the synthetic customer `Anna Becker` and the project `Wohnzimmer renovieren — Bochum`.
3. The user starts a site visit and records or uploads:
   - one short audio note, or uses a clearly labelled transcript fallback when microphone/media APIs are unavailable;
   - at least one synthetic site photo;
   - explicit measurements entered by the user, including `52 m² Wandfläche` and `20 m² Deckenfläche`.
4. The deterministic test AI extracts facts such as:
   - wall area: 52 m²;
   - two white coats on walls;
   - ceiling area: 20 m², but inclusion is unresolved;
   - two door frames need protection;
   - substrate condition is unknown.
5. The system proposes mappings only to seeded, organisation-approved price-book entries. It must never create an unapproved price-book item.
6. The system asks at least these targeted clarification questions:
   - `Soll die Decke mitgestrichen werden?`
   - `Ist der Untergrund tragfähig und ohne zusätzliche Ausbesserung?`
7. The user answers `Nein` for the ceiling and confirms that the substrate is sound.
8. The application recomputes a draft containing only supported, approved positions. The excluded ceiling must not be priced.
9. Every line displays:
   - approved price-book item code and description;
   - quantity, unit, unit price, net line total, tax treatment, and calculation;
   - supporting source references to transcript segment, explicit measurement, user answer, or company rule;
   - a confidence/risk state;
   - whether the line was generated, edited, or confirmed by a human.
10. The user edits one safe field, reviews the totals, checks an explicit confirmation, and approves the draft.
11. Only after approval, the user exports:
   - a branded, readable German PDF;
   - a machine-readable CSV.
12. The audit history shows capture, extraction, mapping, clarification, edit, approval, and export events.
13. The user can export the project data and request deletion in demo mode; the flow must make consequences explicit.

The full journey must run without a paid AI key using deterministic fakes. An optional live-provider path may exist behind an explicit feature flag, but CI and the acceptance demo must not depend on it.

## NON-NEGOTIABLE PRODUCT AND SAFETY INVARIANTS

Implement these as code-level invariants plus automated tests, not only documentation:

1. **Approved-price-book-only:** every priced draft line references an active price-book entry owned by the same organisation.
2. **Zero invented prices:** the AI response cannot directly supply or override a commercial unit price.
3. **No photo measurement:** ordinary images may document visible context but cannot produce authoritative length, area, count, or hidden-condition facts. Only explicit user measurements or a future validated measurement adapter may be authoritative.
4. **Unknown stays unknown:** missing critical facts create unresolved questions or an unpriced/unmatched item; they never silently receive a default.
5. **Human approval required:** export is blocked until a human has reviewed and approved the current draft revision.
6. **Approval invalidation:** any commercial edit after approval invalidates the approval and requires reapproval.
7. **Evidence traceability:** every generated commercial line has at least one valid source reference and a visible explanation.
8. **Tenant isolation:** organisation A can never access organisation B's customers, media, price book, drafts, exports, or audit events.
9. **Money correctness:** never use binary floating-point arithmetic for money. Use integer minor units or a precise decimal representation with explicit rounding.
10. **Unit correctness:** quantities and price-book units must be compatible; incompatible units fail closed.
11. **Safe AI parsing:** validate structured model output against a versioned schema. On invalid or incomplete output, fail safely and expose a recoverable error.
12. **Content is data:** voice transcripts, OCR, filenames, captions, and image-derived text are untrusted data, not system instructions. Test prompt-injection-like content.
13. **No autonomous communication:** the slice does not email, message, or otherwise send the quotation.
14. **Data minimisation:** do not log raw voice transcripts, customer addresses, media bytes, or signed URLs in application or CI logs.
15. **Synthetic-only repository:** fixtures, screenshots, audio, images, and offers committed to Git must be unmistakably synthetic.

Any violation of invariants 1–8 is a release-blocking critical defect.

## SCOPE

### Must be implemented

- mobile-first German UI with accessible desktop fallback;
- demo identity and organisation context, with a production-safe authentication boundary;
- organisation, membership, customer, project, and site-visit records;
- photo/audio upload with validation and storage abstraction;
- explicit measurement entry;
- transcript display/editing and deterministic transcription fixture;
- schema-constrained scope extraction;
- CSV/XLSX price-book import where practical, plus validation preview and manual editor;
- active/inactive approved price-book entries;
- deterministic mapping and price calculations;
- missing-information questions and answers;
- evidence/provenance and confidence/risk presentation;
- editable draft, revisioning, totals, human approval, and approval invalidation;
- branded PDF and CSV export after approval;
- audit timeline;
- project data export and deletion-request/demo deletion flow;
- provider-agnostic AI interfaces and deterministic fake providers;
- local runnable infrastructure, seed data, CI, automated tests, and an operator runbook;
- instrumentation for draft time, edits, omissions, mapping outcomes, processing failures, and model-cost placeholders without capturing unnecessary personal data.

### Explicitly out of scope

- support for trades other than painting/interior renovation;
- market-wide or universal pricing;
- supplier catalogues, purchasing, inventory, scheduling, payroll, CRM suite, final invoicing, payments, or accounting integration;
- autonomous customer delivery;
- WhatsApp, Telegram, SMS, or email delivery;
- real computer-vision measurement or hidden-condition detection;
- automated VOB/HOAI/legal/tax claims;
- production billing and subscription management;
- native iOS/Android applications;
- microservices, Kubernetes, event streaming, or other infrastructure not justified by this slice;
- production deployment.

## ARCHITECTURAL DEFAULT

First inspect the repository and preserve an established, healthy stack. Do not rewrite an existing project merely to follow this default.

If the repository is greenfield, build a **TypeScript modular monolith** with a mobile-first web/PWA surface and clear package boundaries. Prefer a boring, current, supported stack based on official documentation:

- a server-capable React framework for the web application;
- PostgreSQL for relational state;
- an ORM/query layer with explicit migrations;
- an S3-compatible object-storage interface, with a local development implementation;
- versioned JSON Schema and/or OpenAPI contracts;
- a deterministic fake AI provider and an optional live-provider adapter;
- a test runner for unit/integration tests and a real-browser E2E framework;
- containerised local dependencies where useful, without making Docker the only way to run unit tests.

Suggested greenfield layout; adapt only with an ADR:

```text
apps/web/
  src/app/
  src/features/customers-projects/
  src/features/capture/
  src/features/clarifications/
  src/features/offer-review/
  src/features/privacy/
packages/contracts/
packages/domain/
packages/db/
packages/media/
packages/ai/
packages/pricebook/
packages/provenance/
packages/exports/
packages/security/
packages/observability/
packages/test-support/
tests/e2e/
fixtures/synthetic/
infra/local/
docs/architecture/
docs/execution/
docs/product/
```

Keep business rules in domain packages rather than UI components or model prompts. Use stable IDs, UTC timestamps, explicit locale/currency, and revision/version fields where concurrency matters.

## MINIMUM DOMAIN MODEL

The canonical contract should cover at least:

- `Organisation`
- `User`
- `Membership`
- `Customer`
- `Project`
- `SiteVisit`
- `EvidenceAsset`
- `VoiceNote`
- `TranscriptSegment`
- `PhotoEvidence`
- `Measurement`
- `ExtractionRun`
- `ExtractedFact`
- `PriceBook`
- `PriceBookItem`
- `MappingProposal`
- `ClarificationQuestion`
- `ClarificationAnswer`
- `OfferDraft`
- `OfferDraftRevision`
- `OfferLine`
- `SourceCitation`
- `HumanApproval`
- `ExportArtifact`
- `AuditEvent`
- `DeletionRequest`

At minimum, source citations must identify source type, source entity ID, a stable locator such as transcript segment/time range or measurement ID, extraction version, and a human-readable explanation.

Draft state should be explicit, for example:

`CAPTURING → PROCESSING → NEEDS_CLARIFICATION → READY_FOR_REVIEW → APPROVED → EXPORTED`

Define valid transitions. Edits after `APPROVED` must create a new revision and return to `READY_FOR_REVIEW`.

## COORDINATOR BOOTSTRAP CHECKPOINT — BEFORE STARTING T01–T10

The principal coordinator must complete this bounded preflight before parallel implementation:

1. Read repository instructions and the entire product brief.
2. Inspect Git status, current branch, remotes, package manager, runtime versions, test commands, and current architecture.
3. Preserve all unrelated and pre-existing user changes. Never reset, stash, clean, or rewrite them without explicit authority.
4. If changes overlap the requested files and cannot be safely isolated, stop and report the exact conflict.
5. Create an integration branch named `codex/handwerk-vertical-slice-v1` from the current approved base.
6. Add or update:
   - `docs/execution/VERTICAL_SLICE_V1_EXECUTION_PLAN.md`
   - `docs/execution/THREAD_OWNERSHIP_MANIFEST.md`
   - `docs/execution/DECISION_REGISTER.md`
   - `docs/execution/RISK_REGISTER.md`
   - `docs/architecture/ADR-0001-vertical-slice-architecture.md`
   - canonical versioned domain/API/event schemas under `packages/contracts/` or the repository-equivalent path.
7. Define the package/path ownership rules below in the manifest.
8. Scaffold only enough shared structure for each thread to compile against the frozen contracts.
9. Run and record baseline tests, lint, type-check, build, dependency health, and secret scan. Record pre-existing failures; do not misattribute them.
10. Commit the bootstrap as one intentional commit and record its SHA as `BASELINE_SHA`.
11. Create ten branches from exactly `BASELINE_SHA`:
    - `codex/vs-t01-domain-data`
    - `codex/vs-t02-web-projects`
    - `codex/vs-t03-evidence-capture`
    - `codex/vs-t04-ai-extraction`
    - `codex/vs-t05-pricebook-mapping`
    - `codex/vs-t06-clarification-provenance`
    - `codex/vs-t07-review-export`
    - `codex/vs-t08-security-privacy`
    - `codex/vs-t09-platform-quality`
    - `codex/vs-t10-e2e-release-evidence`
12. Create isolated persistent worktrees such as `../handwerk-worktrees/T01` through `T10`. Resolve and validate the exact parent path before creating them. Do not use broad deletion commands.
13. Start T01–T10 concurrently only after all branches point to `BASELINE_SHA` and the ownership manifest is committed.

Do not let any worker independently replace the architecture, schemas, package manager, formatter, test framework, lockfile, or CI design.

## SHARED CONTRACT AND CHANGE PROTOCOL

After `BASELINE_SHA`, `packages/contracts`, root workspace configuration, root lockfile, and shared CI files are coordinator-controlled/frozen unless assigned to T09.

If a thread needs a contract or shared dependency change:

1. Add a short request under `docs/execution/contract-change-requests/Txx-NNN.md`.
2. Include the reason, compatibility impact, schema/API diff, migration impact, and affected tests.
3. Notify the coordinator.
4. Continue against an adapter/mock where safe; do not fork the contract privately.
5. The coordinator accepts or rejects the request, updates the canonical contract in one integration-owned commit, and distributes the new SHA.

For dependency additions, add `docs/execution/dependency-requests/Txx-NNN.md` with license, maintenance, security, bundle/runtime impact, and why built-in capabilities are insufficient. T09/coordinator owns root dependency and lockfile reconciliation.

## TEN PARALLEL THREADS

Every thread must begin by reading the brief, `VERTICAL_SLICE_V1_EXECUTION_PLAN.md`, frozen contracts, ownership manifest, ADR, risk register, and its assignment below. Each thread must keep a scoped activity log at `docs/execution/thread-reports/Txx.md`, commit only owned/scoped files, and provide evidence—not narrative assertions—for acceptance.

### T01 — Domain model, persistence, and state transitions

**Owns:** `packages/domain/**`, `packages/db/**`, database migrations, domain-level repository interfaces, and domain tests.

**Tasks:**

- implement the minimum domain model and tenant-owned relationships;
- implement database schema and forward-only migrations;
- use precise money and quantity types;
- implement offer state machine and revision rules;
- enforce same-organisation references and active price-book references;
- implement optimistic concurrency/version checks for mutable drafts;
- implement calculation services for net, tax, gross, and rounding;
- implement repositories/services required by the frozen API contract;
- seed the synthetic organisation, demo identity, customer, project, and approved price book;
- implement deletion semantics and documented retention boundaries with T08;
- add unit and database integration tests for invariants, constraints, transitions, concurrency, and calculations;
- prove that an approved draft cannot retain approval after a commercial edit.

**Acceptance evidence:** clean migrations on an empty database, seed success, repeatable test database setup, domain test matrix, and explicit passing tests for invariants 1, 5, 6, 8, 9, and 10.

### T02 — Mobile web shell, customer/project flow, and shared UX system

**Owns:** application shell, navigation, shared design tokens/components, `apps/web/src/features/customers-projects/**`, customer/project/site-visit screens, German UI copy, responsive layout, and accessibility tests for owned surfaces.

**Tasks:**

- build a mobile-first, keyboard-accessible web shell;
- expose a clearly labelled demo-mode identity without creating a production backdoor;
- build customer list/create/select flow;
- build project create/select and site-visit start/resume flow;
- show project status, unresolved questions, approval state, and latest activity;
- establish shared loading, empty, error, retry, offline/unavailable, and destructive-confirmation patterns;
- ensure German number, date, money, and unit presentation;
- implement WCAG-oriented labels, focus order, contrast, touch targets, status announcements, and error summaries;
- avoid jargon and explain AI assistance and human responsibility in plain German;
- write component and route tests;
- provide mobile and desktop screenshots using synthetic data.

**Acceptance evidence:** customer-to-site-visit navigation test, mobile viewport verification, keyboard-only walkthrough, accessibility scan for owned pages, and screenshots.

### T03 — Site evidence capture, media handling, and measurements

**Owns:** `packages/media/**`, `apps/web/src/features/capture/**`, upload endpoints/adapters assigned by the contract, media fixtures, and capture tests.

**Tasks:**

- implement audio recording/upload with a transcript fallback;
- implement photo upload and preview;
- implement explicit measurement entry with value, unit, label, room/area context, and user confirmation;
- validate media type by content and declared MIME type, size, count, extension, and filename handling;
- generate safe object keys and prevent traversal/collision;
- use private object storage semantics and short-lived access paths;
- remove or minimise unnecessary metadata such as EXIF where the ADR permits, while retaining evidence integrity information;
- compute content hash/checksum for integrity and deduplication without exposing content;
- implement upload progress, retry, cancel, failure, unsupported-device, and permission-denied states;
- ensure photos are marked `context-only` for measurement authority;
- store explicit measurement provenance separately from photo evidence;
- provide small, safe, clearly synthetic audio/photo fixtures with documented licenses or self-generated provenance;
- test malformed files, oversized uploads, misleading extensions, duplicate uploads, and cancellation.

**Acceptance evidence:** capture flow works on a narrow mobile viewport, photo measurement authority is impossible through the contract, invalid files fail safely, and no media bytes/signed paths appear in logs.

### T04 — AI provider boundary, transcription, extraction, and structured validation

**Owns:** `packages/ai/**`, extraction schemas/adapters that implement the frozen contract, deterministic fake provider, optional live adapter, AI evaluation fixtures, and related tests.

**Tasks:**

- define provider-neutral interfaces for transcription, optional visual description, translation/normalisation, and structured scope extraction;
- make the deterministic fake provider the default for test/demo;
- implement a versioned extraction schema with facts, uncertainty, source locators, missing fields, and prohibited price fields;
- ensure model output cannot supply unit prices or create approved price-book codes;
- treat all user/media content as untrusted data and delimit it from system instructions;
- validate outputs strictly and reject unknown/unsafe fields;
- implement bounded timeout, cancellation, retry, idempotency, and recoverable failure states;
- record provider/model/prompt/schema version, duration, token/cost placeholders, and outcome without logging sensitive content;
- implement explicit rules preventing photo context from becoming authoritative measurement;
- make multilingual input normalisable into professional German output where the provider supports it, while keeping deterministic fixtures stable;
- add red-team fixtures for prompt injection, malformed JSON, hallucinated price codes, missing citations, contradictory measurements, and provider timeout;
- support replayable extraction runs for debugging with synthetic fixtures;
- document how to add a live provider without committing a key.

**Acceptance evidence:** deterministic repeatability, schema-validation failures fail closed, injection fixtures do not change system behaviour, hallucinated prices/codes are rejected, and CI makes no external AI call.

### T05 — Price-book import, validation, mapping, and commercial calculation

**Owns:** `packages/pricebook/**`, price-book import/editor feature path assigned in the manifest, mapping engine, commercial-rule tests, and synthetic price-book fixtures.

**Tasks:**

- implement validated CSV import and XLSX import if the existing stack supports it safely;
- provide column mapping, preview, error rows, duplicate detection, and atomic commit;
- implement manual create/edit/activate/deactivate for price-book entries;
- support item code, German description, category, unit, precise unit price, tax category/rate reference, valid-from/to, active state, and optional synonyms;
- seed a small synthetic Maler price book sufficient for the canonical journey;
- implement mapping from extracted facts to approved entries using deterministic rules first and provider suggestions only as non-authoritative candidates;
- reject cross-tenant, inactive, expired, missing, or unit-incompatible entries;
- never let fuzzy confidence alone create a priced line;
- return `unmatched` or clarification when safe mapping is unavailable;
- implement calculation explanations and stable rounding;
- prevent duplicate or double-counted lines;
- make company-specific synonyms/mapping corrections tenant-scoped;
- test locale decimal formats, umlauts, CSV injection, duplicates, negative/zero values, large values, rounding edges, incompatible units, deactivated items, and unknown item codes.

**Acceptance evidence:** imported fixtures preview and commit deterministically; every priced line resolves to an active same-tenant entry; unknown/incompatible mappings fail closed; calculations match golden fixtures.

### T06 — Missing-information engine, uncertainty, and provenance

**Owns:** `packages/provenance/**`, clarification/risk domain service package if separate, `apps/web/src/features/clarifications/**`, provenance UI components for assigned surfaces, and related tests.

**Tasks:**

- define critical facts for the initial painting/interior-renovation workflow;
- implement deterministic rules that convert missing, contradictory, or low-confidence facts into targeted German questions;
- include answer types, allowed units/options, rationale, severity, blocking/non-blocking state, and source context;
- implement the two canonical questions exactly enough for stable E2E selection;
- link answers back to facts and recompute mapping/draft readiness;
- preserve unresolved uncertainty rather than coercing it to a value;
- implement source citation creation and validation for transcript segments, explicit measurements, user answers, company rules, and photo context;
- display a compact `Warum diese Position?` explanation;
- visually distinguish confirmed, inferred, edited, excluded, and unresolved information;
- block readiness if a critical question remains unanswered;
- detect contradictory evidence and require human resolution;
- ensure photo-only claims about dimension or hidden condition remain non-authoritative;
- test critical omissions, contradictions, stale answers after evidence changes, deleted sources, and orphan citations.

**Acceptance evidence:** canonical questions appear and block the draft; answering them changes the draft deterministically; every generated line has valid visible provenance; no critical omission is silently ignored.

### T07 — Draft review, human approval, PDF, and CSV export

**Owns:** `packages/exports/**`, `apps/web/src/features/offer-review/**`, draft review/approval screens, export templates, golden export fixtures, and tests.

**Tasks:**

- build line-item review with quantity, unit, approved item, unit price, net, tax, gross, source, confidence/risk, and origin state;
- allow bounded edits while preserving auditability and same-price-book constraints;
- show unmatched/excluded items separately from priced items;
- implement revision summary and commercial-change detection;
- require an explicit human confirmation before approval;
- invalidate approval after any commercial edit;
- block export when unresolved critical questions exist or the current revision is unapproved;
- create a branded German PDF with clear synthetic/demo identity in fixtures, page numbers, totals, notes, and readable line wrapping;
- create a machine-readable, spreadsheet-safe CSV with stable headers, UTF-8, locale-safe numeric representation, and CSV-injection protection;
- persist export metadata and content hash;
- ensure generated files do not expose internal prompts, raw provider payloads, storage paths, or unnecessary personal data;
- test multi-page PDFs, long German descriptions, umlauts, rounding, zero-line drafts, stale approvals, and repeated exports;
- visually inspect the rendered PDF, not only byte creation.

**Acceptance evidence:** unapproved export is denied; approved export succeeds; an edit invalidates approval and blocks export; PDF is visually verified; CSV parses and matches totals.

### T08 — Tenant security, privacy controls, audit log, and abuse resistance

**Owns:** `packages/security/**`, privacy/audit services, `apps/web/src/features/privacy/**`, security tests, threat model, and privacy/security documentation.

**Tasks:**

- define trust boundaries and create `docs/security/THREAT_MODEL_VERTICAL_SLICE_V1.md`;
- implement central organisation scoping and authorization checks rather than trusting client-supplied organisation IDs;
- provide demo identity only in explicit development/test mode and hard-fail if enabled in production configuration;
- implement secure session/cookie and CSRF posture appropriate to the selected stack;
- validate input at every trust boundary;
- apply upload, extraction, and export rate/size limits suitable for a local slice;
- implement audit events without raw sensitive payloads;
- implement project data export and deletion request/demo deletion flow with confirmation and status;
- document retention assumptions and processor/provider boundaries without claiming legal certification;
- ensure error messages and logs do not leak cross-tenant existence or sensitive content;
- add baseline security headers and safe download behaviour;
- add secret scanning and dependency vulnerability checks in collaboration with T09;
- test horizontal privilege escalation, ID enumeration, mass assignment, cross-tenant export, cross-tenant deletion, malicious filenames, injection payloads, and disabled demo-auth production mode;
- document remaining production blockers: qualified legal review, DPA/subprocessors, production auth, encryption/key management, backup/restore, incident process, penetration test, and hosting-region decision.

**Acceptance evidence:** negative tenant-isolation suite passes; demo auth cannot start in production mode; audit records contain no raw media/transcript; deletion/export are scoped and confirmed; threat model lists mitigated and accepted risks.

### T09 — Platform, dependency governance, CI, local environment, and observability

**Owns:** root workspace configuration after bootstrap, lockfile, shared lint/type/test config, `.github/workflows/**` or existing CI equivalent, `infra/local/**`, `packages/observability/**`, dependency reconciliation, and operator tooling.

**Tasks:**

- reconcile approved dependency requests from all threads;
- pin supported runtime/package-manager versions and document them;
- provide one-command local setup, database migration, seed, dev, test, and E2E paths where practical;
- provide local PostgreSQL/object-storage dependencies or equivalent development adapters;
- implement CI jobs for install integrity, format, lint, type-check, unit, integration, build, E2E, migration check, secret scan, and dependency/security audit;
- make CI deterministic and independent of paid services and real AI keys;
- add concurrency/cancellation and caching without hiding failures;
- add structured logging with redaction and request/correlation IDs;
- add metrics/events for processing duration/outcome, mapping result, clarification count, approval time, edit count, export outcome, and cost placeholders;
- ensure telemetry avoids raw customer content and supports a disabled/local mode;
- implement health/readiness checks for required local services;
- add environment template with placeholders only and configuration validation;
- generate an SBOM or dependency inventory if supported by the stack;
- document backup/restore and production observability as future blockers rather than pretending the local slice provides them;
- record baseline and final CI evidence with exact commands and run URLs when available.

**Acceptance evidence:** clean install from lockfile, all CI gates pass from a fresh checkout, no external AI dependency, config fails clearly when invalid, logs are redacted, and local runbook is reproducible.

### T10 — End-to-end acceptance, synthetic demo, release evidence, and operational documentation

**Owns:** `tests/e2e/**`, `fixtures/synthetic/**` coordination, end-to-end acceptance harness, demo script, user-facing help for the slice, integration evidence documents, and final scorecard inputs. T10 may request but must not directly change other threads' owned code.

**Tasks:**

- define E2E tests for the complete canonical journey before feature completion;
- create deterministic synthetic fixture pack: organisation, user, customer, project, audio/transcript, image, measurements, price book, expected facts, clarification answers, approved draft, PDF/CSV expectations;
- ensure every fixture is labelled synthetic and contains no real personal data;
- test the happy path in a real browser at mobile and desktop widths;
- test recoverable paths: denied microphone permission, upload failure, invalid model output, unknown price-book mapping, unanswered critical question, stale approval, and export retry;
- test safety paths: hallucinated price code, photo-only measurement, prompt-injection transcript, cross-tenant ID, malicious CSV field, and post-approval edit;
- add accessibility smoke tests and meaningful assertions, not screenshot-only tests;
- create `docs/demo/VERTICAL_SLICE_V1_DEMO_SCRIPT.md` with a five-to-ten-minute walkthrough;
- create `docs/operations/LOCAL_RUNBOOK.md` and `docs/operations/TROUBLESHOOTING.md` with T09;
- create a traceability matrix mapping each product invariant and acceptance criterion to automated tests and evidence;
- gather screenshots and rendered export samples from synthetic data where repository policy permits;
- independently score the integrated slice using the gate below and list unsupported claims;
- document open risks and production blockers without downgrading them to cosmetic issues.

**Acceptance evidence:** the canonical E2E passes from a seeded fresh environment, all named failure/safety paths have tests, demo script is reproducible, and the traceability matrix contains no untested critical invariant.

## THREAD WORKING RULES

Each Txx thread must:

1. Confirm its branch and worktree before editing.
2. Write a short plan in its thread report.
3. Inspect existing code before creating parallel abstractions.
4. Stay within owned paths. Shared changes require the change protocol.
5. Use small, reviewable commits with conventional, meaningful messages.
6. Rebase or merge from the coordinator-distributed integration SHA only when instructed; do not pull arbitrary peer branches.
7. Run focused tests throughout and the assigned gate before handoff.
8. Update its report with changed files, commands, test counts, known gaps, risk changes, dependency requests, and commit SHA.
9. Push its branch and open a Draft PR targeting `codex/handwerk-vertical-slice-v1` when GitHub access is configured.
10. Never merge its own PR or report a self-score as independent evidence.

Each thread report must use this table:

| Field | Evidence |
|---|---|
| Branch / worktree | exact values |
| Base SHA / final SHA | exact SHAs |
| Scope delivered | linked files or commits |
| Acceptance criteria | pass/fail with evidence |
| Tests | exact commands and counts |
| Security/privacy impact | findings and mitigations |
| Contract/dependency requests | links or `None` |
| Known gaps | explicit list |
| Integration notes | migration/order/conflicts |

## INTEGRATION PROTOCOL

The coordinator remains active while T01–T10 work and maintains the decision/risk registers. Integrate only after reviewing the diff and thread evidence.

Recommended merge order into `codex/handwerk-vertical-slice-v1`:

1. T01 domain/data
2. T08 security/privacy
3. T09 platform/quality and approved dependency reconciliation
4. T03 evidence capture
5. T04 AI extraction
6. T05 price-book/mapping
7. T06 clarification/provenance
8. T02 web/customer/project shell
9. T07 review/export
10. T10 E2E/release evidence

This is integration order, not execution order; all threads begin in parallel after bootstrap.

For each thread:

- inspect commits and diff against `BASELINE_SHA`;
- verify scope and ownership;
- run focused tests;
- resolve conflicts intentionally—never accept one side wholesale without understanding it;
- merge into the integration branch with a traceable merge or approved squash strategy;
- run the growing integrated gate;
- record the integration SHA and result;
- if the gate fails, return a bounded correction request to the owning thread.

After all merges:

- reinstall from the reconciled lockfile in a clean environment;
- recreate local dependencies and database from zero;
- apply migrations and seed fixtures;
- run format, lint, type-check, unit, integration, build, E2E, accessibility, secret, dependency, and migration checks;
- run the complete canonical journey manually or through browser automation;
- render and visually inspect the PDF;
- parse and reconcile the CSV against UI/PDF totals;
- inspect logs to verify redaction;
- verify Git status contains only intentional files;
- audit committed files for secrets, real personal data, generated junk, local paths, private IPs, and oversized artifacts.

Do not merge the integration branch into `main`. Open or update one Draft integration PR targeting the approved base branch if remote access exists.

## TEST MATRIX

At minimum, cover:

### Unit tests

- money rounding and tax calculations;
- quantity/unit compatibility;
- state transitions and approval invalidation;
- price-book parser and row validation;
- mapping allowlist/inactive/tenant rules;
- clarification rules;
- provenance validation;
- AI schema validation and injection resistance;
- filename/media validation;
- CSV escaping/injection prevention.

### Integration tests

- clean migrations and seed;
- organisation-scoped repositories and API actions;
- evidence upload metadata lifecycle;
- extraction → mapping → clarification → draft pipeline;
- approval and export authorization;
- deletion/data-export scoping;
- audit event creation and redaction.

### Contract tests

- frontend/server payload compatibility;
- versioned AI structured output;
- storage adapter behaviour;
- deterministic fake provider behaviour;
- PDF/CSV export contract.

### E2E tests

- complete canonical journey;
- transcript fallback;
- ceiling exclusion after clarification;
- unresolved critical question blocks approval;
- approval required for export;
- post-approval edit invalidates export permission;
- unapproved/unknown item cannot be priced;
- photo-only measurement cannot become authoritative;
- cross-tenant access fails without revealing resource existence;
- data export/deletion confirmation.

### Non-functional checks

- mobile viewport and touch interaction;
- keyboard navigation and automated accessibility smoke check;
- bounded file sizes and request limits;
- basic performance budgets for the canonical page and extraction fixture;
- logs contain no raw protected content;
- no external AI/network dependency in CI;
- fresh-checkout reproducibility.

Tests must assert behaviour and invariants. Snapshot-only or existence-only tests are insufficient for critical paths.

## QUALITY SCORE AND CORRECTION LOOP

Score the integrated slice out of 100 using evidence:

| Area | Weight | Required evidence |
|---|---:|---|
| End-to-end customer value | 20 | canonical journey and usable output |
| Approved-price-book accuracy and calculations | 15 | invariant, golden, and negative tests |
| Uncertainty, clarification, provenance, human control | 15 | blocking questions, citations, approval tests |
| Privacy, security, and tenant isolation | 15 | threat model and negative security suite |
| Test quality and reproducibility | 15 | clean environment and traceability matrix |
| Mobile UX and accessibility | 8 | browser, viewport, keyboard, a11y evidence |
| Architecture and maintainability | 7 | ADRs, boundaries, migrations, clean types |
| Operations and observability | 5 | runbook, redaction, health/config evidence |
| **Total** | **100** | |

Integrated pass conditions:

- total score is at least **85/100**;
- each area scores at least 60% of its available points;
- all CI and acceptance gates pass;
- no unresolved critical security/privacy defect;
- no dangerous unflagged scope or pricing omission;
- invented/unapproved priced-position rate is zero in the evaluation set;
- all critical invariants have automated tests;
- the canonical journey works from a fresh seeded environment.

Per-thread handoff should target at least 90/100 against its own acceptance criteria, but the coordinator must not inflate scores for quantity of files or tests.

If any gate fails:

1. Create a correction record containing defect, severity, evidence, owner, affected invariant, required test, and exit criterion.
2. Assign it to the owning Txx thread.
3. Make the smallest principled correction; do not patch around the test.
4. Add a regression test.
5. Rerun the focused gate and then the integrated gate.
6. Repeat until the pass conditions are met or a genuine external blocker is reached.

Do not conceal blockers or redefine acceptance criteria after failure. If an external blocker prevents completion, leave the integration branch runnable, document the exact blocker and safe fallback, and do not claim success.

## DEFINITION OF DONE

The vertical slice is done only when all of the following are true:

- the exact canonical journey is runnable end-to-end;
- all ten thread reports and integration records are complete;
- only synthetic data is present;
- an approved company price-book is the sole source of commercial prices;
- missing critical information creates visible blocking questions;
- every priced line is traceable;
- human approval is mandatory and invalidated by later commercial edits;
- PDF and CSV exports agree and are available only after approval;
- tenant isolation, privacy controls, audit log, and redacted observability are tested;
- the application runs without a paid AI key;
- a fresh checkout can be set up through the documented runbook;
- the integrated score is at least 85/100 with no critical blockers;
- the Draft integration PR or local integration branch contains no unrelated changes;
- `main` remains untouched and no production deployment occurred.

## REQUIRED FINAL HANDOFF

Return a concise executive summary first, followed by evidence tables. Include:

1. Outcome: completed / partially completed / blocked.
2. Exact base branch, integration branch, `BASELINE_SHA`, final integration SHA, and Draft PR URL if created.
3. Ten-thread table with branch, owner, scope, final SHA, PR, tests, score, and status.
4. Integrated test table with exact commands, pass counts, failures/skips, and CI URLs when available.
5. Canonical journey result and links/paths to synthetic screenshots, PDF, and CSV where policy permits.
6. Invariant traceability summary.
7. Final 100-point score with evidence for every category.
8. Security/privacy findings and production blockers.
9. Known limitations and items deliberately excluded.
10. Exact local run/demo commands.
11. Correction cycles performed and their final outcomes.
12. Recommendation to Mohsen: accept the internal slice, request correction, or stop/revise before further investment.

Use precise language. Distinguish `implemented`, `tested`, `manually verified`, `documented`, and `not implemented`. Do not use `production-ready`, `GDPR-compliant`, `legally compliant`, or `market-ready` unless independent evidence actually supports those claims.

## START NOW

Begin with the coordinator bootstrap checkpoint. Do not ask broad architectural or product questions that the brief already answers. Ask Mohsen only when a missing choice is truly blocking, destructive, paid, legally consequential, or outside the granted scope. Otherwise make the safest reversible decision, record it in the decision register, and continue through implementation, integration, verification, and the correction loop.

---

End of prompt.
