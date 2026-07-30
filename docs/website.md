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

## Brand guide (`/brand`)

`src/brand.vto` renders Dexter's design tokens — every theme's palette, the type
scale, spacing, radius, and iconography — at
**[dexterplanner.com/brand](https://dexterplanner.com/brand)**. It reads
`src/_data/brand.json` and draws the swatches from **inline `style` attributes**
rather than daisyUI classes on purpose: the page has to show the *app's* palette,
and the site's own daisyUI variables in `src/index.css` do not currently agree
with it (the app's `dark` primary is indigo; the site's is a light green).

**`src/utils/theme.ts` is canonical, and `brand.json` is a hand-maintained
mirror of it.** Nothing enforces that they agree, so a palette or density change
in the app needs the same edit here. `priorityMuted` is a derived value — each
priority accent composited over that theme's `background` at 80% — so recompute
it rather than eyeballing it. See `docs/design.md` for what each token means.

The page sets `fullBleed: true` in its front matter, which drops the horizontal
margin `layouts/base.vto` puts on `<main>` so its banded sections can run edge to
edge; `layouts/brandSection.vto` carries the inset instead. Every other page is
unaffected.

## Deployment

Netlify should build the `cvburgess/dexter` monorepo with `www` as the base directory. The website's `www/netlify.toml` publishes `_site` and runs `deno task build` after installing Deno in the Netlify build image.

The scheduled rebuild function reads the `REBUILD_URL` environment variable. Keep that secret configured in Netlify, not in this repository.

## Legacy Repository

The former standalone `cvburgess/dexter-www` repository is deprecated. New marketing-site changes belong in `www/` in this monorepo.
