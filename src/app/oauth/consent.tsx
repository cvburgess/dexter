import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { LoadingScreen } from "@/components/LoadingScreen";
import { supabase, useAuth } from "@/hooks/useAuth";
import { setPendingOAuthAuthorizationId } from "@/utils/oauthReturn";
import { useTheme } from "@/utils/theme";

/**
 * OAuth consent screen for MCP / third-party integrations.
 *
 * Supabase's OAuth server redirects an authorizing client here with an
 * `authorization_id` query param. This route lives outside the authenticated
 * `(app)` group, so it carries its own guard: an unauthenticated visitor is
 * bounced to sign-in with the `authorization_id` stashed, then returned here
 * after login (see utils/oauthReturn.ts and app/auth-callback.tsx).
 */
export default function OAuthConsentScreen() {
  const { authorization_id: authorizationId } = useLocalSearchParams<{
    authorization_id?: string;
  }>();
  const { initializing, session } = useAuth();
  const theme = useTheme();
  const router = useRouter();

  const [appName, setAppName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [step, setStep] = useState<"consent" | "done">("consent");
  const [error, setError] = useState<string | null>(null);

  // Unauthenticated → stash the pending authorization and bounce to sign-in.
  // The stash happens before the redirect so auth-callback can return here.
  useEffect(() => {
    if (initializing || session) return;
    const stash = authorizationId
      ? setPendingOAuthAuthorizationId(authorizationId)
      : Promise.resolve();
    void stash.finally(() => router.replace("/(auth)/login"));
  }, [initializing, session, authorizationId, router]);

  // Try to fetch the requesting client's name once authenticated. If the
  // authorization is not found (404), it was already auto-approved by Supabase
  // — show a success message.
  useEffect(() => {
    if (initializing || !session || !authorizationId) return;

    void (async () => {
      try {
        const result =
          await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
        const errorCode = (result.error as { code?: string } | null)?.code;
        if (errorCode === "oauth_authorization_not_found") {
          // Authorization was already approved — nothing left to do.
          setStep("done");
          setLoading(false);
          return;
        }
        // result.data is a union (redirect vs. authorization details); only
        // the latter carries `client`, so read it through a narrowed shape.
        const data = result.data as
          | { client?: { name?: string } }
          | null
          | undefined;
        setAppName(data?.client?.name ?? "An application");
        setLoading(false);
      } catch {
        // Details unavailable — show a generic consent screen anyway.
        setAppName("An application");
        setLoading(false);
      }
    })();
  }, [initializing, session, authorizationId]);

  const approve = async () => {
    if (!authorizationId) return;
    setApproving(true);
    setError(null);

    try {
      const result =
        await supabase.auth.oauth.approveAuthorization(authorizationId);
      const redirectTo = result.data?.redirect_url;

      if (result.error || !redirectTo) {
        const message =
          (result.error as { message?: string } | null)?.message ??
          "Authorization failed.";
        setError(message);
        setApproving(false);
        return;
      }

      if (Platform.OS === "web") {
        window.location.href = redirectTo;
      } else {
        await Linking.openURL(redirectTo);
        router.back();
      }
    } catch (err) {
      console.warn("OAuth approve failed", err);
      setError("Authorization failed. Please try again.");
      setApproving(false);
    }
  };

  const deny = async () => {
    if (!authorizationId) {
      router.back();
      return;
    }
    try {
      const result =
        await supabase.auth.oauth.denyAuthorization(authorizationId);
      const redirectTo = result.data?.redirect_url;

      if (redirectTo) {
        if (Platform.OS === "web") {
          window.location.href = redirectTo;
        } else {
          await Linking.openURL(redirectTo);
          router.back();
        }
      } else {
        router.back();
      }
    } catch {
      router.back();
    }
  };

  if (initializing || !session) {
    return <LoadingScreen />;
  }

  // Authenticated but nothing to consent to — send them into the app.
  if (!authorizationId) {
    return <Redirect href="/(app)/(tabs)/today" />;
  }

  if (step === "done") {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Authorized
          </Text>
          <Text
            style={[styles.subtitle, { color: theme.colors.textSecondary }]}
          >
            You can close this window and return to the app that requested
            access.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading || approving) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text
            style={[styles.subtitle, { color: theme.colors.textSecondary }]}
          >
            {approving ? "Authorizing…" : "Loading…"}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Authorize Access
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {appName} wants to access your tasks, lists, goals, days, habits, and
          journals.
        </Text>

        {error ? (
          <Text style={[styles.error, { color: theme.colors.error }]}>
            {error}
          </Text>
        ) : null}

        <Button
          variant="primary"
          onPress={approve}
          testID="oauth-consent-approve-button"
        >
          Approve
        </Button>

        <Button onPress={deny} testID="oauth-consent-deny-button">
          Deny
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    maxWidth: 400,
    width: "100%",
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    fontSize: 14,
    textAlign: "center",
  },
});
