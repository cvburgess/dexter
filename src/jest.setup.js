// utils/supabase.ts reads these at module scope, so they must exist before any
// test imports it (directly or via useAuth.tsx, which re-exports the client).
process.env.EXPO_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

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

// @expo/ui's SwiftUI primitives (used by DateField.ios) are native views.
jest.mock("@expo/ui/swift-ui", () => ({
  DatePicker: () => null,
  Host: ({ children }) => children,
}));
jest.mock("@expo/ui/swift-ui/modifiers", () => ({
  datePickerStyle: () => ({}),
  tint: () => ({}),
}));
