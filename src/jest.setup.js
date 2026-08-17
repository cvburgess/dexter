// utils/supabase.ts reads these at module scope, so they must exist before any
// test imports it (directly or via useAuth.tsx, which re-exports the client).
process.env.EXPO_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "test-publishable-key";

require("react-native-gesture-handler/jestSetup");

// FlashList stands in as a plain view that renders every item, which is what
// the real one already did here: no native layout events fire under
// react-test-renderer, so it can't measure a viewport to virtualize against.
// The mock is for `act(...)` noise, not virtualization — FlashList v2 sets
// `isLoaded` from inside a `requestAnimationFrame` and pokes its render id
// from several `setTimeout`s, all of which land after a synchronous test body
// returns. That was 41 of the 45 warnings this suite emitted (DEX-130), and
// no amount of awaiting in a test file stops the *next* one from reappearing.
//
// This is not `@shopify/flash-list/jestSetup`, which is a different thing and
// still the wrong one: it only stubs `measureLayout` to constrain the list
// back down to a realistic viewport (useful only for a test asserting on what
// does/doesn't render off-screen — scope it to that one file), it does not
// touch the timers, and loading it globally via `setupFiles` (which re-runs
// per test file) was measured to balloon the full suite from ~5s to 90-100s.
jest.mock("@shopify/flash-list", () => {
  const { Fragment, forwardRef, useImperativeHandle } = require("react");
  const { View } = require("react-native");

  const FlashList = forwardRef(function FlashList(
    {
      contentContainerStyle,
      data,
      extraData,
      ItemSeparatorComponent,
      keyExtractor,
      ListEmptyComponent,
      renderItem,
      ...props
    },
    ref,
  ) {
    // TaskDrawer scrolls the list back to the top when its filter changes.
    // Pinned with `[]` so the handle is stable across renders, as the real
    // component's is — a test can capture it and still see later calls.
    useImperativeHandle(
      ref,
      () => ({
        scrollToEnd: jest.fn(),
        scrollToIndex: jest.fn(),
        scrollToOffset: jest.fn(),
        scrollToTop: jest.fn(),
      }),
      [],
    );

    // The empty state lives inside the list on the surfaces that keep the list
    // mounted through it (DEX-136), so a mock that only rendered `data` would
    // make those screens look blank to a test.
    const rows = data ?? [];

    return (
      <View {...props}>
        <View style={contentContainerStyle}>
          {rows.length === 0 && ListEmptyComponent ? (
            <ListEmptyComponent />
          ) : null}
          {rows.map((item, index) => (
            <Fragment key={keyExtractor ? keyExtractor(item, index) : index}>
              {index > 0 && ItemSeparatorComponent ? (
                <ItemSeparatorComponent />
              ) : null}
              {renderItem?.({ item, index, target: "Cell", extraData })}
            </Fragment>
          ))}
        </View>
      </View>
    );
  });

  return { FlashList };
});

// The reanimated mock leaves `useReducedMotion` out — its source has the hook
// stubbed as `// useReducedMotion: ADD ME IF NEEDED` — so any component that
// guards an animation on it throws in every test that mounts it (DEX-128,
// `HoroscopeStep`). Report motion as allowed, which is the branch under test;
// a test that wants the reduced path re-mocks this hook for itself.
//
// Note also that the mock's `interpolateColor` is a no-op returning
// `undefined`, so an animated `backgroundColor` is never assertable from a
// rendered tree. That is why the color math lives in `sentimentTints`
// (`utils/theme.ts`) and is pinned by `utils/__tests__/theme.test.ts` instead.
jest.mock("react-native-reanimated", () => {
  const mock = require("react-native-reanimated/mock");
  return { ...mock, useReducedMotion: () => false };
});

// `expo-audio` ships no jest mock and reaches for its native module at import
// time — `ExpoAudio.ts` reads a prototype off it, so merely importing anything
// that imports it throws here, several files from the test that triggered it.
// An inert player is enough for every component test: they assert on what is
// rendered, and nothing is. `hooks/__tests__/useHoroscopeAudio.test.ts` mocks
// this module for itself with a player it can inspect.
jest.mock("expo-audio", () => ({
  createAudioPlayer: () => ({
    currentTime: 0,
    duration: 0,
    loop: false,
    pause: jest.fn(),
    play: jest.fn(),
    remove: jest.fn(),
    volume: 1,
  }),
}));

// `react-native-audio-api` reaches for its native module at import time, and
// `useBreathAudio` calls `AudioManager.disableSessionManagement()` at module
// scope — so merely importing the Breathe step throws here without this. An
// inert graph is enough for every component test; `hooks/__tests__/useBreathAudio.test.ts`
// mocks the module for itself with a context it can inspect.
jest.mock("react-native-audio-api", () => {
  const param = () => ({
    cancelAndHoldAtTime: jest.fn(),
    linearRampToValueAtTime: jest.fn(),
    setValueAtTime: jest.fn(),
  });

  return {
    AudioContext: jest.fn().mockImplementation(() => ({
      close: jest.fn().mockResolvedValue(undefined),
      createBiquadFilter: () => ({
        connect: jest.fn(),
        frequency: param(),
        type: "lowpass",
      }),
      createBuffer: (channels, length) => ({
        getChannelData: () => new Float32Array(length),
      }),
      createConvolver: () => ({ buffer: null, connect: jest.fn() }),
      createGain: () => ({ connect: jest.fn(), gain: param() }),
      createOscillator: () => ({
        connect: jest.fn(),
        detune: param(),
        frequency: param(),
        start: jest.fn(),
        stop: jest.fn(),
        type: "sine",
      }),
      currentTime: 0,
      destination: {},
      // Small on purpose: the hook fills an impulse response of
      // `sampleRate * seconds` samples, and every test that mounts the Breathe
      // step would otherwise pay for 350k `Math.random()` calls.
      sampleRate: 64,
    })),
    AudioManager: { disableSessionManagement: jest.fn() },
  };
});

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);

// @expo/ui's MenuView is a native component with no test double of its own;
// render just the trigger so components using it (via IconMenu.native) can
// still be tested. Selection logic is covered by testing each menu's
// exported section-builder functions directly.
jest.mock("@expo/ui/community/menu", () => ({
  MenuView: ({ children }) => children,
}));

// @expo/ui's universal components (SwiftUI/Compose hosts) have no test
// doubles either; selection logic is exercised through the props of the
// components that render them.
jest.mock("@expo/ui", () => {
  const Host = ({ children }) => children;
  const Picker = () => null;
  Picker.Item = function PickerItem() {
    return null;
  };
  return { Host, Picker };
});

// expo-symbols renders a native SF Symbol / Material Symbol view.
jest.mock("expo-symbols", () => ({ SymbolView: () => null }));

// expo-glass-effect wraps a native iOS UIVisualEffectView; render its children
// through a plain View and report glass as unavailable so the .ios fallback path
// is exercised without the native module.
jest.mock("expo-glass-effect", () => {
  const { View } = require("react-native");
  return {
    GlassView: ({ children, ...props }) => <View {...props}>{children}</View>,
    GlassContainer: ({ children, ...props }) => (
      <View {...props}>{children}</View>
    ),
    isLiquidGlassAvailable: () => false,
    isGlassEffectAPIAvailable: () => false,
  };
});

// Vector icons render glyphs from a bundled font; render the icon name as
// text so tests can assert on presence without the native font.
jest.mock("@react-native-vector-icons/ionicons", () => {
  const { Text } = require("react-native");
  const Ionicons = ({ name, ...props }) => <Text {...props}>{name}</Text>;
  return { __esModule: true, default: Ionicons };
});

// expo-calendar is a native module (device calendars). Default every method to
// an empty/granted result; individual tests override with jest.spyOn as needed.
jest.mock("expo-calendar", () => ({
  EntityTypes: { EVENT: "event" },
  requestCalendarPermissions: jest.fn(async () => ({
    status: "granted",
    granted: true,
  })),
  getCalendarPermissions: jest.fn(async () => ({
    status: "granted",
    granted: true,
  })),
  getCalendars: jest.fn(async () => []),
  listEvents: jest.fn(async () => []),
}));

// expo-alarm-kit wraps native iOS AlarmKit (used by utils/alarms.ios). Default
// authorization to granted and the schedule/cancel/query calls to no-ops so the
// alarm layer can be tested without the native module.
jest.mock("expo-alarm-kit", () => ({
  configure: jest.fn(() => true),
  requestAuthorization: jest.fn(async () => "authorized"),
  scheduleAlarm: jest.fn(async () => true),
  scheduleTimerAlarm: jest.fn(async () => true),
  cancelAlarm: jest.fn(async () => true),
  getAllAlarms: jest.fn(() => []),
  generateUUID: jest.fn(() => "test-uuid"),
}));

// expo-share-intent ships a native module (the iOS share extension / Android
// intent filters). Default to "no share arrived" so mounting the app under test
// takes the same path a normal launch does; a test that cares supplies its own
// payload by re-mocking useShareIntentContext.
jest.mock("expo-share-intent", () => ({
  ShareIntentProvider: ({ children }) => children,
  useShareIntentContext: jest.fn(() => ({
    hasShareIntent: false,
    shareIntent: { text: null, webUrl: null, files: null },
    resetShareIntent: jest.fn(),
  })),
}));

// react-native-drax drives drag hit-testing through Reanimated shared values
// (`spatialIndexSV.modify`, `scrollOffsetsSV.modify`) that the
// `react-native-reanimated/mock` above doesn't implement — mounting a real
// DraxProvider throws. All three render as ordinary views that pass their props
// straight through, so a test finds a drop target by testID and invokes
// `onReceiveDragDrop`/`acceptsDrag` directly rather than simulating a pointer
// path (DEX-77). They render their children rather than `null`, or every card
// inside a drag source would vanish from existing assertions.
//
// Note what this stub cannot catch: drax caches a view's props in its registry
// and calls the *cached* handler, while a pass-through View calls the current
// one. A drop handler that has gone stale therefore still passes here. See
// `TaskDropTarget`, whose test captures a handler and calls it after a rerender
// to reproduce the real behavior.
jest.mock("react-native-drax", () => {
  const { ScrollView, View } = require("react-native");
  return {
    DraxProvider: ({ children, ...props }) => (
      <View {...props}>{children}</View>
    ),
    DraxView: ({ children, ...props }) => <View {...props}>{children}</View>,
    // A real ScrollView so WeekView's ref/onLayout/scrollTo anchoring keeps
    // working — the today-column anchor is asserted in weekScreen.test.tsx.
    DraxScrollView: ({ children, ...props }) => (
      <ScrollView {...props}>{children}</ScrollView>
    ),
  };
});

// @expo/ui's SwiftUI primitives (used by DateField.ios and
// RitualStepSegments.ios) are native views. Rendered as null so a screen that
// merely contains one still mounts; a test that needs to drive one overrides
// this with a capturing mock of its own (see RitualStepSegments.test).
jest.mock("@expo/ui/swift-ui", () => ({
  DatePicker: () => null,
  Host: ({ children }) => children,
  Image: () => null,
  Picker: () => null,
}));
jest.mock("@expo/ui/swift-ui/modifiers", () => ({
  accessibilityLabel: () => ({}),
  datePickerStyle: () => ({}),
  glassEffect: () => ({}),
  pickerStyle: () => ({}),
  tag: () => ({}),
  tint: () => ({}),
}));
