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

## Feature card illustrations

`src/_data/features.json` drives the landing page's feature carousel, and each
entry's `slug` is the *only* link to its art: `_components/feature.vto`
interpolates it into `/assets/{slug}-light.svg` and `-dark.svg`. A slug with no
matching pair 404s silently — nothing fails the build — so both files are
required, and both must be 512×340 to match the `<img>`'s intrinsic size.

Two constraints that bite when drawing a new one:

- **Copy the hexes from a neighbouring SVG; do not recompute them from
  `brand.json`.** The illustration palette is an eyeballed Figma copy of the
  app's `dexter` (light) and `dim` (dark) themes, and every value is a few
  points off the real token — `#F5C744` against `priority[0]` `#fcb700`,
  `#2B6550` against `primary` `#00674f`. A correctly-derived color visibly
  clashes with the cards beside it.
- **Text has to be outlined paths.** The cards load the SVGs through `<img
  srcset>`, so no webfont reaches them and `<text>` would fall back to whatever
  the viewer has. Existing runs can be lifted: each text run in these files is a
  single `<path>` whose subpaths split on `M`, so glyphs can be sliced out and
  retranslated. Keep a glyph's counters in the same `<path>` element as its
  outline — separated, the reverse-wound counter fills solid.

## Deployment

Netlify builds the monorepo with `www` as the base directory; `www/netlify.toml` publishes `_site` and runs `deno task build` after installing Deno in the build image. The scheduled rebuild function reads the `REBUILD_URL` environment variable — keep that secret configured in Netlify, not in this repository.
