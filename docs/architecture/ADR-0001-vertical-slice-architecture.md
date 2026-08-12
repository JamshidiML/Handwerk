# ADR-0001: Vertical Slice Architecture

## Status

Accepted for the internal V1 vertical slice on 12 August 2026.

## Context

The repository is greenfield apart from an authoritative product brief and execution prompt. Ten parallel workstreams must deliver one coherent synthetic-data demonstration with strong commercial safety, provenance, human approval, tenant isolation, and reproducible tests. Production deployment is prohibited.

## Decision

Use a TypeScript modular monolith managed by npm workspaces:

- `apps/web`: Vinext/React mobile-first web surface and server boundary;
- `packages/contracts`: frozen versioned domain, API, event, and AI extraction contracts;
- domain packages for business rules, persistence, media, AI, price-book mapping, provenance, exports, security, and observability;
- PostgreSQL-oriented schema/repository implementation with forward-only migrations, plus deterministic local/test adapters where Docker is unavailable;
- private object-storage interface with a local test implementation; no public bucket semantics;
- deterministic fake transcription/extraction provider as the default;
- precise commercial arithmetic using integer EUR minor units and decimal-string quantities;
- human approval bound to a draft revision, invalidated by any commercial edit;
- source citations required on generated commercial lines;
- browser E2E against synthetic fixtures only.

The web starter includes Sites-compatible D1/R2 declarations but both remain `null`; they are not authoritative product persistence and no production deployment occurs. Replacing PostgreSQL with platform storage would require a later ADR and contract-compatible migration plan.

## Trust Boundaries

Client input, uploads, transcript text, filenames, extracted text, model output, route IDs, and export parameters are untrusted. Server-side organisation context comes from the authenticated session/demo boundary, never from a client-supplied organisation ID. AI output cannot set commercial prices or approved item codes. Photos can only produce context citations.

## Consequences

The slice can run without paid services and can prove domain invariants independently of the UI. It deliberately does not provide production authentication, encryption/key management, backups, regional hosting assurance, legal review, billing, external sending, or market validation.
