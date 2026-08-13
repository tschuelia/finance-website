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

The frontend can be started with:

```sh
pixi run frontend-dev
```

The FastAPI backend requires a session secret with at least 32 characters. It
checks the database and media paths during startup and then exposes its health
endpoint at `http://127.0.0.1:8000/health`:

```sh
export FINANCES_SESSION_SECRET='replace-with-a-random-secret-of-32-or-more-characters'
pixi run backend-dev
```

Configuration is read from process environment variables only. `.env.example`
documents the complete contract but is not loaded automatically. Local
development defaults to `db.sqlite3`, `media/`, insecure cookies, a 14-day
session lifetime, localhost/test hosts, and development logging. Override the
corresponding `FINANCES_*` values for production, especially
`FINANCES_DATABASE_PATH`, `FINANCES_MEDIA_ROOT`, `FINANCES_COOKIE_SECURE`,
`FINANCES_ALLOWED_HOSTS`, and `FINANCES_DEVELOPMENT_LOGGING`.

The Alembic command surface becomes runnable when issue 05 adds its migration
entrypoint:

```sh
pixi run alembic -- current
```

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
