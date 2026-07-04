import { Redirect, Stack } from "expo-router";

import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/hooks/useAuth";
import { usePendingOAuthConsent } from "@/hooks/usePendingOAuthConsent";
import { useTheme } from "@/utils/theme";

export default function AuthLayout() {
  const { initializing, session } = useAuth();
  const theme = useTheme();
  // Native Google sign-in completes the exchange in place on the login screen,
  // so this layout — not auth-callback — is the redirect point that must return
  // the user to a pending OAuth consent.
  const pending = usePendingOAuthConsent(!initializing && !!session);

  if (!initializing && session) {
    if (pending.resolving) {
      return <LoadingScreen />;
    }

    if (pending.authorizationId) {
      return (
        <Redirect
          href={{
            pathname: "/oauth/consent",
            params: { authorization_id: pending.authorizationId },
          }}
        />
      );
    }

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
