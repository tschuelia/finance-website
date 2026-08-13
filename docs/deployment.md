# Deployment

This document deploys the FastAPI/React application. It does not replace the
pre-migration baseline or recovery procedure in
[legacy-baseline.md](legacy-baseline.md).

## Runtime contract

The production image has three stages: Bun builds `frontend/dist`, Pixi installs
the locked default backend environment, and a small Debian runtime serves both.
It runs as uid/gid `10001`, starts exactly one Uvicorn worker, and exposes port
`8000`. One worker is intentional: SQLite allows only one writer at a time.

Mount one durable host directory or named volume at `/data`:

| Container path | Purpose |
| --- | --- |
| `/data/db.sqlite3` | SQLite database, including its WAL/SHM sidecars while running |
| `/data/media` | Uploaded and imported files |

For a bind mount, prepare the directory before the first start. The application
validates both the database parent and media directory at startup.

```sh
sudo install -d -o 10001 -g 10001 -m 0700 /srv/finances/data/media
sudo install -d -o 10001 -g 10001 -m 0700 /srv/finances/backups
```

Do not mount a repository checkout, a transient container filesystem, or the
legacy application’s live database directly. Copy and verify data during a
maintenance window first.

The container requires these runtime variables:

| Variable | Production setting |
| --- | --- |
| `FINANCES_SESSION_SECRET` | A unique secret of at least 32 characters, stored in the deployment secret manager |
| `FINANCES_ALLOWED_HOSTS` | JSON list of public host names, for example `["finances.example.com"]` |
| `FINANCES_COOKIE_SECURE` | `true` (the image default) when HTTPS terminates at the reverse proxy |
| `FINANCES_DEVELOPMENT_LOGGING` | `false` (the image default) |
| `FINANCES_DATABASE_PATH` | `/data/db.sqlite3` (the image default) |
| `FINANCES_MEDIA_ROOT` | `/data/media` (the image default) |

Keep TLS termination and the public hostname in a reverse proxy. Publish the
container only to the proxy, not directly to the public internet.

## Build and first start

The checked-in lock currently contains `linux-64`, not Linux ARM, resolution.
Build an AMD64 image explicitly from an Apple Silicon host until Linux ARM is
added and reviewed in Pixi’s platform matrix:

```sh
docker buildx build --platform linux/amd64 --tag finances:2026-08-13 --load .
```

Create a new database only after its durable mount and secret are ready:

```sh
docker run --rm \
  -e FINANCES_SESSION_SECRET='replace-with-a-secret-from-your-secret-manager' \
  -e FINANCES_ALLOWED_HOSTS='["finances.example.com"]' \
  -v /srv/finances/data:/data \
  finances:2026-08-13 finances db upgrade

docker run --detach --name finances --restart unless-stopped \
  --publish 127.0.0.1:8000:8000 \
  -e FINANCES_SESSION_SECRET='replace-with-a-secret-from-your-secret-manager' \
  -e FINANCES_ALLOWED_HOSTS='["finances.example.com"]' \
  -v /srv/finances/data:/data \
  finances:2026-08-13
```

The image health check calls `/health`. After the proxy is configured, verify
`/health`, `/docs`, a protected `/api/v1/...` route, a direct hashed asset, and
a client-side SPA route. `/api`, `/health`, `/docs`, `/redoc`, and
`/openapi.json` are never routed to the SPA fallback.

`Procfile` is retained for process-platform deployments and contains only the
new web command. It intentionally has no release migration command: migrations
must run while the application is stopped.

## Stopped-app migration procedure

Run every migration during a maintenance window. Do not use a release hook or
run a migration against a live multi-process deployment.

1. Announce maintenance, stop the running application, and confirm no old
   process still has the database open.
2. Create and verify a database-and-media backup. Follow the commands in
   [legacy-baseline.md](legacy-baseline.md#backup-restore-and-recovery).
3. Run read-only inspection with the candidate image and the durable mount.

   ```sh
   docker run --rm \
     -e FINANCES_SESSION_SECRET='replace-with-the-deployment-secret' \
     -v /srv/finances/data:/data \
     finances:2026-08-13 finances db inspect
   ```

4. When moving a verified legacy Django database for the first time, run
   `finances db bootstrap-existing` exactly once. It stamps the known baseline
   only after schema validation. Do not run it on an Alembic-managed database.
5. Run `finances db upgrade`, then `finances db status`; both must succeed and
   status must report no pending upgrade.
6. Start the new container, wait for healthy status, and perform the smoke
   checks listed above before ending maintenance.

If any step fails, keep the app stopped, retain the failed state for diagnosis,
and restore the verified recovery point. Do not attempt downgrade migrations
against production data.

## Backup and restore

Backups contain both `/data/db.sqlite3` and `/data/media`. They must be kept
outside the repository with restrictive permissions. The baseline document
provides commands that use SQLite’s backup API, checksums, database integrity
checks, and media archive validation.

For restore, stop the container first. Verify the selected backup, move the
current database, `-wal`, `-shm`, and media directory to timestamped
`pre-restore` names, restore the database and media together, verify them, then
start the service and make a new confirmed backup. Retain the moved state until
the restored service has been validated.

## Rollback

Keep the tagged legacy Django image, its locked `legacy` Pixi environment, and
the verified pre-cutover backup through the rollback window. Application-code
rollback is only safe while the database schema and data remain compatible with
the legacy release. If a forward migration has made them incompatible, restore
the paired database-and-media recovery point instead of starting Django against
the migrated database.

## Dependency-audit constraints

Current dependency-audit results and unresolved platform/tooling constraints are
recorded in [dependency-audit.md](dependency-audit.md). Legacy-only Django
packages remain frozen during the rollback window.
