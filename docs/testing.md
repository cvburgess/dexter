# Testing

## App (`/src`)

- **Jest** with **jest-expo** preset (`jest.config.js` in `/src`)
- Run: `cd src && npm test`
- CI runs `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm test` on every `src/**` PR (`.github/workflows/test-frontend.yml`)
- Tests live in `__tests__/` directories; paths under `app/` are excluded in Jest config so Expo Router does not pick up test files as routes.
- **Pulling a real component into a `jest.mock` factory:** factories are hoisted above imports, so they can't reference an imported `View`/`Text`. Prefer `jest.requireActual<typeof import("react-native")>("react-native")` over a bare `require()` — it keeps the mock typed, which the bare form does not. See `components/__tests__/WebNav.test.tsx`.
- **Test files run a relaxed ESLint rule set** — the test-file override in `src/eslint.config.js` is the source of truth for which rules and why. Only the untypeable Jest boundaries are off (`no-unsafe-*`, `no-require-imports`); everything else is enforced, so give stub components a **named function** (`Stack.Screen = function StackScreen() { … }`) for `react/display-name`, name mock components in **PascalCase** if they use hooks, and use `() => Promise.resolve(x)` rather than `async () => x` for stubs with nothing to await. Prefer typed mocks anyway — the relaxation is for boilerplate, not licence to skip types where they're available.
- **Web-only components:** import the platform file directly (`import { X } from "../X.web"`) instead of mocking `Platform.OS` — Jest resolves the extension-less path to the native variant. Same for a web route layout: `import Layout from "@/app/.../_layout.web"`.
- **A wholesale `jest.mock("expo-router", …)` must supply `useFocusEffect`** if anything the screen renders uses it — `components/DismissModal` does, so every modal screen that can resolve a missing record needs it. Stand in for the focus lifecycle with `useEffect(() => effect(), [effect])`, and hold the effect behind a `mockIsFocused` flag when a test needs the screen backgrounded. See `__tests__/edit-task/editTaskScreen.test.tsx` and `hooks/__tests__/useViewedDay.test.tsx`.
- **Gestures and animations** (`react-native-gesture-handler`, `react-native-reanimated`): `jest.setup.js` loads `react-native-gesture-handler/jestSetup` and mocks `react-native-reanimated` with its shipped `/mock`; `jest.config.js` sets `resolver: "react-native-worklets/jest/resolver"` (required for reanimated 4's worklets runtime under Jest). Drive a `Gesture.Pan`/etc. in tests with `fireGestureHandler(getByGestureTestId(id), [...])` from `react-native-gesture-handler/jest-utils` (the gesture needs `.withTestId(id)`), wrapped in `act()` from `@testing-library/react-native` if the handler triggers a state update — see `components/__tests__/SwipeableDay.test.tsx`.

## Supabase (`/supabase`)

- **Deno test** for Edge Function and shared Deno modules
- When `__tests__/` exists: `cd supabase && deno test --allow-all --config __tests__/deno.json __tests__/`
- Add `--env-file=.env` if tests need environment variables

## Formatting

- **TypeScript/JavaScript (app):** `cd src && npm run format` (Prettier)
- **Deno (supabase):** `cd supabase && deno fmt`
