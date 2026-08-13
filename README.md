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
pixi run hooks-install
pixi run dev
```

The hook installation is needed once after cloning. Lefthook then runs the
repository-pinned checks against staged files before each commit.

Useful commands:

```sh
pixi run migrate
pixi run check
pixi run test
pixi run lint
pixi run format-check
pixi run lefthook run pre-commit
```

After changing dependencies in `pixi.toml`, regenerate the committed lockfile with
`pixi lock`. Use `pixi install --locked` in automation to ensure the lockfile
matches `pixi.toml`.
