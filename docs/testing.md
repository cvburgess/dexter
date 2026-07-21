# Testing

## App (`/src`)

- **Jest** with **jest-expo** preset (`jest.config.js` in `/src`)
- Run: `cd src && npm test`
- Tests live in `__tests__/` directories; paths under `app/` are excluded in Jest config so Expo Router does not pick up test files as routes.
- **Gestures and animations** (`react-native-gesture-handler`, `react-native-reanimated`): `jest.setup.js` loads `react-native-gesture-handler/jestSetup` and mocks `react-native-reanimated` with its shipped `/mock`; `jest.config.js` sets `resolver: "react-native-worklets/jest/resolver"` (required for reanimated 4's worklets runtime under Jest). Drive a `Gesture.Pan`/etc. in tests with `fireGestureHandler(getByGestureTestId(id), [...])` from `react-native-gesture-handler/jest-utils` (the gesture needs `.withTestId(id)`), wrapped in `act()` from `@testing-library/react-native` if the handler triggers a state update — see `components/__tests__/SwipeableDay.test.tsx`.
- **Drag and drop** (`react-native-drax`): `jest.setup.js` stubs `DraxProvider`/`DraxView` to pass-through `View`s. drax drives hit-testing through Reanimated shared values (`spatialIndexSV.modify`) that the reanimated mock above doesn't implement, so mounting the real provider throws. Both stubs render their children and forward their props, so a test drives a drop by finding the target (`testID="tasks-drop-target"`) and invoking its `onReceiveDragDrop` directly rather than simulating a pointer path — see `__tests__/today/todayScreen.test.tsx`.
- **Spies must be restored explicitly.** `jest.config.js` sets neither `restoreMocks` nor `resetMocks`, and the common `beforeEach(() => jest.clearAllMocks())` only wipes call records — a `jest.spyOn(...).mockImplementation(...)` otherwise leaks its implementation into every later test in the file. Add `afterEach(() => jest.restoreAllMocks())` to any suite that spies (module factory mocks from `jest.mock` are unaffected).
- **Never leave a mutation pending.** A mocked mutation that returns a never-settling promise (used to inspect an optimistic cache write mid-flight) wedges the whole run, not just its test. Keep the resolver and release it in `afterEach` — see the `holdUpdate` helper in `hooks/__tests__/useTasks.test.tsx`.

## Supabase (`/supabase`)

- **Deno test** for Edge Function and shared Deno modules
- When `__tests__/` exists: `cd supabase && deno test --allow-all --config __tests__/deno.json __tests__/`
- Add `--env-file=.env` if tests need environment variables

## Formatting

- **TypeScript/JavaScript (app):** `cd src && npm run format` (Prettier)
- **Deno (supabase):** `cd supabase && deno fmt`
