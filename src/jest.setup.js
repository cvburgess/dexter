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
