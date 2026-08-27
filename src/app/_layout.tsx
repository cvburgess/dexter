import {
  PlayfairDisplay_700Bold_Italic,
  useFonts,
} from "@expo-google-fonts/playfair-display";
import * as Sentry from "@sentry/react-native";
import { Stack, useNavigationContainerRef } from "expo-router";
import type { ErrorBoundaryProps } from "expo-router";
import { ShareIntentProvider } from "expo-share-intent";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ShareIntentRedirect } from "@/components/ShareIntentRedirect";
import { AuthProvider } from "@/hooks/useAuth";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { configureAlarms } from "@/utils/alarms";
import { getSentryDsn } from "@/utils/sentry";
import { useTheme } from "@/utils/theme";

// Hold the splash until the custom font loads (module scope — too late once
// the first frame lands), or the Horoscope hero's SERIF face swaps mid-animation.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Module scope so the same instance is both passed to Sentry.init and
// registered against ThemedStack's navigation container.
const navigationIntegration = Sentry.reactNavigationIntegration();

// Off in development: ad blockers reject Sentry's fetch before it leaves the
// tab, and dev exceptions have no business in the production issue stream.
const SENTRY_ENABLED = !__DEV__;

// Sentry.init runs at module scope — the earliest point in the app's
// lifecycle — so it captures errors from as much of startup as possible.
Sentry.init({
  dsn: getSentryDsn(),
  enabled: SENTRY_ENABLED,
  integrations: [navigationIntegration],
  tracesSampleRate: 1.0,
  enableAutoSessionTracking: true,
  // The SDK already no-ops these on web; explicit for readable intent, as
  // with the AppState guard in utils/supabase.ts.
  enableNative: Platform.OS !== "web",
  enableNativeCrashHandling: Platform.OS !== "web",
  // Not `__DEV__`: with the SDK disabled this would only narrate discarded
  // events, one noise stream for another.
  debug: __DEV__ && SENTRY_ENABLED,
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
  // `error` is as good as `loaded` — a failed font starts in the system face
  // rather than holding the splash forever.
  const [fontsLoaded, fontError] = useFonts({ PlayfairDisplay_700Bold_Italic });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  // Nothing rather than a placeholder — the splash is still up, so this frame
  // is never seen.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Outside the providers: a share can launch the app cold, and the
          payload has to be readable before anything below has mounted. */}
      <ShareIntentProvider>
        <QueryProvider>
          <AuthProvider>
            <ThemeProvider>
              <ShareIntentRedirect />
              <ThemedStack />
            </ThemeProvider>
          </AuthProvider>
        </QueryProvider>
      </ShareIntentProvider>
    </GestureHandlerRootView>
  );
}

// Plain composition (no ref/hook trickery), so it's React-Compiler-safe.
export default Sentry.wrap(RootLayout);

// Can render when providers above (including ThemeProvider) failed to mount —
// useTheme() falls back to an OS-resolved default with no provider above it.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const theme = useTheme();

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <View
      style={[
        styles.errorRoot,
        {
          backgroundColor: theme.colors.background,
          gap: theme.space.sm,
          padding: theme.space.lg,
        },
      ]}
    >
      <Text style={[theme.fonts.title, { color: theme.colors.text }]}>
        Something went wrong
      </Text>
      <Text
        style={[
          theme.fonts.body,
          styles.errorMessage,
          { color: theme.colors.text },
        ]}
      >
        {error.message}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={retry}
        style={{
          backgroundColor: theme.colors.primary,
          // The app's one corner radius, like every other button.
          borderRadius: theme.radii.md,
          marginTop: theme.space.sm,
          paddingHorizontal: theme.space.md,
          paddingVertical: theme.space.sm,
        }}
      >
        <Text
          style={[theme.fonts.title, { color: theme.colors.primaryContent }]}
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
  },
  errorMessage: {
    opacity: 0.7,
    textAlign: "center",
  },
});
