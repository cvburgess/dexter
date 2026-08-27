import { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Image, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { deleteAccount, signOut, useAuth } from "@/hooks/useAuth";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
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
  // In two-pane mode the sidebar absorbs the left inset — SafeAreaView would
  // otherwise apply it regardless of position and indent content on a notch.
  const twoPane = useIsLargeDevice();

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
      queryClient.clear();
      // No manual navigation: (app)/_layout redirects on session → null.
      // Navigating here would race that and bounce a stale session back in.
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
      // Same rationale as log out: clear the cache, let (app)/_layout navigate.
      queryClient.clear();
    } finally {
      setPending(false);
    }
  };

  return (
    // The one settings screen claiming the bottom edge (DEX-91) — no
    // scroller here, so nothing could hide under the tab bar.
    <SafeAreaView
      edges={twoPane ? ["bottom", "right"] : ["bottom", "left", "right"]}
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          padding: theme.space.md,
        },
      ]}
    >
      {session ? <UserProfile session={session} /> : null}

      {/* Both were full-width dangerous buttons (DEX-108) — log out ending a
          session looked identical to deleting the account. Now weight
          carries the warning: log out is wide and neutral, delete is small. */}
      <View style={[styles.actions, { gap: theme.space.sm }]}>
        <Button
          variant="default"
          style={styles.logOut}
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

  // Supabase types user_metadata as Record<string, any>; narrow to avoid it.
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
        { padding: theme.space.md },
        {
          backgroundColor: theme.colors.surfaceSunken,
          borderRadius: theme.radii.md,
          gap: theme.space.sm,
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
              theme.fonts.heading,
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
            style={[theme.fonts.title, { color: theme.colors.text }]}
            testID="account-name"
          >
            {name}
          </Text>
        ) : null}
        <Text
          style={[theme.fonts.body, { color: theme.colors.textSecondary }]}
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
  // A row so "Delete Account" sizes to its label — full-width would read as
  // the screen's primary action.
  actions: {
    alignItems: "center",
    flexDirection: "row",
  },
  // Takes the leftover width, so log out stays the easy, obvious action.
  logOut: {
    flex: 1,
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
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
  identity: {
    flex: 1,
  },
});
