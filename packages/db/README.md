# Domain Persistence Boundaries

This package persists the internal vertical slice in PostgreSQL and provides deterministic in-memory adapters for unit and local workflows. All repository reads and writes require a server-derived organisation scope. Tenant-owned foreign keys include `organisation_id`, so a caller cannot create a cross-organisation relationship by supplying an ID from another tenant.

## Forward-Only Migrations

`migrations/` contains immutable, ordered SQL files. The migration runner records a SHA-256 checksum and refuses to continue if an applied migration changes. Rollback scripts are deliberately absent; corrections require a new numbered migration.

## Synthetic Seed

`seeds/0001_synthetic_westblick.sql` is idempotent and contains only explicit synthetic demo records. It seeds the canonical organisation, demo owner, customer, project, site visit, and active approved price book. It does not seed media, transcripts, addresses, or real commercial data.

## Deletion And Retention Boundary

The T01 demo deletion operation is project-scoped and hard-deletes the project plus cascading site visits, evidence metadata, extraction/mapping records, clarifications, drafts/revisions/approvals/exports, audit events, and deletion request. It returns private object keys to the T08/media integration boundary, which must delete the corresponding object bytes before reporting end-to-end completion.

Organisation, users, memberships, reusable customer records, price books, and price-book items remain because they are outside a project deletion request. Unreferenced source citations are removed. A content-free deletion receipt retains only organisation ID, request ID, aggregate record counts, completion time, and a 30-day purge date; the future retention worker must purge it. Production retention schedules, legal holds, backup erasure, processor deletion, and identity/account deletion remain explicit production blockers for T08 and the coordinator.
