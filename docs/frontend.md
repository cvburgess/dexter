# App (`/src`)

The Dexter app is built with [Expo](https://docs.expo.dev/) (React Native) and [Expo Router](https://docs.expo.dev/router/introduction/) for file-based navigation. Targets **iOS**, **Android**, and **web**.

## Layout

- `app/` — Expo Router routes
- `components/` — Shared UI (add as the app grows)
- `hooks/` — Custom hooks (optional)
- `utils/` — Helpers (optional)
- `types/` — TypeScript types (optional)

Place tests in `__tests__/` next to source files. **Do not** put `*.test.ts(x)` under `app/` (phantom routes).

## Commands

From repository root:

```bash
cd src
npm install
npm start          # dev server (QR / simulator / press w for web)
npm run web        # web only
npm run ios        # native build + run iOS
npm run android    # native build + run Android
npm run lint       # expo lint
npm run format     # Prettier
npm test           # Jest (jest-expo)
npm run typecheck  # tsc --noEmit
```

## Stack

- **Expo SDK 56** (see `src/package.json` for exact versions)
- **React 19.2** / **React Native 0.85** with **react-native-web** for web
- **React Compiler** enabled via `experiments.reactCompiler` in `app.json`
- **TypeScript 6** — `tsconfig.json` extends `expo/tsconfig.base`
- **ESLint** — `expo lint` (bootstraps `eslint-config-expo` on first run)
- **Web render mode** — `web.output: "single"` (SPA) so the Supabase-backed `AuthProvider` doesn't have to run under Node SSR.

## Environment

Supabase client code reads the public Expo environment variables below from local, uncommitted `.env` files:

```bash
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

Generated Supabase database types live at `src/types/database.types.ts`. Regenerate them from `/src` with:

```bash
npm run supabase:types
```

Uncommitted `.env` / `.env.local` files are normal; never commit secrets.

## Data Layer

- `api/` contains typed Supabase query modules.
- `hooks/` contains React Query hooks and the Expo-compatible `useAuth` provider.
- `utils/` contains data helpers shared by the query layer and hooks.
- `providers/QueryProvider.tsx` exports the React Query provider. Route wiring in `app/` is intentionally separate from the data layer.
