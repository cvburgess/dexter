import { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Image, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { deleteAccount, signOut, useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/utils/theme";

const confirm = (
  title: string,
  message: string,
  confirmLabel: string,
): Promise<boolean> => {
  // RN's Alert is a no-op on web, so use the browser's confirm dialog there.
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(message));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: "destructive",
        onPress: () => resolve(true),
      },
    ]);
  });
};

export default function AccountScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [pending, setPending] = useState(false);

  const handleLogOut = async () => {
    const confirmed = await confirm(
      "Log Out",
      "Are you sure you want to log out?",
      "Log Out",
    );
    if (!confirmed) return;

    setPending(true);
    try {
      await signOut();
      // Drop cached data so nothing leaks to the next signed-in user.
      queryClient.clear();
      // No manual navigation: the (app)/_layout guard redirects to login once
      // the session state flips to null. Navigating here would race that state
      // update and (auth)/_layout could bounce a stale session back into the app.
    } finally {
      setPending(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = await confirm(
      "Delete Account",
      "This will permanently delete your account and all your data. This cannot be undone.",
      "Delete Account",
    );
    if (!confirmed) return;

    setPending(true);
    try {
      await deleteAccount();
      // Same rationale as log out: clear the cache and let the (app)/_layout
      // guard handle navigation when the session flips to null.
      queryClient.clear();
    } finally {
      setPending(false);
    }
  };

  return (
    <SafeAreaView
      edges={["bottom", "left", "right"]}
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          padding: theme.spacing,
        },
      ]}
    >
      {session ? <UserProfile session={session} /> : null}

      <View style={{ gap: theme.gap }}>
        <Button
          variant="dangerous"
          onPress={handleLogOut}
          isLoading={pending}
          disabled={pending}
          testID="settings-log-out-button"
        >
          Log Out
        </Button>
        <Button
          variant="dangerous"
          onPress={handleDeleteAccount}
          isLoading={pending}
          disabled={pending}
          testID="settings-delete-account-button"
        >
          Delete Account
        </Button>
      </View>
    </SafeAreaView>
  );
}

function UserProfile({ session }: { session: Session }) {
  const theme = useTheme();
  const { user } = session;

  // Supabase types user_metadata as Record<string, any>; narrow the fields we
  // read (populated by OAuth providers like Google) to avoid `any`.
  const metadata = user.user_metadata as {
    avatar_url?: string;
    full_name?: string;
    user_name?: string;
  };

  const name = metadata.full_name || metadata.user_name;
  const initial = user.email?.charAt(0)?.toUpperCase() ?? "😄";

  return (
    <View
      style={[
        styles.profile,
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.borderRadius,
          gap: theme.gap,
        },
      ]}
    >
      {metadata.avatar_url ? (
        <Image
          accessibilityLabel="User avatar"
          source={{ uri: metadata.avatar_url }}
          style={styles.avatar}
        />
      ) : (
        <View
          style={[
            styles.avatar,
            styles.avatarPlaceholder,
            { backgroundColor: theme.colors.primary },
          ]}
        >
          <Text
            style={[
              styles.avatarInitial,
              { color: theme.colors.primaryContent },
            ]}
          >
            {initial}
          </Text>
        </View>
      )}

      <View style={styles.identity}>
        {name ? (
          <Text
            style={[styles.name, { color: theme.colors.text }]}
            testID="account-name"
          >
            {name}
          </Text>
        ) : null}
        <Text
          style={[styles.email, { color: theme.colors.textSecondary }]}
          testID="account-email"
        >
          {user.email}
        </Text>
      </View>
    </View>
  );
}

const AVATAR_SIZE = 64;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: "700",
  },
  identity: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
  },
  email: {
    fontSize: 14,
  },
});
