FROM ghcr.io/prefix-dev/pixi:0.45.0

WORKDIR /app

COPY pyproject.toml pixi.lock ./
RUN pixi install --locked

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "PYTHONPATH=/hetzner DJANGO_SETTINGS_MODULE=settings_prod exec pixi run web"]
