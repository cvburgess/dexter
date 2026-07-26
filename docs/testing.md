# Testing

## App (`/src`)

- **Jest** with **jest-expo** preset (`jest.config.js` in `/src`)
- Run: `cd src && npm test`
- Tests live in `__tests__/` directories; paths under `app/` are excluded in Jest config so Expo Router does not pick up test files as routes.
- **Pulling a real component into a `jest.mock` factory:** factories are hoisted above imports, so they can't reference an imported `View`/`Text`. Use `jest.requireActual<typeof import("react-native")>("react-native")` rather than a bare `require()` — the bare form trips `no-require-imports` and `no-unsafe-assignment`, which goes unnoticed in `__tests__/` directories `npm run lint` doesn't reach (see AGENTS.md's Gotchas). Give stub components a named function so `react/display-name` is satisfied. See `components/__tests__/WebNav.test.tsx`.
- **Web-only components:** import the platform file directly (`import { X } from "../X.web"`) instead of mocking `Platform.OS` — Jest resolves the extension-less path to the native variant. Same for a web route layout: `import Layout from "@/app/.../_layout.web"`.
- **Gestures and animations** (`react-native-gesture-handler`, `react-native-reanimated`): `jest.setup.js` loads `react-native-gesture-handler/jestSetup` and mocks `react-native-reanimated` with its shipped `/mock`; `jest.config.js` sets `resolver: "react-native-worklets/jest/resolver"` (required for reanimated 4's worklets runtime under Jest). Drive a `Gesture.Pan`/etc. in tests with `fireGestureHandler(getByGestureTestId(id), [...])` from `react-native-gesture-handler/jest-utils` (the gesture needs `.withTestId(id)`), wrapped in `act()` from `@testing-library/react-native` if the handler triggers a state update — see `components/__tests__/SwipeableDay.test.tsx`.

## Supabase (`/supabase`)

- **Deno test** for Edge Function and shared Deno modules
- When `__tests__/` exists: `cd supabase && deno test --allow-all --config __tests__/deno.json __tests__/`
- Add `--env-file=.env` if tests need environment variables

## Formatting

- **TypeScript/JavaScript (app):** `cd src && npm run format` (Prettier)
- **Deno (supabase):** `cd supabase && deno fmt`
