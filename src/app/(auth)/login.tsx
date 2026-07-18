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
import {
  isDemoEmail,
  signInWithEmail,
  signInWithGoogle,
  verifyDemoOtp,
  verifyEmailOtp,
} from "@/hooks/useAuth";
import { useTheme } from "@/utils/theme";

const toErrorMessage = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : "Something went wrong. Please try again.";

export default function LoginScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
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

  const handleSendCode = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      // The demo account can't receive email, so skip sending and go straight
      // to the code entry — its fixed code is verified by verify-demo-otp.
      if (!isDemoEmail(email)) {
        const { error } = await signInWithEmail(email.trim());
        if (error) throw error;
      }

      setCodeSent(true);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const trimmedEmail = email.trim();
      const { error } = isDemoEmail(trimmedEmail)
        ? await verifyDemoOtp(trimmedEmail, code)
        : await verifyEmailOtp(trimmedEmail, code);
      // On success the session is set and the (auth) layout redirects into the
      // app; no manual navigation needed.
      if (error) throw error;
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleUseDifferentEmail = () => {
    setCodeSent(false);
    setCode("");
    setErrorMessage("");
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
          {codeSent
            ? "Enter the code from your email"
            : "Sign up or log in to start planning"}
        </Text>

        {errorMessage ? <Banner tone="error">{errorMessage}</Banner> : null}

        {codeSent ? (
          <CodeEntryForm
            code={code}
            loading={loading}
            isDemo={isDemoEmail(email)}
            onChangeCode={setCode}
            onVerifyCode={handleVerifyCode}
            onUseDifferentEmail={handleUseDifferentEmail}
          />
        ) : (
          <EmailLoginForm
            email={email}
            loading={loading}
            onChangeEmail={setEmail}
            onGoogleLogin={handleGoogleLogin}
            onSendCode={handleSendCode}
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

type TCodeEntryFormProps = {
  code: string;
  loading: boolean;
  isDemo: boolean;
  onChangeCode: (code: string) => void;
  onVerifyCode: () => void;
  onUseDifferentEmail: () => void;
};

function CodeEntryForm({
  code,
  loading,
  isDemo,
  onChangeCode,
  onVerifyCode,
  onUseDifferentEmail,
}: TCodeEntryFormProps) {
  const theme = useTheme();

  return (
    <>
      {isDemo ? null : (
        <Banner tone="success" testID="login-code-sent-banner">
          Check your email for a login code — or tap the link
        </Banner>
      )}
      <TextInput
        testID="login-code-input"
        placeholder="Enter 6-digit code"
        value={code}
        onChangeText={onChangeCode}
        keyboardType="number-pad"
        maxLength={6}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        editable={!loading}
        style={{ marginBottom: theme.spacing }}
      />
      <Button
        variant="primary"
        onPress={onVerifyCode}
        disabled={loading || !code.trim()}
        isLoading={loading}
        testID="login-verify-button"
      >
        Verify Code
      </Button>
      <Button
        onPress={onUseDifferentEmail}
        disabled={loading}
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
  onSendCode: () => void;
};

function EmailLoginForm({
  email,
  loading,
  onChangeEmail,
  onGoogleLogin,
  onSendCode,
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
        onPress={onSendCode}
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
