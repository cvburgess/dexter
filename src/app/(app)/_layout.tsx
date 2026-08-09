import { useQueryClient } from "@tanstack/react-query";
import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";

import { LoadingScreen } from "@/components/LoadingScreen";
import { useAlarmSync } from "@/hooks/useAlarmSync";
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

  // Projects task alarm times onto native iOS AlarmKit (no-op elsewhere) so
  // set/unset/complete/reschedule and repeat occurrences all stay in sync.
  useAlarmSync();

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
      <Stack.Screen
        name="edit-task/[id]"
        options={createModalScreenOptions(theme, "Edit Task")}
      />
      {/* The only modal that hides its header on *both* platforms and draws its
          own in-tree (DEX-127). Its header's centered element is a `DayNav`, not
          a title string — and on iOS `DayNav`'s picker branch is a hosted
          SwiftUI view, which this app requires be pinned to an exact size or it
          renders untappable. A nav bar's async-sized title view is the worst
          place for one. Web settles it anyway: `stackOptions.web.ts` already
          hides the header, so a native header would have meant two
          implementations of one row. */}
      <Stack.Screen
        name="ritual-session"
        options={{
          ...createModalScreenOptions(theme, "Ritual"),
          headerShown: false,
        }}
      />
    </Stack>
  );
}
