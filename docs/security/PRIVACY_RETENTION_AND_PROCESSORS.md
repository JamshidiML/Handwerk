# Privacy Retention And Processor Boundaries

## Purpose

This document records implementation assumptions for the internal synthetic slice. It does not establish a lawful basis, retention policy, data-processing agreement, or GDPR/AI Act compliance. Those decisions require qualified legal and privacy review before any real data is processed.

## Data Inventory And Minimisation

| Data group                     | Vertical-slice purpose                 | Exported to project owner                  | Audit/log treatment                |
| ------------------------------ | -------------------------------------- | ------------------------------------------ | ---------------------------------- |
| Customer/project labels        | Identify the synthetic workflow        | Yes                                        | IDs only; no address/name text     |
| Photo/audio metadata           | Evidence integrity and presentation    | Safe metadata only                         | Asset ID/kind/size only            |
| Private object key/media bytes | Local evidence storage                 | Object key: no; media delivery is separate | Never                              |
| Transcript                     | Scope evidence and user correction     | Yes                                        | Never raw                          |
| Explicit measurements          | Authoritative quantity evidence        | Yes                                        | Count/ID only if needed            |
| Questions, draft, approval     | Review and human-control evidence      | Yes                                        | Event code, IDs, revision, outcome |
| Export artifact metadata       | Download integrity                     | Via owning export service                  | Kind/size/artifact ID only         |
| Deletion request               | Consequence and authorization evidence | Status/ID                                  | Status/request ID only             |

Project data exports are JSON attachments with a schema marker and checksum. They intentionally contain the project's transcript because that is user data requested by the authorised project member. They exclude private object keys, signed URLs, raw provider payloads, prompts, arbitrary audit metadata, and secrets.

## Slice Retention Assumptions

- Synthetic project data persists until the local environment is reset or an owner completes demo deletion.
- A confirmed non-demo deletion request is a workflow record only; this slice deliberately cannot execute production deletion.
- Demo deletion adapters must atomically remove project-owned customer linkage where safe, visits, evidence metadata/media references, transcript, measurements, extraction/mapping records, questions/answers, drafts/revisions/approvals, and export artifacts.
- Shared customer records must not be removed when referenced by another project. T01 persistence owns the final referential implementation.
- Audit storage may retain a minimal deletion tombstone containing organisation/project/request identifiers, status, timestamp, actor ID, and outcome. It must not retain deleted content.
- Backup copies, object-store versioning, caches, CDN artifacts, analytics stores, and disaster-recovery copies are not implemented or deletion-tested. Production retention cannot be promised until all copies have owners and deletion SLAs.

## Current Provider Boundary

The acceptance path uses deterministic fake AI and local/test storage. No paid AI provider or external customer-data processor is required by T08. Development dependencies and hosting tooling do not become approved data processors merely because they are present in the repository.

Before enabling any external AI, transcription, object storage, observability, email, analytics, authentication, hosting, or support provider, the product owner must approve:

- purpose and minimum fields sent;
- controller/processor roles and data-processing terms;
- subprocessors and international transfer mechanism;
- EU/EEA region and support-access behavior;
- provider retention/training settings and deletion capability;
- encryption/key ownership and incident notification;
- data-subject export/deletion support;
- tested disabled/local fallback where required.

## Required Human Decisions

- Lawful basis and customer/site-occupant transparency.
- Whether consent is needed for particular audio/photo capture scenarios.
- Retention periods by record type and contract/legal hold exceptions.
- Identity verification for privacy requests.
- Response process and deadlines for access/deletion requests.
- Appropriate audit tombstone retention.
- Approved processors, subprocessors, hosting region, and transfer safeguards.

Until these decisions are approved and implemented, only unmistakably synthetic data may be used.
