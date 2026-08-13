# Finances

Private finance application currently migrating from Django to FastAPI and React.

The application manages bank accounts, CSV transaction imports, categories,
contracts, depots, and financial analytics.

The migration is intentionally incremental. The legacy Django application remains
available in a frozen rollback environment while the new workspaces are built.

## Development

This repository uses [Pixi](https://pixi.sh) for Python, Bun, and shared tooling.
Install the default locked environment and frontend dependencies after cloning:

```sh
pixi install --locked
pixi run frontend-install
pixi run hooks-install
```

The default environment uses Python 3.14 for the FastAPI backend and Bun 1.3.11
for the React frontend. Bun 1.3.11 is the newest release currently available for
both repository platforms through conda-forge.

The FastAPI backend requires a session secret with at least 32 characters. It
checks the database and media paths during startup and exposes its health
endpoint at `http://127.0.0.1:8000/health`. Start the backend and Vite frontend
together with:

```sh
export FINANCES_SESSION_SECRET='replace-with-a-random-secret-of-32-or-more-characters'
pixi run dev
```

The individual `pixi run backend-dev` and `pixi run frontend-dev` tasks remain
available when separate terminals are more convenient.

Vite proxies `/api` to `http://127.0.0.1:8000` by default. Set
`VITE_API_PROXY_TARGET` only when the backend is listening elsewhere. To serve a
production frontend build through FastAPI locally, build it and use the
single-worker production command:

```sh
pixi run frontend-build
pixi run backend-serve
```

The backend still starts without `frontend/dist`; only SPA routes return `404`
until a frontend build is present. API, health, and documentation routes remain
available in that mode.

Configuration is read from process environment variables only. `.env.example`
documents the complete contract but is not loaded automatically. Local
development defaults to `db.sqlite3`, `media/`, insecure cookies, a 14-day
session lifetime, localhost/test hosts, and development logging. Override the
corresponding `FINANCES_*` values for production, especially
`FINANCES_DATABASE_PATH`, `FINANCES_MEDIA_ROOT`, `FINANCES_COOKIE_SECURE`,
`FINANCES_ALLOWED_HOSTS`, and `FINANCES_DEVELOPMENT_LOGGING`.

## Database inspection and migrations

Database commands use `FINANCES_DATABASE_PATH` and require the same environment
configuration as the backend. Inspecting is read-only: it validates the required
legacy schema and reports table counts, foreign-key violations, journal mode, and
financial aggregates without enablingf WAL on the inspected file.

```sh
pixi run finances db inspect
```

To initialize a fresh database, point `FINANCES_DATABASE_PATH` at a new file in
an existing writable directory and upgrade it directly:

```sh
export FINANCES_DATABASE_PATH=/absolute/path/to/new-db.sqlite3
pixi run finances db upgrade
pixi run finances db status
```

To adopt an existing Django database, stop every application process first and
make a verified database backup as described in
[`docs/legacy-baseline.md`](docs/legacy-baseline.md). Then inspect, stamp the
verified legacy schema without recreating its tables, and apply forward
migrations:

```sh
export FINANCES_DATABASE_PATH=/absolute/path/to/copied-db.sqlite3
pixi run finances db inspect
pixi run finances db bootstrap-existing
pixi run finances db upgrade
pixi run finances db status
```

`bootstrap-existing` refuses incompatible columns, constraints, indexes,
foreign-key violations, and any existing Alembic version table. `db upgrade`
also refuses to treat an uninitialized non-empty database as fresh. Both adoption
and upgrades enable SQLite foreign keys, WAL mode, and a five-second busy timeout.
All Django support and obsolete tables remain untouched for rollback.

The lower-level Alembic interface remains available for diagnostics and revision
authoring:

```sh
pixi run alembic -- current
pixi run alembic -- check
```

## CLI

The `finances` CLI is the supported operational interface for the new backend.
Use its help output as the current command reference:

```sh
pixi run finances --help
pixi run finances db --help
pixi run finances users --help
pixi run finances accounts --help
pixi run finances depots --help
pixi run finances assets --help
pixi run finances asset-transactions --help
```

`finances db inspect` is read-only. `bootstrap-existing` is a one-time action
for a verified, pre-Alembic Django database; use `db upgrade` for every normal
forward migration. User-management commands prompt for destructive actions or
passwords where appropriate.

## Backups and restore

Take a verified, timestamped backup of both the SQLite database and media before
every deployment or migration. Stop the application before copying either data
set; SQLite WAL and SHM sidecars are application data, not repository files.
The detailed, verified backup and restore procedure is in
[docs/legacy-baseline.md](docs/legacy-baseline.md#backup-restore-and-recovery).

Restores are maintenance operations: stop the app, verify the chosen backup,
move the current database, WAL/SHM sidecars, and media aside, restore both
artifacts, verify the database and archive, then start and validate the app.
Keep the moved state until a new verified recovery point exists.

## Deployment

The production image builds the React bundle with Bun and the backend with Pixi,
then runs one Uvicorn worker. It serves API, health, and docs routes before the
SPA fallback; `index.html` is not cached while hashed frontend assets are cached
immutably. It mounts persistent database and media storage at `/data`.

Use the stopped-app migration procedure, deployment environment contract,
backup/restore commands, and rollback guidance in
[docs/deployment.md](docs/deployment.md). The pre-production rehearsal remains
an operational task and is tracked separately in
[docs/migration-rehearsal.md](docs/migration-rehearsal.md).

Quality commands:

```sh
pixi run lint
pixi run format-check
pixi run backend-typecheck
pixi run frontend-typecheck
pixi run frontend-build
pixi run lefthook run pre-commit
```

After changing `pixi.toml`, run `pixi lock`. After changing
`frontend/package.json`, run `pixi run bun install` from `frontend/` and commit
`frontend/bun.lock` with the package metadata.

## Legacy rollback environment

The `legacy` Pixi environment keeps Python 3.11 and the exact Django dependency
versions captured before migration. Install and use it explicitly for rollback
checks:

```sh
pixi install --locked -e legacy
pixi run -e legacy legacy-check
pixi run -e legacy legacy-test
pixi run -e legacy legacy-migrate
pixi run -e legacy legacy-dev
pixi run -e legacy legacy-web
```

The pre-migration Django runtime, workflows, schema, aggregate data checks, and
recovery procedure are recorded in [docs/legacy-baseline.md](docs/legacy-baseline.md).
