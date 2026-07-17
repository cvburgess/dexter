// utils/supabase.ts reads these at module scope, so they must exist before any
// test imports it (directly or via useAuth.tsx, which re-exports the client).
process.env.EXPO_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "test-publishable-key";

require("react-native-gesture-handler/jestSetup");

// Deliberately NOT requiring `@shopify/flash-list/jestSetup` here: FlashList
// already renders every item under test by default (no native layout events
// fire under react-test-renderer, so it can't measure a real viewport to
// virtualize against); that mock exists to constrain it back down to a
// realistic viewport for tests that specifically assert on recycling. Loading
// it globally via `setupFiles` (which re-runs per test file) was measured to
// balloon the full suite from ~5s to 90-100s for no behavior difference in
// any current test — add it scoped to a single test file instead, if a test
// ever needs to assert what does/doesn't render off-screen.
jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock"),
);

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
  Picker.Item = () => null;
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

// @expo/ui's SwiftUI primitives (used by DateField.ios) are native views.
jest.mock("@expo/ui/swift-ui", () => ({
  DatePicker: () => null,
  Host: ({ children }) => children,
}));
jest.mock("@expo/ui/swift-ui/modifiers", () => ({
  datePickerStyle: () => ({}),
  tint: () => ({}),
}));
