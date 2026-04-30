# Marketing website

The public marketing site for Dexter is **not** built from the `cvburgess/dexter` monorepo.

## Canonical repository

- **GitHub:** [cvburgess/dexter-www](https://github.com/cvburgess/dexter-www) (`main`)

## Production URL

- **https://dexterplanner.com**

## Stack (in dexter-www)

The marketing site uses **Lume** (Deno static site generator), **Vento** templates, and **Tailwind CSS** (see that repo for exact versions and plugins). Build and serve commands are defined there (typically `deno task serve` and `deno task build`).

## Editing policy for this monorepo

**Do not** add a parallel Lume `/www` tree here unless the team explicitly merges marketing into this repository. Website issues and PRs belong in **dexter-www**.
