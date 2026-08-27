import { useQueryClient } from "@tanstack/react-query";
import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";

import { StyleSheet, View } from "react-native";

import { FocusTimerHost } from "@/components/FocusTimerHost";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAlarmSync } from "@/hooks/useAlarmSync";
import { useAuth } from "@/hooks/useAuth";
import { goalsQueryOptions } from "@/hooks/useGoals";
import { useHabitWidgetDrain } from "@/hooks/useHabitWidgetDrain";
import { listsQueryOptions } from "@/hooks/useLists";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";
import { useDayRollover } from "@/hooks/useToday";
import { useWidgetSync } from "@/hooks/useWidgetSync";
import { createModalScreenOptions } from "@/utils/stackOptions";
import { useTheme } from "@/utils/theme";

export default function AppLayout() {
  const { initializing, session, userId } = useAuth();
  const theme = useTheme();
  const queryClient = useQueryClient();

  // Keeps every screen's query cache current when data changes on another
  // platform (web, MCP) — see docs/frontend.md's Data Layer section (DEX-36).
  useRealtimeInvalidation(userId);

  // Moves `useToday` off the day that just ended, so an app foregrounded after
  // midnight is on the new day without a force-quit (DEX-161).
  useDayRollover();

  // Projects task alarm times onto native iOS AlarmKit (no-op elsewhere) so
  // set/unset/complete/reschedule and repeat occurrences all stay in sync.
  useAlarmSync();

  // Publishes today + the next three days into the App Group the iOS widget
  // extension reads (no-op elsewhere), and clears it on sign-out.
  useWidgetSync();

  // Persists habit steps tapped on the home screen while the app wasn't
  // running — the extension holds no session of its own (DEX-160).
  useHabitWidgetDrain();

  // Warms lists/goals so the Backlog drawer's Group menu never waits on a
  // cold fetch. Keyed on userId — Supabase reissues Session on token refresh.
  useEffect(() => {
    if (!userId) {
      // A session can also end without account.tsx's clear (revoked token,
      // sign-out-everywhere) — clear here too against stale data (DEX-36).
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
    <View style={styles.root}>
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
      </Stack>
      {/* Publishes the running focus block, completes it on timeout, hosts
          the stop confirmation — alive on every tab, outside any one (DEX-49). */}
      <FocusTimerHost />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
