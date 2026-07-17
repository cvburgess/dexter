import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ReactNode, useCallback, useEffect, useState } from "react";
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
  const router = useRouter();

  const [appName, setAppName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [step, setStep] = useState<"consent" | "done">("consent");
  const [error, setError] = useState<string | null>(null);

  // Hand the browser back to the MCP client. On web this is a full-page
  // navigation; on native we open the URL and pop this screen.
  const followRedirect = useCallback(
    (url: string) => {
      if (Platform.OS === "web") {
        window.location.href = url;
      } else {
        void Linking.openURL(url).then(() => router.back());
      }
    },
    [router],
  );

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
        // result.data is a union: a redirect (consent already granted for a
        // trusted client) or the authorization details carrying `client`.
        const data = result.data as
          | { redirect_url?: string; client?: { name?: string } }
          | null
          | undefined;
        if (data?.redirect_url) {
          // Nothing to consent to — hand straight back to the MCP client.
          followRedirect(data.redirect_url);
          return;
        }
        setAppName(data?.client?.name ?? "An application");
        setLoading(false);
      } catch {
        // Details unavailable — show a generic consent screen anyway.
        setAppName("An application");
        setLoading(false);
      }
    })();
  }, [initializing, session, authorizationId, followRedirect]);

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

      followRedirect(redirectTo);
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
        followRedirect(redirectTo);
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
      <ConsentCard>
        <AuthorizedNotice />
      </ConsentCard>
    );
  }

  if (loading || approving) {
    return (
      <ConsentCard>
        <PendingIndicator message={approving ? "Authorizing…" : "Loading…"} />
      </ConsentCard>
    );
  }

  return (
    <ConsentCard>
      <ConsentForm
        appName={appName}
        error={error}
        onApprove={approve}
        onDeny={deny}
      />
    </ConsentCard>
  );
}

function ConsentCard({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.card,
            borderRadius: theme.borderRadius,
          },
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

function AuthorizedNotice() {
  const theme = useTheme();

  return (
    <>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Authorized
      </Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        You can close this window and return to the app that requested access.
      </Text>
    </>
  );
}

function PendingIndicator({ message }: { message: string }) {
  const theme = useTheme();

  return (
    <>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        {message}
      </Text>
    </>
  );
}

type TConsentFormProps = {
  appName: string | null;
  error: string | null;
  onApprove: () => void;
  onDeny: () => void;
};

function ConsentForm({ appName, error, onApprove, onDeny }: TConsentFormProps) {
  const theme = useTheme();

  return (
    <>
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
        onPress={onApprove}
        testID="oauth-consent-approve-button"
      >
        Approve
      </Button>

      <Button onPress={onDeny} testID="oauth-consent-deny-button">
        Deny
      </Button>
    </>
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
