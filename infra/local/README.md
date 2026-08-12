# Local Dependencies

`compose.yml` runs PostgreSQL and S3-compatible MinIO for synthetic local development. Both services bind to `127.0.0.1`; the object-storage initializer creates a private bucket and explicitly disables anonymous access.

Use the repository commands instead of invoking this file directly:

```sh
npm run env:init
npm run services:up
npm run health
npm run services:down
```

Persistent named volumes are intentionally retained by `services:down`. See `docs/operations/LOCAL_RUNBOOK.md` before deleting them.
