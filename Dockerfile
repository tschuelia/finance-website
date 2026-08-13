FROM oven/bun:1.3.11 AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile

COPY frontend/ ./
RUN bun run build


FROM ghcr.io/prefix-dev/pixi:0.75.0 AS backend-build

WORKDIR /app

COPY pixi.toml pixi.lock ./
# The local editable backend package must be present while Pixi resolves it.
COPY backend/ ./backend/
RUN pixi install --locked --environment default


FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install --no-install-recommends --yes ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 finances \
    && useradd --create-home --home-dir /app --uid 10001 --gid finances finances

WORKDIR /app

# Keep the installation prefix unchanged: console scripts and the editable
# backend package resolve relative to /app in both build and runtime stages.
COPY --from=backend-build --chown=finances:finances /app/.pixi/envs/default /app/.pixi/envs/default
COPY --from=backend-build --chown=finances:finances /app/backend /app/backend
COPY --from=frontend-build --chown=finances:finances /app/frontend/dist /app/frontend/dist

RUN install -d --owner=finances --group=finances /data/media

ENV PATH="/app/.pixi/envs/default/bin:${PATH}" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend \
    FINANCES_DATABASE_PATH=/data/db.sqlite3 \
    FINANCES_MEDIA_ROOT=/data/media \
    FINANCES_COOKIE_SECURE=true \
    FINANCES_DEVELOPMENT_LOGGING=false

# Mount a durable host or named volume here. A bind mount must already contain
# the media directory before the application starts; startup validates it.
VOLUME ["/data"]

EXPOSE 8000

USER finances

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["python", "-c", "from urllib.request import urlopen; response = urlopen('http://127.0.0.1:8000/health', timeout=3); raise SystemExit(0 if response.status == 200 else 1)"]

# SQLite has a single-writer model, so keep this deliberately to one worker.
CMD ["uvicorn", "app.main:app", "--app-dir", "/app/backend", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
