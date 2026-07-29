# Testing

## App (`/src`)

- **Jest** with **jest-expo** preset (`jest.config.js` in `/src`)
- Run: `cd src && npm test`
- CI runs `npm run lint`, `npm run typecheck`, and `npm test` on every `src/**` PR (`.github/workflows/test-frontend.yml`)
- Tests live in `__tests__/` directories; paths under `app/` are excluded in Jest config so Expo Router does not pick up test files as routes.
- **Pulling a real component into a `jest.mock` factory:** factories are hoisted above imports, so they can't reference an imported `View`/`Text`. Prefer `jest.requireActual<typeof import("react-native")>("react-native")` over a bare `require()` — it keeps the mock typed, which the bare form does not. See `components/__tests__/WebNav.test.tsx`.
- **Test files run a relaxed ESLint rule set** (the last block in `src/eslint.config.js`, matching `**/__tests__/**`, `*.test.ts(x)`, `testUtils/`, and `jest.setup.js`). Jest mocks are untyped by construction — a hoisted factory must `require`, mocked module shapes come back as `any`, and mock components are inline arrows that sometimes use hooks — so the `no-unsafe-*` family, `no-require-imports`, `require-await`, `react/display-name`, and `react-hooks/rules-of-hooks` are off there. Rules that catch real mistakes in tests (`no-unused-vars`, `import/no-duplicates`, `no-misused-promises`) stay on. Prefer typed mocks anyway; the relaxation exists so the boilerplate doesn't need a cast at every call site, not as licence to skip types where they're available.
- **Web-only components:** import the platform file directly (`import { X } from "../X.web"`) instead of mocking `Platform.OS` — Jest resolves the extension-less path to the native variant. Same for a web route layout: `import Layout from "@/app/.../_layout.web"`.
- **Gestures and animations** (`react-native-gesture-handler`, `react-native-reanimated`): `jest.setup.js` loads `react-native-gesture-handler/jestSetup` and mocks `react-native-reanimated` with its shipped `/mock`; `jest.config.js` sets `resolver: "react-native-worklets/jest/resolver"` (required for reanimated 4's worklets runtime under Jest). Drive a `Gesture.Pan`/etc. in tests with `fireGestureHandler(getByGestureTestId(id), [...])` from `react-native-gesture-handler/jest-utils` (the gesture needs `.withTestId(id)`), wrapped in `act()` from `@testing-library/react-native` if the handler triggers a state update — see `components/__tests__/SwipeableDay.test.tsx`.

## Supabase (`/supabase`)

- **Deno test** for Edge Function and shared Deno modules
- When `__tests__/` exists: `cd supabase && deno test --allow-all --config __tests__/deno.json __tests__/`
- Add `--env-file=.env` if tests need environment variables

## Formatting

- **TypeScript/JavaScript (app):** `cd src && npm run format` (Prettier)
- **Deno (supabase):** `cd supabase && deno fmt`
