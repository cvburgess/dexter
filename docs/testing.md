# Testing

## App (`/src`)

- **Jest** with **jest-expo** preset (`jest.config.js` in `/src`)
- Run: `cd src && npm test`
- CI runs `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm test` on every `src/**` PR (`.github/workflows/test-frontend.yml`)
- Tests live in `__tests__/` directories; paths under `app/` are excluded in Jest config so Expo Router does not pick up test files as routes.
- **Pulling a real component into a `jest.mock` factory:** factories are hoisted above imports, so they can't reference an imported `View`/`Text`. Prefer `jest.requireActual<typeof import("react-native")>("react-native")` over a bare `require()` — it keeps the mock typed, which the bare form does not. See `components/__tests__/AppNav.test.tsx`.
- **Test files run a relaxed ESLint rule set** — the test-file override in `src/eslint.config.js` is the source of truth for which rules and why. Only the untypeable Jest boundaries are off (`no-unsafe-*`, `no-require-imports`); everything else is enforced, so give stub components a **named function** (`Stack.Screen = function StackScreen() { … }`) for `react/display-name`, name mock components in **PascalCase** if they use hooks, and use `() => Promise.resolve(x)` rather than `async () => x` for stubs with nothing to await. Prefer typed mocks anyway — the relaxation is for boilerplate, not licence to skip types where they're available.
- **Mocking a module-scope constant** (rather than a hook) needs a **getter in the factory**. `jest.mock` factories are hoisted above the imports and run while the module graph is still initialising, so the obvious `jest.mock("@/utils/deviceType", () => mockDeviceType)` throws a TDZ `ReferenceError` before any test runs. Returning a plain object with a getter defers the read to render time instead:

  ```tsx
  let mockIsTablet = false;
  jest.mock("@/utils/deviceType", () => ({
    get IS_TABLET() {
      return mockIsTablet;
    },
  }));
  ```

  with `beforeEach(() => { mockIsTablet = false; })`. This works because Babel compiles `import { IS_TABLET }` to a property access at each use site to preserve live bindings, so every render re-reads the getter — which also means the consumer has to read the constant *inside* its component, not destructure it at module scope. The `mock` name prefix is what `babel-plugin-jest-hoist` allows through its out-of-scope check. See `__tests__/tabsLayout.test.tsx`. Note that `IS_TABLET` is `false` unmocked (jest-expo defaults to iOS with no `interfaceIdiom`), so the phone path is the free default everywhere else.
- **Web-only components:** import the platform file directly (`import { X } from "../X.web"`) instead of mocking `Platform.OS` — Jest resolves the extension-less path to the native variant. Same for a web route layout: `import Layout from "@/app/.../_layout.web"`.
- **A wholesale `jest.mock("expo-router", …)` must supply `useFocusEffect`** if anything the screen renders uses it — `components/DismissModal` does, so every modal screen that can resolve a missing record needs it. Stand in for the focus lifecycle with `useEffect(() => effect(), [effect])`, and hold the effect behind a `mockIsFocused` flag when a test needs the screen backgrounded. See `__tests__/edit-task/editTaskScreen.test.tsx` and `hooks/__tests__/useViewedDay.test.tsx`.
- **Gestures and animations** (`react-native-gesture-handler`, `react-native-reanimated`): `jest.setup.js` loads `react-native-gesture-handler/jestSetup` and mocks `react-native-reanimated` with its shipped `/mock`; `jest.config.js` sets `resolver: "react-native-worklets/jest/resolver"` (required for reanimated 4's worklets runtime under Jest). Drive a `Gesture.Pan`/etc. in tests with `fireGestureHandler(getByGestureTestId(id), [...])` from `react-native-gesture-handler/jest-utils` (the gesture needs `.withTestId(id)`), wrapped in `act()` from `@testing-library/react-native` if the handler triggers a state update — see `components/__tests__/SwipeablePage.test.tsx`. **The shipped mock is incomplete in two ways worth knowing.** It omits `useReducedMotion` outright (its source has the hook stubbed out as `// useReducedMotion: ADD ME IF NEEDED`), so a component guarding an animation on it throws in every test that mounts it — `jest.setup.js` therefore spreads the mock and adds `useReducedMotion: () => false`, which is the motion-allowed branch; a test that wants the reduced path re-mocks the hook for itself. And its `interpolateColor` is a no-op returning `undefined`, so an animated `backgroundColor` never reaches a rendered tree: assert on structure in the component test and pin the color math where it is computed instead (DEX-128 does this with `sentimentTints` in `utils/__tests__/theme.test.ts`).

  **The larger blind spot is the worklet boundary, and no test in this suite can see it.** The mock replaces `useAnimatedStyle` with something that never runs its body on a UI runtime, so a worklet that calls a plain module-level function — legal-looking TypeScript, and green in Jest, lint and `tsc` alike — throws *Tried to synchronously call a Remote Function* the instant it runs on device. Only values and shared values cross that boundary; resolve helper calls outside the worklet and let it capture the result. DEX-128 shipped this bug and found it by running the app. Treat any animation work as unverified until it has been on a device, whatever the suite says.
- **Drag and drop** (`react-native-drax`, DEX-77): `jest.setup.js` stubs `DraxProvider`/`DraxView` as pass-through `View`s and `DraxScrollView` as a real `ScrollView` (so `WeekView`'s ref/`onLayout` anchoring survives). The real provider throws under `react-native-reanimated/mock`, which doesn't implement the shared values drax hit-tests through. Drive a drop by finding the target's `testID` and invoking its `onReceiveDragDrop`/`acceptsDrag` prop directly, rather than simulating a pointer path.

  **Know what this stub cannot catch.** Drax calls handlers off its own registry snapshot, which it refreshes only when a capability prop changes; a pass-through `View` calls whatever prop is current. So a drop handler that has gone stale still passes if a test reads it off the element — which is exactly how PR #73 shipped a Today pane that scheduled onto whichever day it first mounted with. To guard it, **capture the handler, rerender, then invoke the captured one**; see the "handlers held from an earlier render" block in `components/__tests__/TaskDropTarget.test.tsx`. Worth checking such a guard actually fails against the naive implementation before trusting it.
- **The native `ConfirmationModal` renders nothing** — it drives `Alert.alert` imperatively — so a confirmation flow is asserted through `jest.spyOn(Alert, "alert")` and its captured buttons, not by querying for text. Jest here sets neither `restoreMocks` nor `resetMocks`, so **restore the spy in an `afterEach`**: one left in place leaks into every later test in the run. See the alarm-prompt block in `components/__tests__/TaskDrawer.test.tsx`.
- **A test that imports a web overlay must mock `react-dom`'s `createPortal`.** Every web overlay renders through `components/WebOverlay.web.tsx`, which portals into `document.body`; the suite runs on react-test-renderer, which has no DOM to portal into and drops the children silently — so the overlay renders and every query for its contents comes back empty. Use the shared factory: `jest.mock("react-dom", () => require("@/testUtils/mockReactDomPortal").mockReactDomPortal())`, which stands `createPortal` down to rendering its children inline. Only files importing a `.web` overlay directly need it; `Platform.OS` is `ios` under jest-expo, so an extension-less import resolves to the native variant. Note the ceiling: these tests can prove an overlay renders and fires its handlers, but not that a click lands under a real vaul dialog — there is no vaul in the tree and no web e2e harness, so that half is manual (DEX-134).
- **Never leave a mocked mutation on a promise that never settles.** It wedges the whole Jest run rather than failing its own test, which makes it expensive to track down.

## Supabase (`/supabase`)

- **Deno test** for Edge Function and shared Deno modules
- When `__tests__/` exists: `cd supabase && deno test --allow-all --config __tests__/deno.json __tests__/`
- Add `--env-file=.env` if tests need environment variables
- CI has **no Postgres and no network**, which shapes two conventions:
  - Migrations are tested by asserting over their SQL *text* — see
    `__tests__/migrations/sqlStatements.ts` for the `statements()` /
    `withoutComments()` helpers. Use `withoutComments()` for anything spanning a
    `do $$ … $$` block, and for any assertion a header comment could satisfy on
    its own.
  - Anything that reaches the network takes its dependency as an argument rather
    than stubbing a global: `fetchPrediction(sign, key, fetchImpl)`, and a
    trailing `model` parameter on AI SDK calls.
    `__tests__/helpers/mockLanguageModel.ts` is the `LanguageModelV3` stand-in
    (the SDK's own `ai/test` imports vitest and msw at module load and cannot run
    under `deno test`); `objectModel(x)` is the shortcut for a model that returns
    `x` as its structured output.

## Formatting

- **TypeScript/JavaScript (app):** `cd src && npm run format` (Prettier)
- **Deno (supabase):** `cd supabase && deno fmt`
