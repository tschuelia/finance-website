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

The image also enables `FINANCES_PRODUCTION_MODE=true`. Production mode refuses
to start unless secure cookies are enabled, development logging is disabled, and
the host allow-list does not contain `*`. It disables OpenAPI/Swagger/ReDoc and
adds the application-owned CSP, frame, MIME-sniffing, referrer, permissions,
HSTS, and API `no-store` policies.

Keep TLS termination and the public hostname in a reverse proxy. Publish the
container only to that proxy.

Uvicorn proxy-header processing is deliberately disabled. By default the login
throttle uses the direct peer address. If the reverse proxy and application run
on different peers, set `FINANCES_TRUSTED_PROXY_IPS` to a JSON list of exact IPs
or CIDR networks, for example `["10.20.0.0/24"]`, and configure the proxy to
replace (not append to) `X-Forwarded-For`. The application accepts the first
forwarded address only when the direct peer is in that allow-list; unparseable
values are ignored. Process-local throttling is the supported topology because
the SQLite deployment intentionally uses one application process.

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

The image health check calls the readiness endpoint `/health`, which verifies
database access and the configured media directory. `/health/live` is the
process-only liveness endpoint. In production, verify `/health`, confirm `/docs`
and `/openapi.json` return 404, inspect the documented response headers, then
check a protected API route, a hashed asset, and a direct SPA route through the
proxy.

The application owns all headers listed above. The TLS proxy must preserve them
and may strengthen HSTS for the deployment's domain policy. A verification
example is:

```sh
curl --fail-with-body --include https://finances.example.com/health
curl --fail-with-body --include https://finances.example.com/api/v1/auth/me
```

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
