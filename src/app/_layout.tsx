import * as Sentry from "@sentry/react-native";
import { Stack, useNavigationContainerRef } from "expo-router";
import type { ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider } from "@/hooks/useAuth";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { configureAlarms } from "@/utils/alarms";
import { getSentryDsn } from "@/utils/sentry";
import { useTheme } from "@/utils/theme";

// Instantiated once at module scope (not per-render) so the same integration
// instance is both passed to Sentry.init below and registered against the
// navigation container in ThemedStack.
const navigationIntegration = Sentry.reactNavigationIntegration();

// Sentry.init runs at module scope — the earliest point in the app's
// lifecycle — so it captures errors from as much of startup as possible.
Sentry.init({
  dsn: getSentryDsn(),
  integrations: [navigationIntegration],
  tracesSampleRate: 1.0,
  enableAutoSessionTracking: true,
  // react-native-web has no native module bridge, so native crash
  // handling / the native SDK have no web counterpart. The SDK no-ops these
  // internally on web already, but setting them explicitly keeps intent
  // readable here instead of relying on an undocumented internal check —
  // same rationale as the AppState guard in utils/supabase.ts.
  enableNative: Platform.OS !== "web",
  enableNativeCrashHandling: Platform.OS !== "web",
  debug: __DEV__,
});

// Wire up the AlarmKit App Group as early as possible (per expo-alarm-kit's
// requirement that `configure` run before any other alarm call). No-op off iOS.
configureAlarms();

// Rendered inside ThemeProvider so the gap before a screen paints (cold start,
// auth redirects) matches the user's chosen theme instead of flashing white.
function ThemedStack() {
  const theme = useTheme();
  const navigationRef = useNavigationContainerRef();

  // Hands Sentry's navigation integration the router's container ref so it
  // can instrument screen transitions (navigation breadcrumbs + spans).
  useEffect(() => {
    navigationIntegration.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}

function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryProvider>
        <AuthProvider>
          <ThemeProvider>
            <ThemedStack />
          </ThemeProvider>
        </AuthProvider>
      </QueryProvider>
    </GestureHandlerRootView>
  );
}

// Sentry.wrap adds a touch-event boundary + profiler around the root
// component. It's plain component composition (no ref mutation or hook
// trickery), so it's compatible with the React Compiler enabled via
// experiments.reactCompiler in app.json.
export default Sentry.wrap(RootLayout);

// Expo Router renders this in place of the route tree when a render error is
// thrown anywhere in this layout's subtree (including inside the providers
// above), so it can't assume ThemeProvider mounted successfully — useTheme()
// falls back to an OS-resolved default when there's no provider above it.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const theme = useTheme();

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <View
      style={[styles.errorRoot, { backgroundColor: theme.colors.background }]}
    >
      <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
        Something went wrong
      </Text>
      <Text style={[styles.errorMessage, { color: theme.colors.text }]}>
        {error.message}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={retry}
        style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
      >
        <Text
          style={[
            styles.retryButtonText,
            { color: theme.colors.primaryContent },
          ]}
        >
          Try again
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  errorRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  errorMessage: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    fontWeight: "600",
  },
});
