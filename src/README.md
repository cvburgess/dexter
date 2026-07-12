# Dexter app

Expo (React Native) + Expo Router. Runs on **iOS**, **Android**, and **web**.

## Setup

```bash
npm install
```

Create a `.env.local` with the Supabase public env vars (uncommitted):

```bash
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

## Commands

| Script                            | Description               |
| --------------------------------- | ------------------------- |
| `npm start`                       | Dev server                |
| `npm run web`                     | Web only                  |
| `npm run ios` / `npm run android` | Open simulator / device   |
| `npm run lint`                    | `expo lint`               |
| `npm run format`                  | Prettier                  |
| `npm test`                        | Jest                      |
| `npm run typecheck`               | `tsc --noEmit`            |
| `npm run supabase:types`          | Regenerate Supabase types |

See [`../docs/frontend.md`](../docs/frontend.md) for conventions.
