import { ReactNode, useState } from "react";
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

        {errorMessage ? <Banner tone="error">{errorMessage}</Banner> : null}

        {emailSent ? (
          <EmailSentPanel onUseDifferentEmail={() => setEmailSent(false)} />
        ) : (
          <EmailLoginForm
            email={email}
            loading={loading}
            onChangeEmail={setEmail}
            onGoogleLogin={handleGoogleLogin}
            onEmailLogin={handleEmailLogin}
          />
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

type TBannerProps = {
  tone: "error" | "success";
  children: ReactNode;
  testID?: string;
};

function Banner({ tone, children, testID }: TBannerProps) {
  const theme = useTheme();
  const backgroundColor =
    tone === "error" ? theme.colors.error : theme.colors.success;
  const textColor =
    tone === "error" ? theme.colors.errorContent : theme.colors.successContent;

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor,
          borderRadius: theme.borderRadius,
          padding: theme.spacing,
          marginBottom: theme.spacing,
        },
      ]}
    >
      <Text testID={testID} style={{ color: textColor }}>
        {children}
      </Text>
    </View>
  );
}

function EmailSentPanel({
  onUseDifferentEmail,
}: {
  onUseDifferentEmail: () => void;
}) {
  return (
    <>
      <Banner tone="success" testID="login-email-sent-banner">
        Check your email for a login link
      </Banner>
      <Button
        onPress={onUseDifferentEmail}
        testID="login-use-different-email-button"
      >
        Use a different email
      </Button>
    </>
  );
}

type TEmailLoginFormProps = {
  email: string;
  loading: boolean;
  onChangeEmail: (email: string) => void;
  onGoogleLogin: () => void;
  onEmailLogin: () => void;
};

function EmailLoginForm({
  email,
  loading,
  onChangeEmail,
  onGoogleLogin,
  onEmailLogin,
}: TEmailLoginFormProps) {
  const theme = useTheme();

  return (
    <>
      <Button
        onPress={onGoogleLogin}
        disabled={loading}
        isLoading={loading}
        testID="login-google-button"
      >
        Continue with Google
      </Button>

      <Text style={[styles.divider, { color: theme.colors.textSecondary }]}>
        OR
      </Text>

      <TextInput
        testID="login-email-input"
        placeholder="Email"
        value={email}
        onChangeText={onChangeEmail}
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
        onPress={onEmailLogin}
        disabled={loading || !email.trim()}
        isLoading={loading}
        testID="login-email-button"
      >
        Continue with Email
      </Button>
    </>
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
