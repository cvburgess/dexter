# App (`/src`)

The Dexter app is built with [Expo](https://docs.expo.dev/) (React Native) and [Expo Router](https://docs.expo.dev/router/introduction/) for file-based navigation. Targets **iOS**, **Android**, and **web**.

## Layout

- `app/` — Expo Router routes
- `components/` — Shared UI (add as the app grows)
- `hooks/` — Custom hooks (optional)
- `utils/` — Helpers (optional)
- `types/` — TypeScript types (optional)

Place tests in `__tests__/` next to source files. **Do not** put `*.test.ts(x)` under `app/` (phantom routes).

## Navigation

The route tree is grouped so authenticated screens sit behind an auth boundary:

```
app/
  _layout.tsx              # Providers (QueryProvider + AuthProvider) + a headerless root Stack
  index.tsx                # Redirects to the default tab (/(app)/(tabs)/today)
  (app)/
    _layout.tsx            # Stack for the authenticated group
    (tabs)/
      _layout.tsx          # Expo Router native tabs (expo-router/unstable-native-tabs)
      today/               # "Today" tab — sun icon
      settings/            # "Settings" tab — gear icon
```

Tabs use **native tabs** (`NativeTabs` from `expo-router/unstable-native-tabs`), so they render with the platform tab bar. Icons are set per platform on `NativeTabs.Trigger.Icon` via `sf` (iOS SF Symbol) and `md` (Android Material) — no vector-icon dependency. Native tabs require a dev client / native build (they do **not** appear in Expo Go); web has its own implementation.

Each tab is its own folder with a nested `_layout.tsx` Stack (headers/titles, room for pushed detail screens) and an `index.tsx` screen. An `(auth)` group and auth-gating on `app/index.tsx` and `(app)/_layout.tsx` (via `useAuth`) will be added in a later issue.

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

### EAS builds (development client)

Native development uses an [EAS](https://docs.expo.dev/eas/)-built [development client](https://docs.expo.dev/develop/development-builds/introduction/) rather than Expo Go. Build profiles are defined in `src/eas.json` (`development`, `simulator`, `e2e-test`, `preview`, `production`), and `expo-dev-client` is a dependency.

```bash
npm run dev:simulator   # eas build --platform ios --profile simulator (iOS Simulator)
npm run dev:ios         # eas build --platform ios --profile development (on-device)
npm run dev:android     # eas build --platform android --profile development
```

The EAS project is wired up via `extra.eas.projectId` and `owner` in `app.json`. `appVersionSource` is `remote`, so build/version numbers are managed by EAS.

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
