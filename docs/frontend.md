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
npm install --legacy-peer-deps
npm start          # dev server (QR / simulator / press w for web)
npm run web        # web only
npm run ios        # native build + run iOS
npm run android    # native build + run Android
npm run lint       # ESLint (includes type-aware rules)
npm run format     # Prettier
npm test           # Jest (jest-expo)
```

## Stack

- **Expo SDK 54** (see `src/package.json` for exact versions)
- **React 19** / **React Native** with **react-native-web** for web
- **TypeScript** — `tsconfig.json` extends `expo/tsconfig.base`
- **ESLint** — flat config with `eslint-config-expo` and `typescript-eslint`

## Environment

Copy patterns from team docs when adding Supabase or other clients. Uncommitted `.env` / `.env.local` files are normal; never commit secrets.
