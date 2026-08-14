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

The `finances` CLI replaces application-admin operations:

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

New and reset passwords use Argon2id. Imported Django PBKDF2 hashes remain valid
and are replaced with Argon2id atomically after the user's next successful login.

## Production deployment

The production image builds the React bundle with Bun, installs the locked
backend-only Pixi environment, and serves the application with one Uvicorn
worker. The single worker is intentional for SQLite's single-writer model. The
API, readiness and liveness endpoints, authenticated files, and SPA are served
from one origin; interactive API documentation is disabled in production.

Mount one durable host directory or named volume at `/data`:

| Container path | Purpose |
| --- | --- |
| `/data/db.sqlite3` | SQLite database and its WAL/SHM sidecars while running |
| `/data/media` | Uploaded and imported files |

For a bind mount, create the directory and its `media` child with ownership
`32767:1003` (`dokku-herokuishuser:web`) before the first start.
`FINANCES_SESSION_SECRET` and `FINANCES_ALLOWED_HOSTS` are required. The image
defaults the database and media paths to `/data`, enables secure cookies and
production mode, and disables development logging. Production mode rejects
wildcard hosts or unsafe cookie and logging settings.

The Pixi lock supports `linux-64`, so build an AMD64 image explicitly when the
builder is running on Apple Silicon:

```sh
finances_image=finances:release-tag
docker buildx build --platform linux/amd64 --tag "$finances_image" --load .
```

For a new empty deployment, initialize the mounted database while the service is
stopped, then start the application:

```sh
finances_data=/srv/finances/data
docker run --rm \
  -e FINANCES_SESSION_SECRET='replace-with-a-32-character-secret' \
  -e FINANCES_ALLOWED_HOSTS='["finances.example.com"]' \
  -v "$finances_data:/data" \
  "$finances_image" finances db upgrade

docker run --detach --name finances --restart unless-stopped \
  --publish 127.0.0.1:8000:8000 \
  -e FINANCES_SESSION_SECRET='replace-with-a-32-character-secret' \
  -e FINANCES_ALLOWED_HOSTS='["finances.example.com"]' \
  -v "$finances_data:/data" \
  "$finances_image"
```

Keep TLS termination and the public hostname in a reverse proxy, and publish the
container only to that proxy. Proxy-header processing is disabled by default. If
the proxy and application use different peers, set
`FINANCES_TRUSTED_PROXY_IPS` to an exact JSON list of trusted IPs or CIDRs and
configure the proxy to replace, rather than append to, `X-Forwarded-For`.

The image health check calls `/health`, which verifies database access and the
configured media directory. `/health/live` is the process-only liveness endpoint.
After deployment, verify `/health`, confirm `/docs` and `/openapi.json` return
404, and test login, a protected API route, an authenticated file, a hashed
asset, and a direct SPA route through the proxy.

## Backups, updates, and recovery

Treat the SQLite database and complete media directory as one recovery point.
Before every deployment or schema change, stop the application, create a paired
backup outside the repository, verify its checksums, run SQLite's
`PRAGMA integrity_check`, and verify that the media archive is readable. Retain
the previous image and recovery point until the replacement passes its smoke
checks.

Every schema upgrade is a stopped-application operation. Run the candidate
image's `finances db status`, `finances db upgrade`, and final status against the
durable mount before starting it. If an upgrade or smoke check fails, keep the
service stopped and restore the database and media together. Do not run Alembic
downgrades against production data.

## Dependency maintenance

The Pixi lock covers `osx-arm64` and `linux-64`; adding Linux ARM requires an
explicit platform and lock review. The production `runtime` environment excludes
Bun and development tools. Bun is pinned in `pixi.toml` for both locked
platforms. TypeScript remains at `6.0.3` while the selected
`typescript-eslint` release requires TypeScript below `6.1.0`.

Review available dependency updates and known vulnerabilities with:

```sh
pixi update --dry-run --json --environment default
pixi run bun outdated --cwd frontend
pixi run bun audit --cwd frontend
pixi exec --spec pip-audit --spec filelock \
  pip-audit --path .pixi/envs/runtime/lib/python3.14/site-packages
```

After changing `pixi.toml`, run `pixi lock`. After changing
`frontend/package.json`, run `pixi run bun install` from `frontend/` and commit
`frontend/bun.lock` with the manifest.

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
