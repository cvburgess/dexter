# Dexter

Monorepo for the Dexter planner product: Expo app (`/src`), Supabase backend (`/supabase`), marketing website (`/www`), and engineering docs (`/docs`).

## Marketing website

The marketing site for **[dexterplanner.com](https://dexterplanner.com)** lives in [`www/`](www/). See [`docs/website.md`](docs/website.md) for local commands and deployment notes.

## Quick start

| Area | Command |
|------|---------|
| App | `cd src && npm install --legacy-peer-deps && npm start` |
| Backend | See [`supabase/README.md`](supabase/README.md) |
| Website | `cd www && deno task serve` |
| Docs | Start with [`docs/frontend.md`](docs/frontend.md) and [`docs/backend.md`](docs/backend.md) |

## Repository

**GitHub:** `cvburgess/dexter`

## License

Dexter is open source under the [MIT License](LICENSE).
