import { Stack } from "expo-router";

import { AuthProvider } from "@/hooks/useAuth";
import { QueryProvider } from "@/providers/QueryProvider";
import { useTheme } from "@/utils/theme";

export default function RootLayout() {
  const theme = useTheme();

  return (
    <QueryProvider>
      <AuthProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            // Themed so the gap before a screen paints (cold start, auth
            // redirects) matches the active scheme instead of flashing white.
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        />
      </AuthProvider>
    </QueryProvider>
  );
}
