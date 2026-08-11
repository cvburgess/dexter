# Marketing Website

The public marketing site for Dexter is built from [`www/`](../www) with **Lume** (Deno static site generator), **Vento** templates, and **Tailwind CSS**, and deploys to **https://dexterplanner.com**. Run `deno task serve` / `deno task build` from `www/`; the build writes to `www/_site/` (ignored, like `www/_cache/`).

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

Netlify builds the monorepo with `www` as the base directory; `www/netlify.toml` publishes `_site` and runs `deno task build` after installing Deno in the build image. The scheduled rebuild function reads the `REBUILD_URL` environment variable — keep that secret configured in Netlify, not in this repository.
