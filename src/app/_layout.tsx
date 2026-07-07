import { Stack } from "expo-router";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider } from "@/hooks/useAuth";
import { QueryProvider } from "@/providers/QueryProvider";
import { useTheme } from "@/utils/theme";

export default function RootLayout() {
  const theme = useTheme();

  return (
    <GestureHandlerRootView style={styles.root}>
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
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
