# Observability and Data Minimisation

## Operating Modes

`TELEMETRY_MODE=disabled` discards all metric points and is used in CI. `local` stores bounded in-process metric points for the synthetic demo. No remote exporter is implemented, and no telemetry leaves the process.

## Correlation

The server boundary may accept `x-correlation-id` only when it matches the constrained 8-128 character format. Invalid input is replaced with a UUID. Audit events can share this ID without embedding tenant, customer, project, or evidence values.

Stable organisation grouping, if truly needed, uses `privacyHash` with a separately managed salt. Raw organisation IDs must not become metric labels or log attributes.

## Structured Logs

`@handwerk/observability/logger` emits one JSON object per line. It requires service, environment, severity, event, timestamp, and correlation ID. Runtime attributes use an explicit allowlist; every unknown key, object, array, exception, transcript, address, filename, object key, signed URL, prompt, or customer-controlled value is replaced with `[REDACTED]`.

Allowed attributes are operational values such as duration, outcome, safe route templates, status codes, model/schema versions, counts, export kind, and cost/token placeholders. Error event names and bounded `errorCode` values are allowed; raw exception messages are not.

## Metrics

| Metric                      | Type/intention              | Fixed dimensions |
| --------------------------- | --------------------------- | ---------------- |
| `processing.duration_ms`    | Stage duration              | stage, outcome   |
| `mapping.result_total`      | Mapping result count        | result           |
| `clarification.count`       | Questions per draft         | none             |
| `approval.time_ms`          | Review-to-approval duration | none             |
| `draft.edit_total`          | Commercial edit count       | field category   |
| `export.outcome_total`      | Export attempts             | kind, outcome    |
| `ai.cost_placeholder_minor` | Cost placeholder only       | provider         |

The metrics API rejects unknown labels, arbitrary values, negative values, infinity, and NaN. It deliberately has no customer, project, transcript, item description, filename, address, or free-text dimensions.

## Health Semantics

Liveness answers whether the process can run. Readiness checks required dependencies concurrently with a bounded timeout and reports `ready` only when all checks pass. Responses contain safe reason codes, never URLs, credentials, raw exceptions, or customer content.

## Production Gap

No remote collector, dashboard, SLO, paging policy, retention policy, access review, or incident integration exists. Those controls require an approved hosting design and privacy/security review before production use.
