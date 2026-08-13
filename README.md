# finance-website

Small django project for my private finances. Nothing special, I just was not happy with the finance tools on the market and decided to build my own customized tool :-)

The website provides functionality for managing multiple bank accounts, e.g. keeping track of transactions by uploading csv exports of the bank transfers and plotting spendings and incomes by categories.

This project is not really intended for public use since it is custom made for my own needs (e.g. the csv to transactions parsing and the initialization of category keywords).

Feel free to steal any code you like 👍

## Development

This project uses [Pixi](https://pixi.sh) to manage its Python environment. Install
Pixi, then run the application directly; Pixi creates the locked environment on
first use.

```sh
pixi run dev
```

Useful commands:

```sh
pixi run migrate
pixi run check
pixi run test
pixi run lint
pixi run format-check
```

After changing dependencies, regenerate the committed lockfile with `pixi install`.
Use `pixi install --locked` in automation to ensure it matches `pyproject.toml`.

## Dokku deployment

The root `Dockerfile` provides the Pixi runtime for Dokku. Configure the app to
use it (the configured remote names the app `julia-finances`):

```sh
dokku builder-dockerfile:set julia-finances dockerfile-path Dockerfile
```

Production settings are intentionally not committed. The existing
`settings_prod` module must remain available at `/hetzner` in both the release
and web containers, for example through the existing Dokku storage mount. The
`Procfile` preserves `PYTHONPATH=/hetzner` and
`DJANGO_SETTINGS_MODULE=settings_prod` for this purpose. Verify that mount
before deploying; the release process runs migrations through Pixi.
