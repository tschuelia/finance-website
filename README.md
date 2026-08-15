# Finances

Private finance application built with FastAPI, React, SQLite, and Pixi. It
manages bank accounts, CSV transaction imports, categories, contracts, depots,
and financial analytics.

## Development

Set up the project after cloning:

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

## Database inspection and initialization

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

The lower-level Alembic interface remains available for diagnostics and revision
authoring:

```sh
pixi run alembic -- current
pixi run alembic -- check
```

## Management CLI

Use the `finances` CLI to manage application data:

```sh
pixi run finances --help
pixi run finances users --help
pixi run finances accounts --help
pixi run finances depots --help
pixi run finances assets --help
pixi run finances asset-transactions --help
pixi run finances sessions --help
pixi run finances contract-files reconcile
```

## Quality checks

```sh
pixi run lint
pixi run format-check
pixi run frontend-knip
pixi run backend-typecheck
pixi run frontend-typecheck
pixi run backend-test
pixi run frontend-build
pixi run lefthook run pre-commit
```
