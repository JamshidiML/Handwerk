# Production Blockers

The vertical slice must not process real customer data or be deployed as a production service. The following are release blockers, not deferred polish:

| Blocker                                          | Required exit evidence                                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Qualified German/EU legal and privacy review     | Written review of lawful basis, notices, capture scenarios, retention, data-subject workflows, contracts, and AI obligations                           |
| Production authentication and account lifecycle  | Selected provider, trusted-proxy model, MFA/risk decision, invite/recovery/offboarding, revocation, rotation, and tested tenant membership enforcement |
| DPA and subprocessor governance                  | Approved provider inventory, DPAs, subprocessors, transfer basis, training/retention settings, and change-notification process                         |
| Encryption and key management                    | TLS termination design, encryption at rest, managed key ownership/rotation, secret storage, and access review                                          |
| Hosting-region decision                          | Approved EU/EEA regions for application, database, object storage, backups, logs, support access, and failover                                         |
| Backup, restore, and deletion propagation        | Encrypted backups, restore drill, RPO/RTO, retention schedule, deletion propagation proof, and legal-hold process                                      |
| Incident response                                | Named on-call/decision roles, detection and triage, evidence handling, notification process, tabletop exercise, and customer communication templates   |
| Independent penetration/security assessment      | Authenticated tenant-isolation test, upload/parser testing, session/CSRF review, dependency/SBOM review, findings fixed and retested                   |
| Shared abuse controls                            | Distributed atomic rate limiting, trusted proxy/IP design, quotas, concurrency limits, alerting, and capacity tests                                    |
| Production observability with verified redaction | Central logs/metrics/traces, access controls, retention, redaction tests, alerting, and raw-content inspection                                         |
| Media security lifecycle                         | Content detection, malware strategy, metadata removal decision, private object policies, signed access TTL, quarantine, deletion, and bucket audit     |
| Privacy operations                               | Verified request intake, export review, deletion workflow, status communication, deadlines, audit tombstones, and backup/provider propagation          |
| Secure delivery pipeline                         | Protected branches, reproducible CI, secret scan, dependency audit, SBOM, signed artifacts where appropriate, environment separation, and rollback     |
| Availability and data integrity                  | Database constraints, migrations, idempotency, concurrency controls, health checks, recovery tests, and operational ownership                          |

Additional launch decisions include cookie/domain topology, CSP verification against the integrated build, browser security testing, vulnerability disclosure, access-review cadence, support access, workstation policy, and insurance/risk acceptance.

Passing the T08 tests demonstrates scoped controls against deterministic synthetic fixtures. It does not mean the product is production-ready, GDPR-compliant, legally compliant, or penetration-tested.
