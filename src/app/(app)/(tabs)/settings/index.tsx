import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Platform, StyleSheet, View } from "react-native";

import { Button } from "@/components/Button";
import { signOut } from "@/hooks/useAuth";
import { useTheme } from "@/utils/theme";

const confirmLogOut = (): Promise<boolean> => {
  // RN's Alert is a no-op on web, so use the browser's confirm dialog there.
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm("Are you sure you want to log out?"));
  }

  return new Promise((resolve) => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Log Out", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
};

export default function SettingsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleLogOut = async () => {
    const confirmed = await confirmLogOut();
    if (!confirmed) return;

    setLoading(true);
    try {
      await signOut();
      // Drop cached data so nothing leaks to the next signed-in user.
      queryClient.clear();
      // No manual navigation: the (app)/_layout guard redirects to login once
      // the session state flips to null. Navigating here would race that state
      // update and (auth)/_layout could bounce a stale session back into the app.
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          padding: theme.spacing,
        },
      ]}
    >
      <Button
        variant="dangerous"
        onPress={handleLogOut}
        isLoading={loading}
        testID="settings-log-out-button"
      >
        Log Out
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
});
