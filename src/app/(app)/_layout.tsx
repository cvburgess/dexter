import { useQueryClient } from "@tanstack/react-query";
import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";

import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/hooks/useAuth";
import { goalsQueryOptions } from "@/hooks/useGoals";
import { listsQueryOptions } from "@/hooks/useLists";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";
import { createModalScreenOptions } from "@/utils/stackOptions";
import { useTheme } from "@/utils/theme";

export default function AppLayout() {
  const { initializing, session, userId } = useAuth();
  const theme = useTheme();
  const queryClient = useQueryClient();

  // Keeps every screen's query cache current when data changes on another
  // platform (web, MCP) — see docs/frontend.md's Data Layer section (DEX-36).
  useRealtimeInvalidation(userId);

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
      // from another device) — clear it here too, the same way, so a
      // different user signing in on the same device afterward never sees
      // the previous user's still-fresh tasks/notes/habits/etc. (not just
      // lists/goals) before something else invalidates them (DEX-36).
      queryClient.clear();
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
