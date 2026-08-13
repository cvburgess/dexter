# Testing

## Which tests are worth writing

Write a test when it would catch a real regression:

- **Pure logic** — date math, transforms, parsers, reducers (`src/utils/__tests__/`). No mocks, fast, the highest signal in the repo.
- **Security properties** — SSRF guards, auth/origin checks, secret handling (`supabase/__tests__/ics-proxy/validation.test.ts`, `config/previewSecrets.test.ts`).
- **API contracts** — drive real handler logic through a fake at the boundary; `supabase/__tests__/mcp-server/tools.test.ts`'s registry harness is the pattern.
- **Regressions** — pin a fixed bug and annotate the test with its issue id (`DEX-xxx`) so the guard's reason survives.

Not worth writing (removed en masse in DEX-143 — don't reintroduce):

- **Render-without-crashing / prop-passing** component tests.
- **Styling assertions** — colors, spacing, flex direction, `props.style` reaches. Visual correctness is verified on a device, not in Jest.
- **Mock restatement** — hand-mocking a query builder and asserting `.eq()` was called with what the implementation passed. Assert return values, error propagation, and genuine footguns (an `onConflict` target, a column that must never be written) instead.
- **Migration-text tests** — migrations are immutable once applied, so an assertion over a merged migration's SQL can never fail again.
- **Re-asserting shared behavior per screen** — behavior owned by a shared component is tested once, in one place.

## App (`/src`)

- **Jest** with **jest-expo** preset. Run: `cd src && npm test`. CI gates every `src/**` PR on format, lint, typecheck, and tests (`.github/workflows/test-frontend.yml`).
- Tests live in `__tests__/` directories; never under `app/`, which Expo Router treats as routes.
- Test files run a relaxed ESLint rule set — the override in `src/eslint.config.js` is the source of truth. Only untypeable Jest boundaries are off; prefer typed mocks anyway.
- **`jest.mock` factories are hoisted**, so: use `jest.requireActual<typeof import("react-native")>("react-native")` to pull real components into a factory (`components/__tests__/AppNav.test.tsx`); mock a module-scope *constant* with a getter in the factory, read inside the component, variable prefixed `mock` (`__tests__/tabsLayout.test.tsx`).
- **Web-only components:** import the platform file directly (`../X.web`) — extension-less paths resolve to the native variant under jest-expo.
- **A wholesale `jest.mock("expo-router", …)` must supply `useFocusEffect`** if anything rendered uses it (`components/DismissModal` does). See `__tests__/edit-task/editTaskScreen.test.tsx`.
- **Gestures/animations:** `jest.setup.js` wires gesture-handler and the reanimated mock; drive gestures with `fireGestureHandler` (`components/__tests__/SwipeablePage.test.tsx`). The reanimated mock lacks `useReducedMotion` (setup adds the motion-allowed branch) and its `interpolateColor` returns `undefined` — pin color math at its source, not in a rendered tree. **No test can see the worklet boundary**: a worklet calling a plain module function is green everywhere and throws on device (DEX-128). Treat animation work as unverified until it has run on a device.
- **Drag and drop:** drax is stubbed to pass-through views; drive drops by invoking the target's props. The stub can't see stale registry handlers — capture the handler, rerender, then invoke the captured one (the PR #73 guard in `components/__tests__/TaskDropTarget.test.tsx`).
- **Native `ConfirmationModal` renders nothing** — spy on `Alert.alert` and restore the spy in `afterEach` (`components/__tests__/TaskDrawer.test.tsx`).
- **Importing a `.web` overlay needs the `react-dom` portal mock**: `jest.mock("react-dom", () => require("@/testUtils/mockReactDomPortal").mockReactDomPortal())`. These tests can't prove a click lands under a real vaul dialog — that half is manual (DEX-134).
- **`expo-audio` throws at import time**; `jest.setup.js` stands in an inert player. To assert on playback, mock a player per test (`hooks/__tests__/useHoroscopeAudio.test.ts`).
- **An `act(...)` warning fails the suite** (`jest.setupAfterEnv.js`). It means a state update landed after its test returned — so the assertion before it never saw settled state — and React reports it from whichever test happened to be running when the timer fired, which is usually *not* the culprit. Read the component it names, not the test it failed.
- **Don't close a mutation test on a mock's call count.** `toHaveBeenCalled()` goes true when the request *starts*, while `onSettled` → `invalidateQueries` → refetch → notify all land after the test returns. End on `settleQueries(client)` (`@/testUtils/settleQueries`) or on the hook's own terminal state — `hooks/__tests__/useRealtimeInvalidation.test.tsx` resolves its deferred inside `act`, then waits for `result.current[0].content`.
- **Never leave a mocked mutation on a promise that never settles** — it wedges the whole run instead of failing one test. The one deliberate exception says so at the call site (`useRealtimeInvalidation.test.tsx`, simulating an autosave still retrying after unmount).
- **`@shopify/flash-list` is mocked** in `jest.setup.js` as a plain view rendering every item, which is what the real one did here anyway. It schedules layout state from a `requestAnimationFrame` that always outlives a synchronous test. Its own `jestSetup` is not the fix: it only stubs `measureLayout`, and loading it globally cost the suite 5s → 90s.
- **`npm test` needs `--forceExit`** — tests build a `QueryClient` and none clears it, so react-query's gc timers hold the event loop open for minutes after the last assertion (`--detectOpenHandles` names them).

## Supabase (`/supabase`)

- **Deno test**: `cd supabase && deno test --allow-all --config __tests__/deno.json __tests__/` (add `--env-file=.env` when tests need secrets).
- CI has **no Postgres and no network**, so anything that reaches the network takes its dependency as an argument rather than stubbing a global: `fetchHoroscope(sign, date, key, fetchImpl)` is the pattern.
- **Write upstream fixtures from a real response, not from the vendor's docs.** Both times this table changed providers, the published sample disagreed with the wire format — once by carrying fields the API no longer sent, once by omitting the `{ success, data, metadata }` envelope the response is actually wrapped in. A fixture copied from documentation makes the whole suite pass against a parser that reads `undefined` in production.

## Formatting

- **App:** `cd src && npm run format` (Prettier)
- **Supabase:** `cd supabase && deno fmt`
