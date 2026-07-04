import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";
import { signInWithEmail, signInWithGoogle } from "@/hooks/useAuth";
import { useTheme } from "@/utils/theme";

const toErrorMessage = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : "Something went wrong. Please try again.";

export default function LoginScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const { error } = await signInWithEmail(email.trim());
      if (error) throw error;

      setEmailSent(true);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <SafeAreaView style={styles.content} edges={["top", "left", "right"]}>
        <Text style={[theme.fonts.heading, { color: theme.colors.text }]}>
          Dexter
        </Text>

        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Sign up or log in to start planning
        </Text>

        {errorMessage ? (
          <View
            style={[
              styles.banner,
              {
                backgroundColor: theme.colors.error,
                borderRadius: theme.borderRadius,
                padding: theme.spacing,
                marginBottom: theme.spacing,
              },
            ]}
          >
            <Text style={{ color: theme.colors.errorContent }}>
              {errorMessage}
            </Text>
          </View>
        ) : null}

        {emailSent ? (
          <>
            <View
              style={[
                styles.banner,
                {
                  backgroundColor: theme.colors.success,
                  borderRadius: theme.borderRadius,
                  padding: theme.spacing,
                  marginBottom: theme.spacing,
                },
              ]}
            >
              <Text
                testID="login-email-sent-banner"
                style={{ color: theme.colors.successContent }}
              >
                Check your email for a login link
              </Text>
            </View>
            <Button
              onPress={() => setEmailSent(false)}
              testID="login-use-different-email-button"
            >
              Use a different email
            </Button>
          </>
        ) : (
          <>
            <Button
              onPress={handleGoogleLogin}
              disabled={loading}
              isLoading={loading}
              testID="login-google-button"
            >
              Continue with Google
            </Button>

            <Text
              style={[styles.divider, { color: theme.colors.textSecondary }]}
            >
              OR
            </Text>

            <TextInput
              testID="login-email-input"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!loading}
              style={{ marginBottom: theme.spacing }}
            />
            <Button
              variant="primary"
              onPress={handleEmailLogin}
              disabled={loading || !email.trim()}
              isLoading={loading}
              testID="login-email-button"
            >
              Continue with Email
            </Button>
          </>
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: 32,
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
  },
  banner: {
    width: "100%",
  },
  divider: {
    fontSize: 14,
    marginVertical: 16,
    textAlign: "center",
  },
});
