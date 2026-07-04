// useAuth.tsx reads these at module scope, so they must exist before any
// test imports it.
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
