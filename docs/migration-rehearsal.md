# Migration rehearsal

This is a runbook for the pre-production rehearsal. It records the required
evidence without declaring the operational rehearsal or cutover complete.

## Preconditions

- A current, verified backup of the candidate database and media exists outside
  the repository.
- The candidate data is a copy, never the production mount.
- The image was built from the locked revision and its target architecture is
  recorded.
- A deployment secret and test hostname are available without writing secrets to
  shell history, source control, or logs.
- The legacy Django image and its compatible recovery point remain available.

## Rehearsal sequence

1. Start from the copied data with no application process running.
2. Run `finances db inspect` and record the schema, foreign-key, journal, and
   aggregate results.
3. If this is a legacy database that has never been adopted, run
   `finances db bootstrap-existing`; otherwise skip it.
4. Run `finances db upgrade` and `finances db status`; record the revision and
   confirm no upgrade is pending.
5. Start the one-worker production image with the `/data` mount and production
   environment variables.
6. Verify health, API authentication/session handling, the major read and write
   workflows, imports, downloads, static hashed assets, and a direct SPA route.
7. Stop the candidate, create and validate a new paired database/media backup,
   then rehearse a restore to a fresh copy.
8. Confirm the legacy rollback image can start against the preserved compatible
   copy or, if not compatible, that the verified recovery point restores it.

Record timings, image digest, database revisions, verification outputs, known
gaps, and the decision to proceed or stop in the deployment record. A successful
local smoke check is not a substitute for this rehearsal.

## Current implementation verification

On 2026-08-13, a local production-serving smoke check used a newly initialized
temporary SQLite database at Alembic revision `0002_server_sessions` and a
locally built `frontend/dist`. It verified `/health`, `/docs`, a missing API
route, SPA fallback, a direct hashed asset, and missing asset handling. It did
not use a copied production database, production media, a reverse proxy, or a
built container image.

The local Docker client was present but its daemon was unavailable, so the
multi-stage image has not yet been built or run in this environment. The
pre-production rehearsal and operational cutover therefore remain outstanding.
