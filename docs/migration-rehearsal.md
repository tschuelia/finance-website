# Production migration rehearsal record

The implementation can migrate a fresh or compatible copied database, but the
operational rehearsal and production adoption require production data and
deployment access and remain incomplete.

Use [production-data-migration.md](production-data-migration.md) for the complete
sequence. Record the candidate image digest, data-copy source and timestamp,
backup verification, pre/post inspection output, Alembic status, workflow checks,
restore result, timings, discrepancies, and proceed/stop decision here when the
rehearsal is performed.

On 2026-08-13, local production serving was verified only with a newly initialized
temporary SQLite database at revision `0002_server_sessions` and a local
`frontend/dist`. The local Docker daemon was unavailable, and no copied
production database or media was provided. This is not a production rehearsal.
