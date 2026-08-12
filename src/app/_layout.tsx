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

// Hold the splash until the custom font is in memory. Module scope, because the
// splash auto-hides as soon as the root component's first frame lands and a call
// inside the component is already too late.
//
// This is the app's only startup gate, and it exists for a specific failure
// rather than on principle: the Horoscope step's hero is set in `SERIF`, and
// without the hold it paints in the system face and swaps a frame later. The
// step fades its content in over ~3.6s, so that swap does not land under a
// splash the way a normal cold start would hide it — it happens in full view,
// mid-animation.
//
// It is deliberately not awaited anywhere: `catch` rather than `void` because a
// rejected prevent-auto-hide is not a reason to fail to launch. The worst case
// is the swap this exists to avoid.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Instantiated once at module scope (not per-render) so the same integration
// instance is both passed to Sentry.init below and registered against the
// navigation container in ThemedStack.
const navigationIntegration = Sentry.reactNavigationIntegration();

/**
 * Whether this build reports to Sentry at all.
 *
 * Off in development, for two reasons. Sentry's ingest domains sit on
 * EasyPrivacy and most ad blockers' default lists, so in a browser the
 * transport's `fetch` is rejected before it leaves the tab — and `debug` below
 * printed that failure for every envelope, which at `tracesSampleRate: 1.0`
 * means every navigation. The noise was the visible half; the other half is
 * that a developer's own exceptions and traces have no business in the
 * production issue stream, where they crowd out the reports that came from
 * real users.
 *
 * Flip to `true` to exercise the reporting path locally — `debug` follows this
 * flag rather than `__DEV__` so doing so also turns the SDK's own logging back
 * on, which is the only thing that makes such a session legible.
 */
const SENTRY_ENABLED = !__DEV__;

// Sentry.init runs at module scope — the earliest point in the app's
// lifecycle — so it captures errors from as much of startup as possible.
Sentry.init({
  dsn: getSentryDsn(),
  enabled: SENTRY_ENABLED,
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
  // Not `__DEV__`: with the SDK disabled this would only narrate events being
  // discarded, trading one stream of dev-console noise for another.
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
  // `error` is as good as `loaded` here: a font that failed to load is a reason
  // to start in the system face, not a reason to hold the splash forever. The
  // hero degrades to the platform serif fallback, which is the same thing every
  // other line in the app already uses.
  //
  // One entry per loaded file — React Native resolves a custom family name to
  // exactly one, and cannot derive a weight from it. See `SERIF` in
  // `utils/theme.ts` before adding another.
  const [fontsLoaded, fontError] = useFonts({ PlayfairDisplay_700Bold_Italic });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  // Nothing rather than a placeholder: the splash is still up, so this frame is
  // never seen. Rendering the tree early and swapping the font underneath it is
  // the whole thing being avoided.
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
