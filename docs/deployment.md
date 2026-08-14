# Deployment

## Runtime contract

The production image builds `frontend/dist`, installs the locked backend Pixi
environment, and serves both through one Uvicorn worker as uid/gid `10001` on
port `8000`. One worker is intentional because SQLite has a single-writer model.

Mount one durable host directory or named volume at `/data`:

| Container path | Purpose |
| --- | --- |
| `/data/db.sqlite3` | SQLite database and its WAL/SHM sidecars while running |
| `/data/media` | Uploaded and imported files |

For a bind mount, create the directories with ownership `10001:10001` before the
first start. The required runtime values are `FINANCES_SESSION_SECRET` and
`FINANCES_ALLOWED_HOSTS`; the image defaults the database and media to `/data`,
secure cookies on, and development logging off.

Keep TLS termination and the public hostname in a reverse proxy. Publish the
container only to that proxy.

## Build and start

The Pixi lock contains `linux-64`, so build an AMD64 image explicitly from Apple
Silicon until Linux ARM is added to the platform matrix:

```sh
finances_image=finances:2026-08-14
docker buildx build --platform linux/amd64 --tag "$finances_image" --load .
```

For a new empty deployment, initialize the mounted database while stopped:

```sh
docker run --rm \
  -e FINANCES_SESSION_SECRET='replace-with-a-32-character-secret' \
  -e FINANCES_ALLOWED_HOSTS='["finances.example.com"]' \
  -v /srv/finances/data:/data \
  "$finances_image" finances db upgrade
```

An existing pre-Alembic production database must instead follow
[production-data-migration.md](production-data-migration.md).

Start the service only after migrations complete:

```sh
docker run --detach --name finances --restart unless-stopped \
  --publish 127.0.0.1:8000:8000 \
  -e FINANCES_SESSION_SECRET='replace-with-a-32-character-secret' \
  -e FINANCES_ALLOWED_HOSTS='["finances.example.com"]' \
  -v /srv/finances/data:/data \
  "$finances_image"
```

The image health check calls `/health`. Verify `/health`, `/docs`, a protected
API route, a hashed asset, and a direct SPA route through the proxy.

## Updates and recovery

Every schema upgrade is a stopped-application maintenance operation:

1. Stop the running container.
2. Create and verify a paired database/media backup using the production-data
   runbook.
3. Run the candidate image's `finances db status`, `upgrade`, and `status` against
   the durable mount.
4. Start the candidate and complete the critical smoke checks.

If an upgrade or smoke check fails, keep the service stopped and restore the
paired recovery point. Do not run production downgrade migrations. Retain the
previous image and recovery point until the release is validated.

`Procfile` contains only the modern web process for process-platform deployments.
It intentionally has no release migration command.
