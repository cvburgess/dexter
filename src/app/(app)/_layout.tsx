import { Redirect, Stack } from "expo-router";

import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/hooks/useAuth";
import { ViewedDayProvider } from "@/hooks/useViewedDay";
import { createModalScreenOptions } from "@/utils/stackOptions";
import { useTheme } from "@/utils/theme";

export default function AppLayout() {
  const { initializing, session } = useAuth();
  const theme = useTheme();

  if (initializing) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <ViewedDayProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="new-task"
          options={createModalScreenOptions(theme, "New Task")}
        />
      </Stack>
    </ViewedDayProvider>
  );
}
