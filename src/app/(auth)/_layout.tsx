import { Redirect, Stack } from "expo-router";

import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/utils/theme";

export default function AuthLayout() {
  const { initializing, session } = useAuth();
  const theme = useTheme();

  if (!initializing && session) {
    return <Redirect href="/(app)/(tabs)/today" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="login" />
    </Stack>
  );
}
