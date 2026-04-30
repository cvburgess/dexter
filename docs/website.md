# Marketing Website

The public marketing site for Dexter is built from [`www/`](../www) in the `cvburgess/dexter` monorepo and deploys to **https://dexterplanner.com**.

## Stack

The site uses **Lume** (Deno static site generator), **Vento** templates, and **Tailwind CSS**.

Important paths:

- `www/_config.ts` — Lume configuration
- `www/deno.json` — Deno imports and tasks
- `www/src/` — site pages, templates, data, CSS, and assets
- `www/netlify.toml` — Netlify build configuration
- `www/netlify/functions/rebuild.ts` — scheduled Netlify rebuild function

Generated output goes to `www/_site/` and local cache files go to `www/_cache/`; both are ignored.

## Local Commands

Run website commands from `www/`:

```bash
cd www
deno task serve
deno task build
```

`deno task serve` starts the local Lume dev server. `deno task build` writes the static site to `www/_site/`.

## Deployment

Netlify should build the `cvburgess/dexter` monorepo with `www` as the base directory. The website's `www/netlify.toml` publishes `_site` and runs `deno task build` after installing Deno in the Netlify build image.

The scheduled rebuild function reads the `REBUILD_URL` environment variable. Keep that secret configured in Netlify, not in this repository.

## Legacy Repository

The former standalone `cvburgess/dexter-www` repository is deprecated. New marketing-site changes belong in `www/` in this monorepo.
