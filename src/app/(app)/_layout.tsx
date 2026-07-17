import { useQueryClient } from "@tanstack/react-query";
import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";

import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/hooks/useAuth";
import { goalsQueryOptions } from "@/hooks/useGoals";
import { listsQueryOptions } from "@/hooks/useLists";
import { createModalScreenOptions } from "@/utils/stackOptions";
import { useTheme } from "@/utils/theme";

export default function AppLayout() {
  const { initializing, session, userId } = useAuth();
  const theme = useTheme();
  const queryClient = useQueryClient();

  // Warms the lists/goals caches (`useLists`/`useGoals`'s own query options)
  // as soon as a session exists, so the Backlog drawer's Group menu never has
  // to wait on a cold fetch the first time "By List"/"By Goal" is picked.
  // Keyed on `userId` rather than the `session` object: Supabase reissues a
  // new `Session` object on every token refresh (roughly hourly) for the same
  // still-signed-in user, and keying on `session` itself would refire this
  // (and re-prefetch) on every one of those, not just an actual sign-in.
  useEffect(() => {
    if (!userId) {
      // Explicit log-out/delete-account already clear the whole cache
      // (settings/account.tsx), but a session can also end without going
      // through that screen (a revoked/expired token, "sign out everywhere"
      // from another device) — clear just what this effect warmed so a
      // different user signing in on the same device afterward doesn't see
      // the previous user's still-fresh lists/goals before anything else
      // invalidates them.
      queryClient.removeQueries({ queryKey: listsQueryOptions.queryKey });
      queryClient.removeQueries({ queryKey: goalsQueryOptions.queryKey });
      return;
    }

    void queryClient.prefetchQuery(listsQueryOptions);
    void queryClient.prefetchQuery(goalsQueryOptions);
  }, [userId, queryClient]);

  if (initializing) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="new-task"
        options={createModalScreenOptions(theme, "New Task")}
      />
    </Stack>
  );
}
