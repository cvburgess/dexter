# Testing

## App (`/src`)

- **Jest** with **jest-expo** preset (`jest.config.js` in `/src`)
- Run: `cd src && npm test`
- Tests live in `__tests__/` directories; paths under `app/` are excluded in Jest config so Expo Router does not pick up test files as routes.

## Supabase (`/supabase`)

- **Deno test** for Edge Function and shared Deno modules
- When `__tests__/` exists: `cd supabase && deno test --allow-all --config __tests__/deno.json __tests__/`
- Add `--env-file=.env` if tests need environment variables

## Formatting

- **TypeScript/JavaScript (app):** `cd src && npm run format` (Prettier)
- **Deno (supabase):** `cd supabase && deno fmt`
