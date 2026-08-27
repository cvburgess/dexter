// utils/supabase.ts reads these at module scope, so they must exist before any
// test imports it (directly or via useAuth.tsx, which re-exports the client).
process.env.EXPO_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "test-publishable-key";

require("react-native-gesture-handler/jestSetup");

// Plain pass-through list: FlashList v2 schedules state from rAF/timers that
// outlive synchronous tests (DEX-130). Not its own jestSetup — docs/testing.md.
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
    // `[]` keeps the handle stable across renders like the real one's, so a
    // test can capture it and still see later scrollToTop calls.
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

    // Empty states live inside the list (DEX-136); rendering only `data`
    // would make those screens look blank to a test.
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

// The reanimated mock lacks `useReducedMotion` (DEX-128) — report motion
// allowed; its `interpolateColor` returns undefined, so pin colors at source.
jest.mock("react-native-reanimated", () => {
  const mock = require("react-native-reanimated/mock");
  return { ...mock, useReducedMotion: () => false };
});

// `utils/audio.ts` touches the native module at import time, so importing a
// sound-playing step throws without this; audio hooks re-mock with a context.
jest.mock("react-native-audio-api", () => {
  const param = () => ({
    cancelAndHoldAtTime: jest.fn(),
    linearRampToValueAtTime: jest.fn(),
    setValueAtTime: jest.fn(),
    setValueCurveAtTime: jest.fn(),
  });

  return {
    // Called at module scope by `useHoroscopeAudio`; never resolves, so
    // component tests never build a playback graph.
    decodeAudioData: jest.fn(() => new Promise(() => {})),
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
      // Small on purpose: the impulse response is `sampleRate * seconds`
      // samples — a real rate costs every Breathe test 350k Math.random calls.
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

// Native MenuView has no test double; render just the trigger. Selection
// logic is covered via each menu's exported section-builder functions.
jest.mock("@expo/ui/community/menu", () => ({
  MenuView: ({ children }) => children,
}));

// The SwiftUI/Compose hosts have no test doubles either; selection logic is
// exercised through the props of the components that render them.
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

// Render glass children through plain Views and report glass unavailable so
// the .ios fallback path is exercised without the native module.
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

// Authorization defaults to granted and schedule/cancel/query to no-ops so
// the alarm layer can be tested without native AlarmKit.
jest.mock("expo-alarm-kit", () => ({
  configure: jest.fn(() => true),
  requestAuthorization: jest.fn(async () => "authorized"),
  scheduleAlarm: jest.fn(async () => true),
  scheduleTimerAlarm: jest.fn(async () => true),
  cancelAlarm: jest.fn(async () => true),
  getAllAlarms: jest.fn(() => []),
  generateUUID: jest.fn(() => "test-uuid"),
}));

// Default to "no share arrived" so mounting the app takes the normal-launch
// path; a test that cares re-mocks useShareIntentContext with a payload.
jest.mock("expo-share-intent", () => ({
  ShareIntentProvider: ({ children }) => children,
  useShareIntentContext: jest.fn(() => ({
    hasShareIntent: false,
    shareIntent: { text: null, webUrl: null, files: null },
    resetShareIntent: jest.fn(),
  })),
}));

// Drax needs shared-value ops the reanimated mock lacks, so all three pass
// through and tests invoke drop props directly (DEX-77) — a stale cached handler still passes here; TaskDropTarget's test captures-then-rerenders to catch that.
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

// Native SwiftUI primitives render as null so screens containing one still
// mount; a test that drives one overrides with its own capturing mock.
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
