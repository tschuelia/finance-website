# Finances

Private finance application built with FastAPI, React, SQLite, and Pixi. It
manages bank accounts, CSV transaction imports, categories, contracts, depots,
and financial analytics.

## Development

Install the locked backend/tooling environment, frontend dependencies, and Git
hooks after cloning:

```sh
pixi install --locked
pixi run frontend-install
pixi run hooks-install
```

The backend requires a session secret with at least 32 characters. Start the
FastAPI and Vite development servers together with:

```sh
export FINANCES_SESSION_SECRET='replace-with-a-random-secret-of-32-or-more-characters'
pixi run dev
```

Use `pixi run backend-dev` and `pixi run frontend-dev` in separate terminals when
preferred. Vite proxies `/api` to `http://127.0.0.1:8000` by default; set
`VITE_API_PROXY_TARGET` only when the backend listens elsewhere.

Configuration comes exclusively from process environment variables.
`.env.example` documents the complete contract and is not loaded automatically.
Local defaults use `db.sqlite3`, `media/`, insecure cookies, a 14-day session
lifetime, localhost/test hosts, and development logging.

To serve a production frontend build locally:

```sh
pixi run frontend-build
pixi run backend-serve
```

## Database inspection and migrations

Database commands use `FINANCES_DATABASE_PATH`. Inspection is read-only and
reports schema compatibility, table counts, foreign-key violations, journal
mode, and financial aggregates:

```sh
pixi run finances db inspect
```

Initialize a fresh database by pointing at a new file in an existing writable
directory and applying the Alembic history:

```sh
export FINANCES_DATABASE_PATH=/absolute/path/to/new-db.sqlite3
pixi run finances db upgrade
pixi run finances db status
```

An existing production database created by the previous Django application must
be inspected, adopted at the protected baseline, and upgraded exactly once:

```sh
export FINANCES_DATABASE_PATH=/absolute/path/to/copied-db.sqlite3
pixi run finances db inspect
pixi run finances db bootstrap-existing
pixi run finances db upgrade
pixi run finances db status
```

`bootstrap-existing` rejects incompatible columns, constraints, indexes,
foreign-key violations, and unexpected Alembic state. `db upgrade` refuses to
treat an uninitialized non-empty database as fresh. Unmanaged historical support
tables are preserved. The complete stopped-application procedure is in
[docs/production-data-migration.md](docs/production-data-migration.md).

The lower-level Alembic interface remains available for diagnostics and revision
authoring:

```sh
pixi run alembic -- current
pixi run alembic -- check
```

## Management CLI

The `finances` CLI replaces application-admin operations:

```sh
pixi run finances --help
pixi run finances users --help
pixi run finances accounts --help
pixi run finances depots --help
pixi run finances assets --help
pixi run finances asset-transactions --help
```

New and reset passwords use Argon2id. Existing Django PBKDF2 hashes remain valid
and are replaced with Argon2id atomically after the user's next successful login.

## Backups and deployment

Back up the SQLite database and complete media directory as one recovery point
before every deployment or migration. Stop the application first, include any
SQLite WAL/SHM sidecars in the state being protected, verify checksums and SQLite
integrity, and retain the prior state until the replacement is validated. See
[docs/production-data-migration.md](docs/production-data-migration.md) for the
first adoption and [docs/deployment.md](docs/deployment.md) for normal releases.

The production image builds the React bundle with Bun, installs the locked
backend environment with Pixi, and runs one Uvicorn worker. It serves the API,
health endpoint, documentation, authenticated files, and SPA from one origin.
Persistent database and media storage is mounted at `/data`.

## Quality checks

```sh
pixi run lint
pixi run format-check
pixi run frontend-knip
pixi run backend-typecheck
pixi run frontend-typecheck
pixi run frontend-build
pixi run lefthook run pre-commit
```

After changing `pixi.toml`, run `pixi lock`. After changing
`frontend/package.json`, run `pixi run bun install` from `frontend/` and commit
`frontend/bun.lock` with the manifest.
