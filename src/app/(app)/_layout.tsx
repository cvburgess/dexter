import { Stack } from "expo-router";

// TODO(auth): gate this group with useAuth() — redirect to /(auth)/login when
// there is no session once the auth routes land.
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
